// Server-only build engine for the bot studio. runBotChat holds the full Plan/Build/Upgrade
// logic (shared by the botChat server function and background jobs); processBotJob runs a
// queued bot_jobs row to completion so a build survives the user's screen turning off.
import { z } from "zod";
import { extractJson } from "@/lib/patch";
import { hasUnclosedBlock, parseFileBlocks } from "@/lib/file-blocks";
import { missingFeatures, truncationProblems } from "@/lib/preserve-check";
import {
  ALLOWED_FILES,
  MAIN_FILE,
  normalizeFiles,
  CHAT_RULES,
  CHAT_DAILY_CAP,
  FILE_FORMAT,
  MAX_OUTPUT_TOKENS,
  addUsage,
  brainContext,
  cleanFiles,
  loadOwned,
  mergeButtonEmojis,
  rules,
  usageToday,
  wait,
  type BotFile,
  type BotMsg,
  type BotPlan,
} from "@/lib/bot.functions";

export type BotChatData = {
  botId: string;
  prompt: string;
  mode: "chat" | "plan" | "build";
  errorLog?: string;
  questionAnswers?: { question: string; answer: string }[];
  attachments?: { name: string; kind: "text" | "image"; content: string }[];
};

type Emit = (step: string) => Promise<void>;

const limitReached = (value: number, limit: unknown) => {
  const cap = Number(limit ?? -1);
  return cap >= 0 && value >= cap;
};

