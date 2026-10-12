// Plain-text output format for AI-generated files: code is never embedded inside JSON.
//   === FILE: bot.py ===  ...  === END FILE ===
//   === SUMMARY === ... === END SUMMARY ===   (also BRAIN / CHANGES)
export type Block = { path: string; content: string };

const OPEN = /^\s*===\s*(FILE:\s*(.+?)|SUMMARY|BRAIN|CHANGES)\s*===\s*$/i;
const CLOSE = /^\s*===\s*END(\s+(FILE|SUMMARY|BRAIN|CHANGES))?\s*===\s*$/i;

export function parseFileBlocks(text: string): { files: Block[]; sections: Record<string, string>; unclosed: boolean } {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const files: Block[] = [];
  const sections: Record<string, string> = {};
  let cur: { kind: string; path?: string; buf: string[] } | null = null;
  for (const line of lines) {
    if (cur) {
      if (CLOSE.test(line)) {
        const body = stripFence(cur.buf.join("\n"));
        if (cur.kind === "file" && cur.path) files.push({ path: cur.path, content: body.replace(/\s+$/, "") + "\n" });
        else sections[cur.kind] = body.trim();
        cur = null;
        continue;
      }
      const nested = line.match(OPEN);
      if (!nested) { cur.buf.push(line); continue; }
      // A new block began without closing the previous one: treat the previous as unclosed.
      return { files, sections, unclosed: true };
    }
    const m = line.match(OPEN);
    if (m) cur = m[2] ? { kind: "file", path: m[2].trim().replace(/^[`"']|[`"']$/g, ""), buf: [] } : { kind: m[1].toLowerCase(), buf: [] };
  }
  return { files, sections, unclosed: !!cur };
}

/** True when the text opened a block that never closed (reply was cut off). */
export const hasUnclosedBlock = (text: string) => parseFileBlocks(text).unclosed;

function stripFence(s: string) {
  const t = s.replace(/^\n+/, "");
  const m = t.match(/^```[\w-]*\n([\s\S]*?)\n?```\s*$/);
  return m ? m[1] : t;
}
