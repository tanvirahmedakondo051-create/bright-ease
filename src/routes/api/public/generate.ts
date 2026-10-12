import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  projectId: z.string().uuid(),
  prompt: z.string().min(1).max(8000),
  providerId: z.string().uuid().optional().nullable(),
  mode: z.enum(["plan", "build"]).optional().default("build"),
  attachments: z.array(z.object({ path: z.string().max(200), url: z.string().url().max(400), name: z.string().max(120), type: z.string().max(60) })).max(4).optional().default([]),
});

const PLAN_FORMAT = `

FORMAT: Reply in Bangla. When you ask a question, put each quick-tap option on its own line as [[option text]]. Never output HTML or code.`;

type Msg = { role: "user" | "assistant"; content: string; at: string; mode?: "plan" | "build" };

function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

const STRICT_RULE = `

STRICT OUTPUT RULE (MUST FOLLOW):
- Output ONLY the raw HTML document, starting with <!DOCTYPE html> and ending with </html>.
- NO JSON, NO tool calls (e.g. fs_write), NO markdown code fences, NO explanation before or after.

STYLE INSPIRATION: If the user provides an analyzed website (colors, fonts, layout), use the analyzed colors, fonts, and layout style as inspiration. Create ORIGINAL content, do not copy text or images.

ASSETS: When appropriate, use professional assets from the library instead of plain divs. Prefer Lottie for animations (via <script src="https://unpkg.com/@lottiefiles/lottie-player@2/dist/lottie-player.js"></script> and <lottie-player>), SVG icons for UI elements.`;

function findHtmlInJson(v: any): string | null {
  if (typeof v === "string") return /<html|<!doctype/i.test(v) ? v : null;
  if (Array.isArray(v)) {
    for (const x of v) { const r = findHtmlInJson(x); if (r) return r; }
    return null;
  }
  if (v && typeof v === "object") {
    for (const k of ["contents", "content", "html", "code", "text"]) {
      const r = findHtmlInJson(v[k]); if (r) return r;
    }
    for (const k of Object.keys(v)) { const r = findHtmlInJson(v[k]); if (r) return r; }
  }
  return null;
}

function unescapeLiteral(s: string) {
  return s
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\//g, "/")
    .replace(/\\\\/g, "\\");
}

function extractHtml(text: string) {
  let s = text.trim();
  // 1. Strip markdown fences
  const fence = s.match(/```[a-zA-Z]*\s*([\s\S]*?)(```|$)/);
  if (fence && !/^\s*<!doctype|^\s*<html/i.test(s)) s = fence[1].trim();
  // 2. JSON wrappers (tool calls like fs_write)
  const jStart = s.indexOf("{");
  const jEnd = s.lastIndexOf("}");
  if (jStart >= 0 && jEnd > jStart && !/^\s*<!doctype|^\s*<html/i.test(s)) {
    try {
      const found = findHtmlInJson(JSON.parse(s.slice(jStart, jEnd + 1)));
      if (found) s = found;
    } catch {
      const m = s.match(/"(?:contents|content|html)"\s*:\s*"([\s\S]*)"\s*[},]/);
      if (m) s = m[1];
    }
  }
  // 3. Literal escape sequences → real characters
  if (/\\n|\\"/.test(s) && !/\n/.test(s.slice(0, 200))) s = unescapeLiteral(s);
  else if (/\\n/.test(s) && /<!doctype html>\\n|<\/\w+>\\n/i.test(s)) s = unescapeLiteral(s);
  // 4. Trim before <!DOCTYPE / <html and after </html>
  const start = s.search(/<!doctype html|<html/i);
  if (start > 0) s = s.slice(start);
  const end = s.toLowerCase().lastIndexOf("</html>");
  if (end > 0) s = s.slice(0, end + 7);
  return s.trim();
}

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { "content-type": "application/json" } });