export async function runBotChat(db: any, userId: string, data: BotChatData, emit?: Emit) {
  const started = Date.now();
  const { effectivePlan, allowedProviders } = await import("@/lib/plan.server");
  const bot = await loadOwned(db, userId, data.botId);
  const files: BotFile[] = normalizeFiles(bot.files ?? []);
  const explicitFullRegenerate = /পুরো\s*বট\s*আবার\s*বানাও|regenerate\s+(the\s+)?(entire|whole)\s+bot/i.test(data.prompt);
  // An approved plan is an explicit user request to build the full bot from that plan.
  const fromApprovedPlan = data.prompt.includes("APPROVED PLAN:");
  const isFix = data.mode === "build" && files.some((f) => f.path === MAIN_FILE) && !explicitFullRegenerate && !fromApprovedPlan;
  if (data.mode === "build" && (!bot.token_enc || !bot.admin_id)) return { error: "NEED_SECRETS" };
  const [profile, { data: settings }] = await Promise.all([effectivePlan(db, userId), db.from("site_settings").select("*").eq("id", 1).single()]);
  if (!profile || !settings) return { error: "সার্ভারে সমস্যা হয়েছে" };
  if (profile.is_banned) return { error: "আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে" };
  const isChat = data.mode === "chat";
  if (!isChat && Number((profile as any).coins ?? 0) <= 0) return { error: "COINS_OUT" };
  if (isChat) {
    const day = new Date().toISOString().slice(0, 10);
    const todayChats = ((bot.messages ?? []) as BotMsg[]).filter((m) => m.mode === "chat" && m.role === "user" && String(m.at).startsWith(day)).length;
    if (todayChats >= CHAT_DAILY_CAP) return { error: "আজকের ফ্রি Chat সীমা শেষ — কাল আবার চেষ্টা করুন" };
  }
  const usage = await usageToday(db, userId);
  if (!isChat && limitReached(usage.ai_messages, profile.plans?.daily_ai_messages)) return { error: "আজকের AI message সীমা শেষ হয়েছে" };
  if (isFix && limitReached(usage.fix_requests, profile.plans?.max_fix_requests_per_day)) return { error: "আজকের fix request সীমা শেষ হয়েছে" };
  const providers = await allowedProviders(db, profile.plans);
  if (!providers?.length) return { error: "এখনো কোনো AI সংযুক্ত করা হয়নি। অ্যাডমিনের সাথে যোগাযোগ করুন।" };

  const attText = (data.attachments ?? []).filter((a) => a.kind === "text").map((a) => `\n\nATTACHED FILE ${a.name}:\n${a.content}`).join("");
  // Collect premium emoji IDs from anything the user pasted (old bot code, lists) into the platform library.
  const libIds = ((settings as any).button_emojis as Record<string, string>) ?? {};
  const libMeta = ((settings as any).button_emoji_meta as Record<string, any>) ?? {};
  {
    const { extractPremiumEmojis } = await import("@/lib/emoji-extract");
    const have = new Set(Object.values(libIds));
    const fresh = extractPremiumEmojis(`${data.prompt}\n${data.errorLog ?? ""}\n${attText}`).filter((e) => !have.has(e.id) && !(e.key in libIds));
    if (fresh.length) {
      for (const e of fresh) { libIds[e.key] = e.id; libMeta[e.key] = { kind: e.kind, style: e.style, fallback: e.fallback, label: e.key }; }
      await db.from("site_settings").update({ button_emojis: libIds, button_emoji_meta: libMeta } as any).eq("id", 1);
    }
  }
  // Premium vs normal emoji choice: from prompt, intake answer, or saved on the bot.
  const askText = `${data.prompt} ${(data.questionAnswers ?? []).map((a) => a.answer).join(" ")}`;
  let emojiMode: string = (bot as any).emoji_mode ?? "";
  if (/normal|সাধারণ\s*(ইমোজি|emoji)|নরমাল/i.test(askText) && /emoji|ইমোজি/i.test(askText)) emojiMode = "normal";
  else if (/premium|প্রিমিয়াম/i.test(askText)) emojiMode = "premium";
  if (emojiMode && emojiMode !== (bot as any).emoji_mode) await db.from("bots").update({ emoji_mode: emojiMode } as any).eq("id", bot.id);
  if (data.mode === "plan" && !emojiMode && !data.questionAnswers?.length) {
    return { ok: true, questions: [{ q: "বাটন ও মেসেজে কোন ধরনের emoji চান?", options: ["Premium emoji (লাইব্রেরির ID দিয়ে)", "সাধারণ (normal) emoji"] }], coins: 0 };
  }
  const R = emojiMode === "normal"
    ? rules({}, {}).replace(/- PREMIUM EMOJI[\s\S]*?- README/, "- EMOJI: use ONLY normal Unicode emoji in button text and messages. Do NOT use icon_custom_emoji_id, <tg-emoji>, BUTTON_EMOJIS or an Emoji Settings menu.\n- README")
    : rules(libIds, libMeta) + `\n- PREMIUM COVERAGE IS ALL-OR-NOTHING: for EVERY user/admin button pick the library key whose meaning matches and apply icon + purpose-appropriate colour; for EVERY meaningful emoji in headings, statuses, alerts and confirmations use the matching TEXT_EMOJIS key through pe(). Never premium-style only a few places and leave the rest inconsistent. Reuse matching keys instead of inventing empty ones.`;
  const history: BotMsg[] = bot.messages ?? [];
  const brain = await brainContext(db, `${data.prompt} ${data.errorLog ?? ""}`).catch(() => "");
  const fileCtx = files.length ? `\n\nCURRENT BOT FILES:\n${files.map((f) => `--- ${f.path}\n${f.content}`).join("\n").slice(0, 200000)}` : "";
  const answered = data.questionAnswers?.length
    ? `\n\nThe user answered your intake questions:\n${data.questionAnswers.map((a, i) => `${i + 1}. ${a.question}\nAnswer: ${a.answer || "Skipped"}`).join("\n")}`
    : "";
  const planShape = `{"plan":{"summary":"2-3 sentence Bangla summary","menus":["menu/button list"],"features":["feature list"],"files":["app.py","requirements.txt","README.md"],"acceptance":["testable acceptance checks"]}}`;
  const system = isChat
    ? `${CHAT_RULES}${brain}${fileCtx}`
    : data.mode === "plan"
    ? data.questionAnswers?.length
      ? `You are a senior Telegram bot architect. Reply in Bangla. Intake is complete; do NOT ask questions. Return ONLY JSON: ${planShape}. No code.\n${R}${brain}${fileCtx}`
      : `You are a senior Telegram bot architect. Reply in Bangla. If essential details are missing return ONLY JSON {"questions":[{"q":"question","options":["a","b","c"]}]} (1-3 questions). Otherwise return ONLY JSON: ${planShape}. No code.\n${R}${brain}${fileCtx}`
    : isFix
      ? `You are a senior Python Telegram bot engineer UPGRADING an existing bot. You receive the full current files. Apply ONLY the user's requested change or fix. Keep every existing feature, function, command, handler, callback_data, button, text and setting exactly as it is unless the user asked to change it. Return the COMPLETE new app.py — never partial, never placeholders like "# ... rest unchanged". Include requirements.txt/README.md only if they must change.\n${R}${brain}\n${FILE_FORMAT}\nAfter the files also add:\n=== CHANGES ===\none short Bangla line per changed section\n=== END CHANGES ===\n=== BRAIN ===\n{"error_signature":"short key","symptom":"short","root_cause":"short","fix_summary":"short"}\n=== END BRAIN ===${fileCtx}`
      : `You are a senior Python Telegram bot engineer. Build a production-quality bot.\n${R}${brain}\n${FILE_FORMAT}\nReturn app.py, requirements.txt and README.md.${fileCtx}`;
  const userText = data.prompt + answered + attText + (data.errorLog ? `\n\nThe bot crashed with this log, fix it:\n${data.errorLog}` : "");
  const images = (data.attachments ?? []).filter((a) => a.kind === "image");
  const messages: { role: string; content: any }[] = [
    { role: "system", content: system },
    ...history.slice(-6).map((m) => ({ role: m.role, content: (m.plan ? JSON.stringify(m.plan) : m.content).slice(0, 3000) })),
    { role: "user", content: images.length ? [{ type: "text", text: userText + `\n\nREFERENCE PICTURES: inspect every visible button, label, layout and emoji. Match each visible button/text emoji by meaning to the closest supplied BUTTON_EMOJIS/TEXT_EMOJIS library ID and apply it in the same corresponding place. If numeric IDs are included in my text/files, use those exact IDs. A picture itself does not expose Telegram's numeric custom-emoji ID: if any requested visible emoji has no confident library match, return ONLY JSON {"questions":[{"q":"ছবির এই emoji-টির Premium ID/লাইব্রেরি key দিন: …","options":["ID লিখব","সাধারণ emoji রাখুন"]}]} before writing code. Never guess an ID and never silently premium-style only some places.` }, ...images.map((a) => ({ type: "image_url", image_url: { url: a.content } }))] : userText },
  ];
  let imagesOn = images.length > 0;
  let imageNotice = "";
  const plain = (ms: { role: string; content: any }[]) => imagesOn ? ms : ms.map((m) => Array.isArray(m.content) ? { ...m, content: m.content.filter((c: any) => c.type === "text").map((c: any) => c.text).join("\n") } : m);

  const callAI = async (messagesIn: { role: string; content: any }[], prefix = "") => {
    let messages = plain(messagesIn);
    let reply = "", tokens = 0, finish = "";
    let lastProviderStatus = 0;
    for (const p of providers) {
      let sendMax = data.mode === "build";
      for (let attempt = 0; attempt < 3 && !reply; attempt++) {
        try {
          if (attempt > 0) await wait(1400 + Math.floor(Math.random() * 700));
          // Generous 10-minute cap: a healthy streaming build finishes well inside it, but a
          // silently hung connection must not leave the background job "running" forever.
          const r = await fetch(p.base_url.replace(/\/+$/, "") + "/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${p.api_key}`, "Content-Type": "application/json", ...((p.custom_headers as Record<string, string>) ?? {}) },
            signal: AbortSignal.timeout(10 * 60_000),
            // Streaming keeps bytes flowing so long builds don't hit gateway 504/524 timeouts.
            // A large max_tokens stops providers from cutting long bot.py files at their small default.
            body: JSON.stringify({ model: p.model, messages, temperature: 0.3, stream: true, stream_options: { include_usage: true }, ...(sendMax ? { max_tokens: MAX_OUTPUT_TOKENS } : {}) }),
          });
          lastProviderStatus = r.status;
          if (!r.ok || !r.body) {
            const detail = (await r.text()).slice(0, 300);
            console.error("bot ai", r.status, detail);
            if (r.status === 400 && sendMax && /max_tokens|max_output|maximum/i.test(detail)) { sendMax = false; attempt--; continue; }
            if (r.status === 400 && imagesOn) { imagesOn = false; imageNotice = "এই AI মডেল ছবি পড়তে পারে না — শুধু লেখা ও ফাইল পাঠানো হয়েছে।"; messages = plain(messagesIn); attempt--; continue; }
            const transient = r.status === 429 || r.status >= 500;
            if (transient && attempt < 2) continue;
            break;
          }
          const ct = r.headers.get("content-type") ?? "";
          if (!ct.includes("event-stream")) {
            const j: any = await r.json();
            reply = String(j.choices?.[0]?.message?.content ?? "");
            finish = String(j.choices?.[0]?.finish_reason ?? "");
            tokens = Number(j.usage?.total_tokens ?? 0);
          } else {
            const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = "";
            const consumeLine = (line: string) => {
              if (!line.startsWith("data:")) return;
              const d = line.slice(5).trim();
              if (!d || d === "[DONE]") return;
              try {
                const j = JSON.parse(d);
                reply += j.choices?.[0]?.delta?.content ?? "";
                if (j.choices?.[0]?.finish_reason) finish = String(j.choices[0].finish_reason);
                if (j.usage?.total_tokens) tokens = Number(j.usage.total_tokens);
              } catch { /* incomplete SSE event stays harmless */ }
            };
            // Stall guard: if the stream sends no bytes for 4 minutes the connection is dead
            // even though it never closed — fail so the job can retry or end with an error.
            const stall = () => new Promise<never>((_, reject) => { const t = setTimeout(() => reject(new Error("সার্ভারের সাড়া নেই — AI অনেকক্ষণ কিছু লেখেনি")), reply ? 90_000 : 180_000); (stall as any).t = t; });
            let lastP = Date.now();
            for (;;) {
              if (data.mode === "build" && emit && Date.now() - lastP > 15_000) {
                lastP = Date.now();
                const lines = (prefix + reply).split("\n").length;
                await emit(`AI কোড লিখছে… ${lines} লাইন লেখা হয়েছে`);
              }
              const s = stall();
              const { done, value } = await Promise.race([reader.read(), s]).finally(() => clearTimeout((stall as any).t));
              if (done) break;
              buf += dec.decode(value, { stream: true });
              let i;
              while ((i = buf.indexOf("\n")) >= 0) { consumeLine(buf.slice(0, i).trim()); buf = buf.slice(i + 1); }
            }
            consumeLine((buf + dec.decode()).trim());
          }
          if (!tokens && reply) tokens = Math.ceil((JSON.stringify(messages).length + reply.length) / 4);
        } catch (e) {
          console.error("bot ai", e);
          if (attempt < 2) continue;
        }
      }
      if (reply) break;
    }
    return { reply, tokens, finish, lastProviderStatus };
  };

  // Build/upgrade: if the reply stops mid-file, ask the model to continue (max 3) and join the parts.
  let extraTokens = 0;
  const generate = async (msgs: { role: string; content: string }[]) => {
    let r = await callAI(msgs);
    if (!r.reply || data.mode !== "build") return r;
    let text = r.reply;
    for (let i = 0; i < 3 && (/length|max_tokens/i.test(r.finish) || hasUnclosedBlock(text)); i++) {
      await emit?.("উত্তর লম্বা — বাকি অংশ আনা হচ্ছে…");
      const c = await callAI([...msgs, { role: "assistant", content: text }, { role: "user", content: "Your reply was cut off. Continue EXACTLY where you stopped, starting with the very next character. Do not repeat earlier text, no preface, keep the same === FILE === format." }], text);
      if (!c.reply) break;
      text += c.reply; extraTokens += c.tokens; r = { ...c, reply: text, tokens: r.tokens };
    }
    return { ...r, reply: text };
  };
  await emit?.("AI কোড লিখছে…");
  if (isChat) {
    const r = await callAI(messages);
    if (!r.reply) return { error: "AI সংযোগ সাময়িকভাবে বন্ধ — আবার চেষ্টা করুন (Chat ফ্রি, কিছু কাটেনি)।" };
    const verdict = /VERDICT:\s*code_bug/i.test(r.reply) ? "code_bug" : "not_code";
    const brief = r.reply.match(/FIX_BRIEF:\s*([\s\S]*?)$/i)?.[1]?.trim().slice(0, 1500) ?? "";
    const content = r.reply.replace(/VERDICT:.*$/im, "").replace(/FIX_BRIEF:[\s\S]*$/i, "").trim();
    const now = new Date().toISOString();
    const attNames = (data.attachments ?? []).map((a) => `📎 ${a.name}`).join("\n");
    const msgs: BotMsg[] = [...history, { role: "user", content: attNames ? `${data.prompt}\n\n${attNames}` : data.prompt, mode: "chat", at: now }, { role: "assistant", content, mode: "chat", at: now, ms: Date.now() - started }];
    await db.from("bots").update({ messages: msgs, updated_at: now } as any).eq("id", bot.id);
    return { ok: true, coins: 0, chat: true, needsBuildFix: verdict === "code_bug", fixBrief: brief, imageNotice };
  }
  let { reply, tokens, finish, lastProviderStatus } = await generate(messages);
  if (!reply) {
    await db.from("bot_brain").insert({ source: "system", error_signature: "AI_PROVIDER_NO_RESPONSE", symptom: "Bot plan/build/fix request received no provider response", root_cause: "All configured AI providers failed or timed out", fix_summary: "Check provider health and retry; no bot files were changed" } as any);
    return { error: lastProviderStatus === 429 ? "AI এখন ব্যস্ত। একটু অপেক্ষা করে আবার চেষ্টা করুন—কোনো ফাইল বদলায়নি।" : "AI সংযোগ সাময়িকভাবে বন্ধ হয়েছে। আবার চেষ্টা করুন—কোনো ফাইল বা কয়েন বদলায়নি।" };
  }

  const tpc = Math.max(1, (settings as any).tokens_per_coin ?? 10000);
  const coins = Math.max(1, Math.ceil(tokens / tpc));

  const { data: fresh } = await db.from("bots").select("cancel_requested_at").eq("id", bot.id).single();
  if (fresh?.cancel_requested_at && new Date(fresh.cancel_requested_at).getTime() >= started) return { cancelled: true };

  const parsed: any = extractJson(reply);
  const now = new Date().toISOString();
  const ms = Date.now() - started;
  let assistant: BotMsg;
  let newFiles = files;

  if (data.mode === "plan") {
    if (!data.questionAnswers?.length && Array.isArray(parsed?.questions) && parsed.questions.length) {
      const qs = z.array(z.object({ q: z.string(), options: z.array(z.string()) })).safeParse(parsed.questions);
      if (qs.success && qs.data.length) {
        await db.rpc("add_coins", { _user: userId, _amount: -coins, _type: "spend", _reason: "টেলিগ্রাম বট" } as any);
        await db.from("usage_logs").insert({ user_id: userId, tokens_used: tokens, provider_name: "bot" } as any);
        await addUsage(db, userId, { ai_messages: 1 });
        return { ok: true, questions: qs.data.slice(0, 3).map((q) => ({ q: q.q.slice(0, 500), options: q.options.slice(0, 4).map((o) => o.slice(0, 300)) })), coins };
      }
    }
    const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).slice(0, 20) : []);
    const pl = parsed?.plan;
    const plan: BotPlan | undefined = pl && typeof pl === "object" ? { summary: String(pl.summary ?? ""), menus: arr(pl.menus), features: arr(pl.features), files: arr(pl.files).length ? arr(pl.files) : ALLOWED_FILES, acceptance: arr(pl.acceptance) } : undefined;
    assistant = { role: "assistant", content: plan?.summary || String(pl ?? reply).trim(), mode: "plan", at: now, plan, coins, ms };
  } else {
    if (Array.isArray(parsed?.questions) && parsed.questions.length) {
      const qs = z.array(z.object({ q: z.string(), options: z.array(z.string()) })).safeParse(parsed.questions);
      if (qs.success) return { ok: true, questions: qs.data.slice(0, 3).map((q) => ({ q: q.q.slice(0, 500), options: q.options.slice(0, 4).map((o) => o.slice(0, 300)) })), coins: 0 };
    }
    const oldPy = files.find((f) => f.path === MAIN_FILE)?.content ?? "";
    const allowRemoval = /বাদ|সরাও|সরিয়ে|মুছ|remove|delete/i.test(data.prompt);
    // Read files from === FILE === blocks (JSON accepted as a legacy backup), merge over existing files on upgrades.
    const read = (text: string) => {
      const fb = parseFileBlocks(text);
      let got: BotFile[] = fb.files;
      let summary = fb.sections.summary ?? "";
      let brainRow: any = null;
      try { brainRow = fb.sections.brain ? JSON.parse(fb.sections.brain) : null; } catch { brainRow = null; }
      if (!got.length) {
        const j = extractJson(text);
        const ok = z.array(z.object({ path: z.string().min(1).max(200), content: z.string() })).max(20).safeParse(j?.files);
        if (ok.success) got = ok.data;
        summary ||= String(j?.summary ?? "");
        brainRow ||= j?.brain ?? null;
      }
      got = cleanFiles(normalizeFiles(got));
      const merged = isFix ? [...files.filter((f) => !got.some((g) => g.path === f.path)), ...got] : got;
      const py = got.find((f) => f.path === MAIN_FILE)?.content ?? "";
      const problems: string[] = [];
      if (!py) problems.push(fb.unclosed ? "reply was cut off before app.py finished" : "no app.py file block in the reply");
      else {
        if (fb.unclosed) problems.push("reply was cut off (a FILE block never closed)");
        problems.push(...truncationProblems(py, isFix ? oldPy : undefined));
      }
      const missing = isFix && py && !allowRemoval ? missingFeatures(oldPy, py) : [];
      return { list: merged, summary, brainRow, changes: fb.sections.changes ?? "", problems, missing };
    };
    await emit?.("ফিচার যাচাই করা হচ্ছে…");
    let out = read(reply);
    if (out.problems.length || out.missing.length) {
      // One repair round naming exactly what went wrong.
      const issues = [...out.problems, ...(out.missing.length ? [`these existing items were removed but must be kept: ${out.missing.slice(0, 40).join(", ")}`] : [])];
      console.error("bot build repair", { finish, replyLength: reply.length, issues: issues.slice(0, 5) });
      await emit?.("ঘাটতি পাওয়া গেছে — সংশোধন চলছে…");
      const fix = await generate([...messages, { role: "assistant", content: reply.slice(-4000) }, { role: "user", content: `Your output had problems:\n- ${issues.join("\n- ")}\nReturn the COMPLETE corrected files again in the exact === FILE === format. Keep every existing feature.` }]);
      extraTokens += fix.tokens;
      if (fix.reply) {
        const second = read(fix.reply);
        if (second.problems.length + second.missing.length < out.problems.length + out.missing.length || (!second.problems.length && !second.missing.length)) { out = second; reply = fix.reply; }
      }
    }
    if (out.problems.length || out.missing.length) {
      const cut = out.problems.some((p) => /cut off|shorter|start-up|unclosed/.test(p));
      await db.from("bot_brain").insert({ source: "system", error_signature: out.missing.length ? "UPGRADE_DROPPED_FEATURES" : cut ? "BUILD_OUTPUT_TRUNCATED" : "BUILD_OUTPUT_UNREADABLE", symptom: [...out.problems, ...out.missing].join("; ").slice(0, 300), root_cause: `finish_reason=${finish || "?"}, reply_length=${reply.length}`, fix_summary: "Return complete files in === FILE === blocks; keep all existing features" } as any);
      const why = out.missing.length
        ? `AI নতুন app.py-তে পুরনো ${out.missing.length}টি অংশ বাদ দিয়ে ফেলেছিল (যেমন ${out.missing.slice(0, 3).join(", ")})।`
        : cut ? "AI-এর উত্তর মাঝপথে কেটে গেছে, app.py সম্পূর্ণ হয়নি।" : "AI-এর উত্তর থেকে app.py পড়া যায়নি।";
      return { error: `${why} পুরনো ফাইল অপরিবর্তিত, কোনো কয়েন কাটেনি—আবার চেষ্টা করুন।` };
    }
    const list = out.list;
    newFiles = list;
    const changes = out.changes ? `\n\nযা বদলেছে:\n${out.changes}` : "";
    assistant = { role: "assistant", content: (out.summary || (isFix ? "বট আপগ্রেড হয়েছে।" : "বট তৈরি হয়েছে।")) + changes, mode: isFix ? "fix" : "build", at: now, coins, ms: Date.now() - started };
    await emit?.("ফাইল সেভ হচ্ছে…");
    await db.from("bot_versions").insert({ bot_id: bot.id, user_id: userId, files: list, note: assistant.content.slice(0, 200), coins_used: coins } as any);
    const b = out.brainRow;
    if (isFix && b && typeof b === "object") {
      const s = (v: unknown) => String(v ?? "").slice(0, 300);
      await db.from("bot_brain").insert({ source: data.errorLog ? "qa" : "user_fix", error_signature: s(b.error_signature), symptom: s(b.symptom), root_cause: s(b.root_cause), fix_summary: s(b.fix_summary), code_snippet: s(out.changes) } as any);
    }
    const code = list.find((file) => file.path === MAIN_FILE)?.content ?? "";
    await mergeButtonEmojis(db, code, ((settings as any).button_emojis as Record<string, string>) ?? {});
  }

  const attNames = (data.attachments ?? []).map((a) => `📎 ${a.name}`).join("\n");
  const msgs: BotMsg[] = [...history, { role: "user", content: attNames ? `${data.prompt}\n\n${attNames}` : data.prompt, mode: isFix ? "fix" : data.mode, at: now }, assistant];
  await db.rpc("add_coins", { _user: userId, _amount: -coins, _type: "spend", _reason: "টেলিগ্রাম বট" } as any);
  await db.from("usage_logs").insert({ user_id: userId, tokens_used: tokens + extraTokens, provider_name: "bot" } as any);
  await db.from("bots").update({ messages: msgs, files: newFiles, updated_at: now, ...(data.mode === "build" ? { last_build_at: now } : {}) } as any).eq("id", bot.id);
  await addUsage(db, userId, { ai_messages: 1, fix_requests: isFix ? 1 : 0, builds: data.mode === "build" ? 1 : 0 });
  return { ok: true, coins, ms, imageNotice };
}

