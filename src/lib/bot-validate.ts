/** Static release checks for a generated Telegram bot. Pure — safe for client and server. */
export type Check = { id: string; label: string; ok: boolean };

const TOKEN_RE = /\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/;

export function validateBot(appPy: string, requirements: string): Check[] {
  const py = appPy || "";
  const startHandler = /CommandHandler\(\s*["']start["']/.test(py);
  const keyboard = /(InlineKeyboardMarkup|ReplyKeyboardMarkup)/.test(py);
  const labels = [...py.matchAll(/(?:rk_btn|KeyboardButton)\(\s*["']([^"']{2,40})["']/g)].map((m) => m[1].trim());
  const unrouted = labels.filter((l) => {
    const core = l.replace(/^[^\p{L}\p{N}]+/u, "").split(/\s+/)[0];
    return core && py.split(core).length < 3; // label text should appear again in routing
  });
  const adminCheck = /ADMIN_ID/.test(py) && /(==\s*ADMIN_ID|ADMIN_ID\s*==|in\s+ADMIN|is_admin\()/.test(py);
  const noSecrets = !TOKEN_RE.test(py) && !/BOT_TOKEN\s*=\s*["'][^"']+["']/.test(py) && !/ADMIN_ID\s*=\s*\d/.test(py);
  const ptb = /python-telegram-bot(\[[^\]]*\])?\s*>=\s*(22\.(7|[89]|\d{2})|2[3-9]|[3-9]\d)/i.test(requirements || "");
  return [
    { id: "start", label: "/start কীবোর্ড পাঠায়", ok: startHandler && keyboard },
    { id: "menu", label: "মেনুর বাটনগুলো সঠিক জায়গায় যায়", ok: unrouted.length === 0 },
    { id: "admin", label: "অ্যাডমিন শুধু ADMIN_ID-এর জন্য", ok: adminCheck },
    { id: "secrets", label: "ফাইলে কোনো টোকেন/গোপন তথ্য নেই", ok: noSecrets },
    { id: "ptb", label: "python-telegram-bot>=22.7", ok: ptb },
  ];
}

export const failedChecks = (c: Check[]) => c.filter((x) => !x.ok);

export function checklistText(c: Check[]) {
  const bad = failedChecks(c);
  const head = bad.length ? "⚠ যাচাই সম্পূর্ণ হয়নি" : "✅ সব যাচাই পাস করেছে";
  return `\n\n${head}\n${c.map((x) => `${x.ok ? "✓" : "✗"} ${x.label}`).join("\n")}`;
}

/** Strip anything that looks like a secret from brain text before saving. */
export function sanitizeBrain(s: string) {
  return s.replace(TOKEN_RE, "[token]").replace(/\b(sk|sb|ghp|xox)[-_][A-Za-z0-9_-]{10,}/g, "[key]");
}
