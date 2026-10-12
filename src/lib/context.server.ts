// Smart context + diff editing helpers for the AI builder.

type Block = { tag: string; start: number; end: number; label: string };

const BLOCK_TAGS = ["header", "nav", "section", "footer", "aside", "main", "style"];

function matchEnd(html: string, tag: string, from: number) {
  const re = new RegExp(`<(/?)${tag}\\b[^>]*>`, "gi");
  re.lastIndex = from;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return m.index + m[0].length;
  }
  return -1;
}

export function extractBlocks(html: string): Block[] {
  const out: Block[] = [];
  const re = new RegExp(`<(${BLOCK_TAGS.join("|")})\\b([^>]*)>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const tag = m[1].toLowerCase();
    if (tag === "main") continue; // look inside main
    const end = matchEnd(html, tag, m.index);
    if (end < 0) continue;
    const attrs = m[2];
    const id = attrs.match(/id=["']([^"']+)/i)?.[1] ?? "";
    const cls = attrs.match(/class=["']([^"']+)/i)?.[1] ?? "";
    const inner = html.slice(m.index, end);
    const h = inner.match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]?.replace(/<[^>]+>/g, "").trim().slice(0, 60) ?? "";
    out.push({ tag, start: m.index, end, label: [tag, id && `#${id}`, cls && `.${cls.split(/\s+/).slice(0, 2).join(".")}`, h && `"${h}"`].filter(Boolean).join(" ") });
    re.lastIndex = end; // skip nested blocks
  }
  return out;
}

export function outline(html: string) {
  return extractBlocks(html).map((b, i) => `${i + 1}. ${b.label} (${b.end - b.start} chars)`).join("\n");
}

const KEYWORDS: [RegExp, string[]][] = [
  [/হেডার|header|মেনু|menu|nav|লোগো|logo/i, ["header", "nav"]],
  [/হিরো|hero|ব্যানার|banner|শুরুর|top|উপরে/i, ["@first"]],
  [/ফুটার|footer|নিচে|কপিরাইট/i, ["footer"]],
  [/রং|রঙ|color|colour|ফন্ট|font|থিম|theme|ডিজাইন|style|স্টাইল/i, ["style"]],
  [/যোগাযোগ|contact|ফোন|ঠিকানা|ফর্ম|form/i, ["contact"]],
  [/দাম|প্রাইস|price|pricing|প্যাকেজ|প্ল্যান/i, ["pric", "plan", "package"]],
  [/সম্পর্কে|about|আমাদের কথা/i, ["about"]],
  [/সার্ভিস|সেবা|service|ফিচার|feature/i, ["service", "feature"]],
  [/গ্যালারি|gallery|ছবি|photo|image/i, ["gallery", "photo", "portfolio"]],
  [/রিভিউ|review|testimonial|মতামত/i, ["testimonial", "review"]],
  [/প্রশ্ন|faq/i, ["faq"]],
  [/মেনু আইটেম|খাবার|food|product|পণ্য|প্রোডাক্ট/i, ["menu", "product", "shop", "item"]],
  [/টিম|team|সদস্য/i, ["team"]],
];

/** Returns the relevant HTML snippets for the request, or the whole page when it is small or no match is found. */
export function relevantContext(html: string, prompt: string): { snippets: string[]; partial: boolean } {
  if (html.length < 6000) return { snippets: [html], partial: false };
  const blocks = extractBlocks(html);
  const picked = new Set<number>();
  for (const [re, keys] of KEYWORDS) {
    if (!re.test(prompt)) continue;
    blocks.forEach((b, i) => {
      for (const k of keys) {
        if (k === "@first") {
          const idx = blocks.findIndex((x) => x.tag === "section");
          if (idx >= 0) picked.add(idx);
        } else if (b.tag === k || b.label.toLowerCase().includes(k)) picked.add(i);
      }
    });
  }
  // Also match words from the prompt against section headings.
  const words = prompt.toLowerCase().split(/[\s,।.!?]+/).filter((w) => w.length >= 3);
  blocks.forEach((b, i) => { if (words.some((w) => b.label.toLowerCase().includes(w))) picked.add(i); });
  if (!picked.size) return { snippets: [html], partial: false };
  let total = 0;
  const snippets: string[] = [];
  for (const i of [...picked].sort((a, b) => a - b)) {
    const s = html.slice(blocks[i].start, blocks[i].end);
    if (total + s.length > 24000) break;
    total += s.length;
    snippets.push(s);
  }
  return { snippets, partial: true };
}

