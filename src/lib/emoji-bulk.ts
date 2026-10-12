// Parse a pasted premium emoji list: one "<emoji> - <numeric id>" per line. Last id wins per emoji.
export function parseEmojiList(text: string) {
  const map = new Map<string, string>();
  let invalid = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^(.+?)\s*[-–—:=]\s*(\d{5,30})$/);
    if (!m || /[A-Za-z0-9]/.test(m[1].trim())) { invalid++; continue; }
    map.set(m[1].trim(), m[2]);
  }
  return { items: [...map].map(([emoji, id]) => ({ emoji, id })), invalid };
}

/** Stable library key for a unicode emoji, e.g. "u.2764-fe0f-200d-1f525". */
export const emojiKey = (emoji: string) => "u." + [...emoji].map((c) => c.codePointAt(0)!.toString(16)).join("-");
