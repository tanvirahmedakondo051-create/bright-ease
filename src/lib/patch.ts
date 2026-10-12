// Scoped-fix patch engine: exact match first, then whitespace-tolerant unique match.
export type PatchFile = { path: string; content: string };
export type Edit = { path: string; find: string; replace: string };

const norm = (s: string) => s.replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter((l) => l.length).join("\n");

function count(hay: string, needle: string) {
  let n = 0, i = 0;
  while ((i = hay.indexOf(needle, i)) >= 0) { n++; i += needle.length; }
  return n;
}

/** Replace `find` in `content`; returns null when not found or ambiguous. */
export function applyOne(content: string, find: string, replace: string): string | null {
  const c = count(content, find);
  if (c === 1) return content.replace(find, () => replace);
  if (c > 1) return null;
  // Whitespace-tolerant: compare trimmed non-empty lines.
  const target = norm(find).split("\n");
  if (!target.length || !target[0]) return null;
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const hits: [number, number][] = [];
  for (let s = 0; s < lines.length; s++) {
    if (lines[s].trim() !== target[0]) continue;
    let k = 0, e = s;
    while (e < lines.length && k < target.length) {
      const t = lines[e].trim();
      if (!t) { e++; continue; }
      if (t !== target[k]) break;
      k++; e++;
    }
    if (k === target.length) hits.push([s, e]);
  }
  if (hits.length !== 1) return null;
  const [s, e] = hits[0];
  // Re-indent replacement to the matched block's indentation.
  const indent = lines[s].match(/^\s*/)?.[0] ?? "";
  const rLines = replace.replace(/\r\n?/g, "\n").split("\n");
  const base = Math.min(...rLines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)![0].length), 1e9);
  const re = rLines.map((l) => (l.trim() ? indent + l.slice(base === 1e9 ? 0 : base) : l));
  return [...lines.slice(0, s), ...re, ...lines.slice(e)].join("\n");
}

export function applyEdits(files: PatchFile[], edits: Edit[]): { files: PatchFile[]; failed: Edit[] } {
  const out = files.map((f) => ({ ...f }));
  const failed: Edit[] = [];
  for (const e of edits) {
    const f = out.find((x) => x.path === e.path);
    if (!f) { out.push({ path: e.path, content: e.replace }); continue; }
    if (!e.find) { failed.push(e); continue; }
    const next = applyOne(f.content, e.find, e.replace);
    if (next === null) failed.push(e); else f.content = next;
  }
  return { files: out, failed };
}

/** Pull the JSON object out of a model reply (handles code fences / prose). */
export function extractJson(reply: string): any {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  for (const cand of [reply, fenced, reply.slice(reply.indexOf("{"), reply.lastIndexOf("}") + 1)]) {
    if (!cand) continue;
    try { return JSON.parse(cand.trim()); } catch { /* next */ }
  }
  return null;
}
