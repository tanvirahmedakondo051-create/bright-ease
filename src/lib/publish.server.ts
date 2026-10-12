import { createHash } from "node:crypto";

export const hashHtml = (s: string) => createHash("sha256").update(s).digest("hex");

function strip(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/\s+/g, " ").slice(0, 5000);
}

/** Ask the first allowed AI for a short Bangla changelog; falls back to a generic line. */
export async function makeChangelog(db: any, userId: string, oldHtml: string, newHtml: string): Promise<string> {
  if (!oldHtml) return "প্রথম প্রকাশ";
  if (oldHtml === newHtml) return "কোনো পরিবর্তন নেই";
  try {
    const { effectivePlan, allowedProviders } = await import("./plan.server");
    const prof = await effectivePlan(db, userId);
    const [p] = await allowedProviders(db, prof?.plans);
    if (!p) return "ওয়েবসাইট আপডেট";
    const r = await fetch(p.base_url.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${p.api_key}`, "Content-Type": "application/json", ...((p.custom_headers as Record<string, string>) ?? {}) },
      body: JSON.stringify({
        model: p.model,
        max_tokens: 200,
        temperature: 0.3,
        messages: [
          { role: "system", content: "Compare OLD and NEW website HTML. List 1-4 visible changes in very short Bangla phrases (e.g. 'হিরোতে নতুন বাটন', 'রং বদল'), one per line starting with '- '. Output only the list." },
          { role: "user", content: `OLD:\n${strip(oldHtml)}\n\nNEW:\n${strip(newHtml)}` },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) return "ওয়েবসাইট আপডেট";
    const j: any = await r.json();
    const t = String(j.choices?.[0]?.message?.content ?? "").trim().slice(0, 500);
    return t && !/<\w+/.test(t) ? t : "ওয়েবসাইট আপডেট";
  } catch {
    return "ওয়েবসাইট আপডেট";
  }
}

/** Snapshot html as a new live version. */
export async function pushLive(db: any, userId: string, proj: { id: string; published_html: string | null; published_version: number }, html: string) {
  const changelog = await makeChangelog(db, userId, proj.published_html ?? "", html);
  const version = (proj.published_version ?? 0) + 1;
  const { error: e1 } = await db.from("project_versions").insert({ project_id: proj.id, version_number: version, code_html: html, changelog_bn: changelog });
  if (e1) throw e1;
  const { error } = await db.from("projects").update({ published_html: html, published_code_hash: hashHtml(html), published_version: version, changes_since_publish: 0 }).eq("id", proj.id);
  if (error) throw error;
  return { version, changelog };
}