export const DIFF_RULE = `

EDIT MODE (MUST FOLLOW): Output ONLY the changed parts as search/replace blocks. Do NOT repeat unchanged code. No full HTML, no markdown fences, no explanation.
Format (repeat per change):
To add a new section, FIND a closing tag line near where it belongs and REPLACE it with that same line plus the new section.`;

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Applies FIND/REPLACE blocks. Returns null when nothing parsed or any block fails to match. */
export function applyPatches(html: string, text: string): { html: string; count: number } | null {
  const re = /<{5,}\s*FIND\s*\n([\s\S]*?)\n={5,}\s*\n([\s\S]*?)\n?>{5,}\s*REPLACE/g;
  let out = html;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const find = m[1];
    const repl = m[2];
    if (!find.trim()) return null;
    const idx = out.indexOf(find);
    if (idx >= 0) {
      out = out.slice(0, idx) + repl + out.slice(idx + find.length);
    } else {
      // whitespace-insensitive fallback: map normalized find onto original via regex
      const pattern = find.trim().split(/\s+/).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
      const r = new RegExp(pattern);
      const mm = r.exec(out);
      if (!mm || norm(mm[0]) !== norm(find)) return null;
      out = out.slice(0, mm.index) + repl + out.slice(mm.index + mm[0].length);
    }
    count++;
  }
  return count ? { html: out, count } : null;
}

/** Gives every top-level block (header/nav/section/footer/aside) a stable data-hx-id so edits can replace whole sections by ID. */
export function tagSections(html: string): string {
  const blocks = extractBlocks(html).filter((b) => b.tag !== "style");
  const used = new Set([...html.matchAll(/data-hx-id="(s\d+)"/g)].map((m) => m[1]));
  let n = 0;
  const next = () => { do n++; while (used.has(`s${n}`)); used.add(`s${n}`); return `s${n}`; };
  let out = html;
  for (const b of [...blocks].reverse()) {
    const open = out.slice(b.start, out.indexOf(">", b.start) + 1);
    if (/data-hx-id=/.test(open)) continue;
    out = out.slice(0, b.start) + open.replace(/^<(\w+)/, `<$1 data-hx-id="__ID__"`) + out.slice(b.start + open.length);
  }
  return out.replace(/data-hx-id="__ID__"/g, () => `data-hx-id="${next()}"`);
}

export const SECTION_RULE = `

EDIT MODE (MUST FOLLOW): Each block you get has a data-hx-id. Return ONLY the blocks you change, each complete and corrected, wrapped like:
<hx-section id="s3">
<section data-hx-id="s3" ...>...full corrected block...</section>
</hx-section>
To add a new block after an existing one: <hx-section id="new" after="s3">...new block...</hx-section>
To delete a block: <hx-section id="s4"></hx-section>
Keep the data-hx-id attribute. No full HTML, no markdown fences, no explanation.`;

/** Replaces whole blocks by data-hx-id. Returns null when nothing usable was returned. */
export function applySections(html: string, text: string): { html: string; count: number } | null {
  const re = /<hx-section\s+id="([\w-]+)"(?:\s+after="([\w-]+)")?\s*>([\s\S]*?)<\/hx-section>/g;
  let out = html, count = 0, m: RegExpExecArray | null;
  const find = (id: string) => {
    const open = new RegExp(`<(\\w+)\\b[^>]*data-hx-id="${id}"[^>]*>`).exec(out);
    if (!open) return null;
    const end = matchEnd(out, open[1].toLowerCase(), open.index);
    return end < 0 ? null : { start: open.index, end };
  };
  while ((m = re.exec(text))) {
    const [, id, after, body] = m;
    const content = body.trim();
    if (id === "new") {
      const loc = after ? find(after) : null;
      if (!loc || !content) continue;
      out = out.slice(0, loc.end) + "\n" + content + out.slice(loc.end);
    } else {
      const loc = find(id);
      if (!loc) continue;
      out = out.slice(0, loc.start) + content + out.slice(loc.end);
    }
    count++;
  }
  return count ? { html: out, count } : null;
}
