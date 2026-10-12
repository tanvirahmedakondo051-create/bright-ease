/** Screenshot QA: VPS agent renders each page (phone + desktop), a vision model spots visual bugs, one section-level fix pass. */
import { getAgent, agentCall } from "./deploy.server";
import { tagSections, SECTION_RULE, applySections } from "./context.server";

type Provider = { base_url: string; api_key: string; model: string; custom_headers?: any };
type Problem = { page: string; issue: string };

async function chat(p: Provider, messages: any[], maxTokens: number) {
  const r = await fetch(p.base_url.replace(/\/+$/, "") + "/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${p.api_key}`, "Content-Type": "application/json", ...((p.custom_headers as Record<string, string>) ?? {}) },
    body: JSON.stringify({ model: p.model, max_tokens: maxTokens, temperature: 0.2, messages }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) return null;
  const j: any = await r.json();
  return { text: String(j.choices?.[0]?.message?.content ?? ""), tokens: Number(j.usage?.total_tokens ?? 0) };
}

/** Returns null when QA is off or no agent is configured. Never throws. */
export async function screenshotQa(db: any, provider: Provider | undefined, html: string): Promise<{ html: string; tokens: number; summary: string } | null> {
  try {
    const { data: s } = await db.from("site_settings").select("qa_screenshots").eq("id", 1).maybeSingle();
    if (!s?.qa_screenshots || !provider) return null;
    const agent = await getAgent(db);
    if (!agent) return null;
    const pages = [...new Set([...html.matchAll(/data-page=["']([\w-]+)["']/g)].map((m) => m[1]))].slice(0, 6);
    const shot = await agentCall(agent, "/screenshot", { html, pages: pages.length ? pages : [""] }, undefined, 90_000);
    const shots: { page: string; device: string; jpg: string }[] = shot?.shots ?? [];
    if (!shots.length) return null;
    const parts: any[] = [{ type: "text", text: `Screenshots of a generated website (${shots.map((x) => `${x.page || "home"}/${x.device}`).join(", ")}). Find only REAL visual defects: blank or nearly empty page, broken layout, overlapping/cut-off text, unreadable contrast, broken image boxes, horizontal overflow on phone. Output ONLY JSON: {"problems":[{"page":"name","issue":"short English description"}]} — empty list if it looks fine.` }];
    for (const x of shots) parts.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${x.jpg}` } });
    const v = await chat(provider, [{ role: "user", content: parts }], 600);
    if (!v) return null;
    let tokens = v.tokens;
    let problems: Problem[] = [];
    try { problems = JSON.parse(v.text.slice(v.text.indexOf("{"), v.text.lastIndexOf("}") + 1)).problems ?? []; } catch { return { html, tokens, summary: "" }; }
    if (!problems.length) return { html, tokens, summary: "📸 স্ক্রিনশট চেক: কোনো সমস্যা নেই" };
    const tagged = tagSections(html);
    const fix = await chat(provider, [
      { role: "system", content: "You fix visual bugs in an existing website. Change as little as possible; keep the design." + SECTION_RULE },
      { role: "user", content: `PROBLEMS:\n${problems.map((p) => `- [${p.page || "home"}] ${p.issue}`).join("\n")}\n\nHTML:\n${tagged}` },
    ], 8000);
    if (!fix) return { html, tokens, summary: `📸 স্ক্রিনশট চেক: ${problems.length}টি সমস্যা পাওয়া গেছে, ঠিক করা যায়নি` };
    tokens += fix.tokens;
    const applied = applySections(tagged, fix.text);
    if (!applied) return { html, tokens, summary: `📸 স্ক্রিনশট চেক: ${problems.length}টি সমস্যা পাওয়া গেছে, ঠিক করা যায়নি` };
    return { html: applied.html, tokens, summary: `📸 স্ক্রিনশট চেক: ${problems.length}টি সমস্যা নিজে থেকে ঠিক করা হয়েছে` };
  } catch (e) {
    console.error("screenshot qa", e);
    return null;
  }
}
