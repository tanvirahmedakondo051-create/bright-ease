// Pulls Telegram premium (custom) emoji IDs out of any bot code / text.
export type FoundEmoji = { key: string; id: string; fallback: string; style: "" | "primary" | "success" | "danger"; kind: "button" | "text" };

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9_.-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60);

export function extractPremiumEmojis(text: string): FoundEmoji[] {
  const out = new Map<string, FoundEmoji>();
  const seenIds = new Set<string>();
  const add = (key: string, id: string, extra: Partial<FoundEmoji> = {}) => {
    if (!/^\d{15,22}$/.test(id) || seenIds.has(id)) return;
    let k = slug(key) || "emoji";
    if (k.length < 2) k = `emoji.${k}`;
    let n = k, i = 2;
    while (out.has(n)) n = `${k}_${i++}`;
    seenIds.add(id);
    out.set(n, { key: n, id, fallback: extra.fallback || "🔹", style: extra.style || "", kind: n.startsWith("text.") ? "text" : "button" });
  };
  // 1) "key": "id" pairs (BUTTON_EMOJIS-like dicts)
  for (const m of text.matchAll(/["']([A-Za-z0-9_.-]{2,60})["']\s*:\s*["']?(\d{15,22})["']?/g)) add(m[1], m[2]);
  // 2) <tg-emoji emoji-id="id">X</tg-emoji>
  for (const m of text.matchAll(/<tg-emoji\s+emoji-id=["']?(\d{15,22})["']?>([^<]{0,8})<\/tg-emoji>/g)) add(`text.emoji_${seenIds.size + 1}`, m[1], { fallback: m[2].trim() });
  // 3) icon_custom_emoji_id / custom_emoji_id near a button text
  for (const m of text.matchAll(/(?:icon_custom_emoji_id|custom_emoji_id)\s*[=:]\s*["']?(\d{15,22})/g)) {
    const before = text.slice(Math.max(0, m.index! - 160), m.index!);
    const label = before.match(/text["']?\s*[=:]\s*f?["']([^"']{1,40})["'][^"']*$/)?.[1] ?? "";
    const style = (text.slice(m.index!, m.index! + 120).match(/style["']?\s*[=:]\s*["'](primary|success|danger)/)?.[1] ?? "") as FoundEmoji["style"];
    add(label ? `btn.${label.replace(/[^\p{L}\p{N} ]/gu, "").trim().replace(/\s+/g, "_")}` : `emoji_${seenIds.size + 1}`, m[1], { style });
  }
  // 4) any other bare long id
  for (const m of text.matchAll(/(?<!\d)(\d{17,20})(?!\d)/g)) add(`emoji_${seenIds.size + 1}`, m[1]);
  return [...out.values()];
}