export const Route = createFileRoute("/api/public/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return json(401, "লগইন করুন");
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: u } = await db.auth.getUser(token);
        const user = u?.user;
        if (!user) return json(401, "লগইন সেশন শেষ, আবার লগইন করুন");

        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return json(400, "অনুরোধটি সঠিক নয়");
        }

        const { effectivePlan, allowedProviders } = await import("@/lib/plan.server");
        const [profile, { data: settings }, { data: project }] = await Promise.all([
          effectivePlan(db, user.id),
          db.from("site_settings").select("*").eq("id", 1).single(),
          db.from("projects").select("*").eq("id", body.projectId).single(),
        ]);
        if (!profile || !settings) return json(500, "সার্ভারে সমস্যা হয়েছে");
        if (!project || project.user_id !== user.id) return json(404, "প্রজেক্ট পাওয়া যায়নি");
        if (profile.is_banned) return json(403, "আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে");
        if (settings.require_email_verify && !user.email_confirmed_at) return json(403, "আগে ইমেইল ভেরিফাই করুন");

        const today = dhakaToday();
        let used = profile.tokens_used_today;
        if (profile.last_reset_date < today) {
          used = 0;
          await db.from("profiles").update({ tokens_used_today: 0, last_reset_date: today }).eq("id", user.id);
        }
        const limit = (profile.plans as any)?.tokens_per_day ?? 50000;
        const tpc = Math.max(1, (settings as any).tokens_per_coin ?? 10000);
        const coinsBefore = Number((profile as any).coins ?? 0);
        if (coinsBefore <= 0) return json(402, "COINS_OUT");
        const startedAt = Date.now();

        const since = new Date(Date.now() - 60_000).toISOString();
        const { count: recent } = await db.from("usage_logs").select("id", { count: "exact", head: true }).eq("user_id", user.id).gte("created_at", since);
        if ((recent ?? 0) >= ((profile.plans as any)?.rate_limit_per_minute ?? settings.rate_limit_per_minute)) return json(429, "খুব দ্রুত অনুরোধ করছেন। এক মিনিট অপেক্ষা করে আবার চেষ্টা করুন।");

        const providers = await allowedProviders(db, profile.plans);
        if (!providers?.length) return json(503, "এখনো কোনো AI সংযুক্ত করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।");
        const ordered = body.providerId
          ? [...providers.filter((p) => p.id === body.providerId), ...providers.filter((p) => p.id !== body.providerId)]
          : providers;

        const { data: libAssets } = await db.from("assets").select("name, category, type, url_or_code").neq("category", "icon").order("created_at", { ascending: false }).limit(20);
        const assetCtx = (libAssets ?? []).filter((a: any) => a.url_or_code.length < 600 || /^https?:/.test(a.url_or_code))
          .map((a: any) => `- [${a.category}/${a.type}] ${a.name}: ${a.url_or_code}`).join("\n");
        const history = (project.messages as Msg[]) ?? [];
        const isPlan = body.mode === "plan";
        const s2 = settings as any;
        const { relevantContext, outline, applyPatches, DIFF_RULE } = await import("@/lib/context.server");
        const { data: sum } = await db.from("chat_summaries").select("summary_text, up_to_message_id").eq("project_id", project.id).order("up_to_message_id", { ascending: false }).limit(1).maybeSingle();
        const summaryMsg = sum ? [{ role: "system", content: `CHAT SUMMARY SO FAR: ${sum.summary_text}` }] : [];
        const recentHist = history.slice(Math.max(sum?.up_to_message_id ?? 0, history.length - 5));

        // Attachments (images go to the AI as vision input) + auto-analyse the first link in the message.
        const atts = body.attachments.filter((a) => a.path.startsWith(project.id + "/"));
        const imageParts: any[] = [];
        for (const a of atts.filter((x) => x.type.startsWith("image/") && x.type !== "image/svg+xml")) {
          const { data: signed } = await db.storage.from("uploads").createSignedUrl(a.path, 3600);
          if (signed?.signedUrl) imageParts.push({ type: "image_url", image_url: { url: signed.signedUrl } });
        }
        let extra = "";
        if (atts.length) extra += `\n\nUSER UPLOADED FILES (use these exact URLs in the site when relevant, e.g. as <img src>):\n${atts.map((a) => `- ${a.name} (${a.type}): ${a.url}`).join("\n")}`;
        const link = body.prompt.match(/https?:\/\/[^\s<>"']+|(?:www\.)[a-z0-9-]+\.[a-z]{2,}[^\s<>"']*/i)?.[0];
        if (link) {
          const { analyzeUrl, analysisContext } = await import("@/lib/analyze.server");
          const r = await analyzeUrl(link).catch(() => null);
          if (r && "ok" in r) extra += "\n\n" + analysisContext(r.analysis);
        }
        const withExtra = (text: string) => (imageParts.length ? [{ type: "text", text: text + extra }, ...imageParts] : text + extra);

        const { data: analysis } = await db.from("project_analysis").select("*").eq("project_id", project.id).maybeSingle();
        let skillCtx = "";
        if (analysis) {
          const files = ((analysis.file_map_json as any[]) ?? []).slice(0, 60).map((f) => `- ${f.path} (${f.role})`).join("\n");
          skillCtx += `\n\nIMPORTED CODEBASE CONTEXT: This site was imported from GitHub. Framework/style: ${analysis.framework}. Entry: ${analysis.entry_file}. Files:\n${files}\nLocal CSS/JS were inlined into the single HTML. Preserve the existing framework, class naming, colors and structure; make precise targeted edits only.`;
        }
        const buildSystem = (s2.build_prompt || settings.system_prompt || "") + skillCtx + STRICT_RULE + (assetCtx ? `\n\nASSET LIBRARY (use when it fits):\n${assetCtx}` : "");
        const hasSite = !isPlan && !!project.code_html;
        const ctx = hasSite ? relevantContext(project.code_html, body.prompt) : null;
        const recentMsgs = recentHist.filter((m) => m.role === "user").map((m) => ({ role: "user", content: m.content }));

        const planMessages = [
          { role: "system", content: (s2.plan_prompt ?? "") + skillCtx + PLAN_FORMAT + (project.code_html ? `\n\nThe user already has a website with these sections:\n${outline(project.code_html)}` : "") },
          ...summaryMsg,
          ...recentHist.filter((m) => m.mode === "plan").map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: withExtra(body.prompt) },
        ];
        const diffMessages = hasSite ? [
          { role: "system", content: buildSystem.replace(/STRICT OUTPUT RULE[\s\S]*?explanation before or after\./, "") + DIFF_RULE },
          ...summaryMsg,
          ...recentMsgs,
          { role: "user", content: withExtra(`পেজের কাঠামো:\n${outline(project.code_html)}\n\n${ctx!.partial ? "প্রাসঙ্গিক অংশ" : "সম্পূর্ণ HTML"}:\n${ctx!.snippets.join("\n\n<!-- ... -->\n\n")}\n\nপরিবর্তনের অনুরোধ: ${body.prompt}`) },
        ] : null;
        const fullMessages = [
          { role: "system", content: buildSystem },
          ...summaryMsg,
          ...recentMsgs,
          { role: "user", content: withExtra(hasSite ? `এই ওয়েবসাইটটি আছে:\n\`\`\`html\n${project.code_html}\n\`\`\`\n\nপরিবর্তনের অনুরোধ: ${body.prompt}\n\nসম্পূর্ণ আপডেট করা HTML ফাইলটি দিন।` : body.prompt) },
        ];

        const enc = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            const send = (o: object) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
            let usedProvider: any = null;

            const run = async (messages: any[], live: boolean): Promise<{ full: string; tokens: number } | null> => {
              let res: Response | null = null;
              const list = usedProvider ? [usedProvider, ...ordered.filter((p) => p.id !== usedProvider.id)] : ordered;
              for (let i = 0; i < list.length; i++) {
                const p = list[i];
                if (i > 0) send({ t: "notice", msg: "মূল AI ব্যস্ত, বিকল্প ব্যবহার করা হচ্ছে..." });
                try {
                  const r = await fetch(p.base_url.replace(/\/+$/, "") + "/chat/completions", {
                    method: "POST",
                    signal: request.signal,
                    headers: { Authorization: `Bearer ${p.api_key}`, "Content-Type": "application/json", ...((p.custom_headers as Record<string, string>) ?? {}) },
                    body: JSON.stringify({ model: p.model, messages, stream: true, stream_options: { include_usage: true }, max_tokens: Math.min(p.max_tokens, settings.max_output_tokens), temperature: p.temperature }),
                  });
                  if (r.ok && r.body) { res = r; usedProvider = p; break; }
                  console.error("provider failed", p.name, r.status, (await r.text()).slice(0, 300));
                } catch (e) {
                  if (request.signal.aborted) return null;
                  console.error("provider error", p.name, e);
                }
              }
              if (!res) return null;
              let full = "", tokens = 0, buf = "";
              const reader = res.body!.getReader();
              const dec = new TextDecoder();
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  buf += dec.decode(value, { stream: true });
                  const lines = buf.split("\n");
                  buf = lines.pop() ?? "";
                  for (const line of lines) {
                    const l = line.trim();
                    if (!l.startsWith("data:")) continue;
                    const payload = l.slice(5).trim();
                    if (payload === "[DONE]") continue;
                    try {
                      const j = JSON.parse(payload);
                      const c = j.choices?.[0]?.delta?.content;
                      if (c) { full += c; if (live) send({ t: "delta", c }); }
                      if (j.usage?.total_tokens) tokens = j.usage.total_tokens;
                    } catch { /* partial line */ }
                  }
                }
              } catch (e) {
                if (!request.signal.aborted) console.error("stream read", e);
              }
              if (!tokens) tokens = Math.ceil((JSON.stringify(messages).length + full.length) / 4);
              return { full, tokens };
            };

            const finishSummary = async (msgs: Msg[]) => {
              const from = sum?.up_to_message_id ?? 0;
              const upTo = msgs.length - 5;
              if (upTo - from < 10 || !usedProvider) return;
              try {
                const p = usedProvider;
                const text = msgs.slice(from, upTo).map((m) => `${m.role === "user" ? "User" : "AI"}: ${m.content.slice(0, 400)}`).join("\n");
                const r = await fetch(p.base_url.replace(/\/+$/, "") + "/chat/completions", {
                  method: "POST",
                  headers: { Authorization: `Bearer ${p.api_key}`, "Content-Type": "application/json", ...((p.custom_headers as Record<string, string>) ?? {}) },
                  body: JSON.stringify({ model: p.model, max_tokens: 300, temperature: 0.2, messages: [
                    { role: "system", content: "Summarize this website-building chat in short Bangla, max 4 sentences, format: 'User wants X. Tried Y. Current: Z.' Output only the summary." },
                    { role: "user", content: (sum ? `Previous summary: ${sum.summary_text}\n\n` : "") + text },
                  ] }),
                  signal: AbortSignal.timeout(25000),
                });
                if (!r.ok) return;
                const j: any = await r.json();
                const t = String(j.choices?.[0]?.message?.content ?? "").trim().slice(0, 1500);
                if (t) await db.from("chat_summaries").insert({ project_id: project.id, summary_text: t, up_to_message_id: upTo });
              } catch (e) { console.error("summary", e); }
            };

            const charge = async (tokens: number, saved: number) => {
              await Promise.all([
                db.from("usage_logs").insert({ user_id: user.id, tokens_used: tokens, provider_name: usedProvider.name, tokens_saved: saved } as any),
                db.from("profiles").update({ tokens_used_today: used + tokens, last_reset_date: today }).eq("id", user.id),
              ]);
            };

            if (isPlan) {
              const r = await run(planMessages, true);
              if (!r) { send({ t: "error", msg: "এই মুহূর্তে কোনো AI সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করুন।" }); return controller.close(); }
              const now = new Date().toISOString();
              const reply = r.full.trim() || "দুঃখিত, উত্তর পাওয়া যায়নি";
              const newMsgs: Msg[] = [...history, { role: "user", content: body.prompt, at: now, mode: "plan", files: atts.map((a) => ({ name: a.name, url: a.url, type: a.type })) } as any, { role: "assistant", content: reply, at: now, mode: "plan" }];
              await Promise.all([db.from("projects").update({ messages: newMsgs }).eq("id", project.id), charge(r.tokens, 0)]);
              send({ t: "done", tokens: r.tokens, html: "", plan: reply, used: used + r.tokens, limit });
              await finishSummary(newMsgs);
              return controller.close();
            }

            let html = "";
            let tokens = 0;
            let saved = 0;
            if (diffMessages) {
              send({ t: "notice-soft", msg: "শুধু পরিবর্তিত অংশ লেখা হচ্ছে..." });
              const r = await run(diffMessages, true);
              if (r) {
                tokens = r.tokens;
                const patched = applyPatches(project.code_html, r.full);
                if (patched && /<\w+/.test(patched.html)) {
                  html = patched.html;
                  const fullCost = Math.ceil((JSON.stringify(fullMessages).length + project.code_html.length) / 4);
                  saved = Math.max(0, fullCost - tokens);
                } else {
                  send({ t: "notice", msg: "পুরো ওয়েবসাইট আবার লেখা হচ্ছে..." });
                }
              }
            }
            if (!html) {
              const r = await run(fullMessages, true);
              if (!r && !tokens) { send({ t: "error", msg: "এই মুহূর্তে কোনো AI সাড়া দিচ্ছে না। একটু পরে আবার চেষ্টা করুন।" }); return controller.close(); }
              if (r) { tokens += r.tokens; html = extractHtml(r.full); }
            }
            if (!html || !/<\w+/.test(html)) {
              html = "";
              send({ t: "error", msg: "AI সঠিক ওয়েবসাইট দেয়নি। অন্যভাবে লিখে আবার চেষ্টা করুন।" });
            }

            const { data: kws } = await db.from("flag_keywords").select("keyword");
            const lower = html.toLowerCase();
            const hit = (kws ?? []).find((k) => lower.includes(k.keyword.toLowerCase()) || body.prompt.toLowerCase().includes(k.keyword.toLowerCase()));

            const now = new Date().toISOString();
            const newMsgs: Msg[] = [
              ...history,
              { role: "user", content: body.prompt, at: now, mode: "build", files: atts.map((a) => ({ name: a.name, url: a.url, type: a.type })) } as any,
              { role: "assistant", content: html ? (saved ? "✓ ওয়েবসাইট আপডেট হয়েছে" : "✓ ওয়েবসাইট তৈরি হয়েছে") : "দুঃখিত, এবার হয়নি", at: now, mode: "build" },
            ];
            const update: any = { messages: newMsgs };
            if (html) { update.code_html = html; if (project.is_published) update.changes_since_publish = ((project as any).changes_since_publish ?? 0) + 1; }
            if (hit) Object.assign(update, { is_flagged: true, flag_reason: `কীওয়ার্ড: ${hit.keyword}`, is_published: false });
            if (project.name === "নতুন প্রজেক্ট" && !history.length) update.name = body.prompt.slice(0, 40);

            await Promise.all([db.from("projects").update(update).eq("id", project.id), charge(tokens, saved)]);
            const savedPct = saved ? Math.round((saved / (saved + tokens)) * 100) : 0;
            send({ t: "done", tokens, html, used: used + tokens, limit, saved, savedPct });
            await finishSummary(newMsgs);
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
        });
      },
    },
  },
});