/** Run one queued/stuck bot_jobs row to completion. Safe to re-run: coins are only charged on a successful save. */
export async function processBotJob(jobId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: job } = await db.from("bot_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job || !["queued", "running"].includes(job.status)) return { skipped: true };
  const now = () => new Date().toISOString();
  // Claim the job (acts as the run lease; a stale heartbeat lets the cron sweeper re-claim it).
  await db.from("bot_jobs").update({ status: "running", attempts: (job.attempts ?? 0) + 1, heartbeat_at: now(), updated_at: now() }).eq("id", jobId).in("status", ["queued", "running"]);
  const emit: Emit = async (step) => {
    const { data: j } = await db.from("bot_jobs").select("events, status").eq("id", jobId).maybeSingle();
    if (j?.status === "cancelled") throw new Error("JOB_CANCELLED");
    await db.from("bot_jobs").update({ events: [...((j?.events as any[]) ?? []), { step, at: now() }], heartbeat_at: now(), updated_at: now() }).eq("id", jobId);
  };
  // While the job runs, pulse the heartbeat every 30s so the cron sweeper never mistakes a
  // healthy long AI call for a dead job and re-runs it as a duplicate.
  const pulse = setInterval(() => {
    void db.from("bot_jobs").update({ heartbeat_at: now() }).eq("id", jobId).eq("status", "running").then(() => {});
  }, 30_000);
  try {
    const r: any = await runBotChat(db, job.user_id, job.input as BotChatData, emit);
    if (r?.cancelled) await db.from("bot_jobs").update({ status: "cancelled", updated_at: now() }).eq("id", jobId);
    else if (r?.error) await db.from("bot_jobs").update({ status: "failed", error: String(r.error), updated_at: now() }).eq("id", jobId);
    else await db.from("bot_jobs").update({ status: "done", result: { coins: r?.coins ?? 0, ms: r?.ms ?? 0, imageNotice: r?.imageNotice ?? "", questions: r?.questions ?? [], prompt: (job.input as BotChatData)?.prompt ?? "" }, updated_at: now() }).eq("id", jobId);
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "সার্ভারে সমস্যা হয়েছে";
    if (msg === "JOB_CANCELLED") await db.from("bot_jobs").update({ status: "cancelled", updated_at: now() }).eq("id", jobId);
    else await db.from("bot_jobs").update({ status: "failed", error: msg.slice(0, 500), updated_at: now() }).eq("id", jobId);
    return { ok: false, error: msg };
  } finally {
    clearInterval(pulse);
  }
}
