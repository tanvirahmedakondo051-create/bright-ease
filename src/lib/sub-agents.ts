// Parallel sub-agent build: split a large approved bot plan into independent sections,
// let each AI call write one section, then merge them deterministically into one app.py.
import { parseFileBlocks } from "@/lib/file-blocks";

export type SectionKey = "core" | "user" | "admin";
export const SECTION_TITLES: Record<SectionKey, string> = {
  core: "Core — helpers, emoji, data, packaging",
  user: "User flow",
  admin: "Admin panel",
};

/** Split only big new builds from an approved plan that has both a user flow and an admin panel. */
export function shouldSplit(prompt: string, isFix: boolean) {
  if (isFix || !prompt.includes("APPROVED PLAN:")) return false;
  const plan = prompt.slice(prompt.indexOf("APPROVED PLAN:"));
  const hasAdmin = /admin|অ্যাডমিন|এডমিন/i.test(plan);
  let features = 0;
  try {
    const j = JSON.parse(plan.slice("APPROVED PLAN:".length).trim());
    features = (j?.features?.length ?? 0) + (j?.menus?.length ?? 0);
  } catch { features = (plan.match(/[,•\n-]/g) ?? []).length / 2; }
  return hasAdmin && features >= 6;
}

/** Short stable signature so a retried build reuses finished sections. */
export function promptSig(text: string) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36) + ":" + text.length;
}

const SECTION_FORMAT = `OUTPUT FORMAT — plain text, no markdown fences:
=== CODE ===
<python code for your section only: async handler functions and their small helpers>
=== END CODE ===
=== HANDLERS ===
<one python line per registration, e.g. app.add_handler(CallbackQueryHandler(admin_router, pattern=r"^adm:"))>
=== END HANDLERS ===`;

export function corePrompt() {
  return `You are the CORE sub-agent of a parallel team building ONE Telegram bot. Other agents will write the user flow and the admin panel IN PARALLEL using ONLY what you define, so be explicit.
Write the TOP of app.py: imports (MUST include: from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, KeyboardButton, ReplyKeyboardMarkup and from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, ContextTypes, filters — plus anything else handlers may need), logging, BOT_TOKEN = os.environ["BOT_TOKEN"], ADMIN_ID = int(os.environ["ADMIN_ID"]), BUTTON_EMOJIS/TEXT_EMOJIS/BUTTON_STYLES, emoji+keyboard helpers (ik_btn, rk_btn, pe, etc.), data.json load/save helpers and default data shape, is_admin guard, shared formatting helpers.
Do NOT write handlers, do NOT write register_handlers, main() or run_polling — those are added by the integrator.
End app.py with a comment block:
# === CONTRACT ===
# helper signatures, data keys, callback prefixes: user flow uses "u:" ; admin panel uses "adm:" ; emoji keys available
Also return complete requirements.txt (python-telegram-bot>=22.7) and README.md (Hexa Boost Panel steps, main file app.py).
Use the usual === FILE: path === blocks for app.py, requirements.txt and README.md.`;
}

export function sectionPrompt(key: "user" | "admin", core: string) {
  const job = key === "user"
    ? `Write ONLY the USER-facing flow from the plan (start/help, reply menu, browsing, cart/orders or whatever the plan lists). All user callback_data MUST start with "u:". Do not write admin features.`
    : `Write ONLY the ADMIN panel from the plan: nested INLINE-only Admin Home -> submenus -> Back, every action guarded by is_admin. All admin callback_data MUST start with "adm:". Include an /admin command. Do not write user features.`;
  return `You are a sub-agent in a parallel team building ONE Telegram bot app.py. ${job}
Use ONLY the helpers, names and data keys defined in the CORE code below — never redefine them, never re-import config, never write main()/run_polling.
Function names must be prefixed with "${key}_" to avoid clashes. Text MessageHandlers must use precise filters (no catch-all that would swallow the other section).
${SECTION_FORMAT}

CORE CODE (already written, read-only):
${core}`;
}

export type SectionOut = { code: string; handlers: string[] };

export function parseSection(text: string): SectionOut | null {
  const t = text.replace(/\r\n?/g, "\n");
  const code = t.match(/===\s*CODE\s*===\n([\s\S]*?)\n\s*===\s*END CODE\s*===/i)?.[1];
  const hs = t.match(/===\s*HANDLERS\s*===\n([\s\S]*?)\n\s*===\s*END HANDLERS\s*===/i)?.[1];
  if (!code || !hs) return null;
  const handlers = hs.split("\n").map((l) => l.trim().replace(/^```\w*|```$/g, "").trim()).filter((l) => /^app\.add_(handler|error_handler)\(/.test(l));
  return { code: code.replace(/^```\w*\n|\n?```\s*$/g, "").trim(), handlers };
}

export function parseCore(text: string) {
  const fb = parseFileBlocks(text);
  const app = fb.files.find((f) => f.path === "app.py" || f.path === "bot.py")?.content ?? "";
  return { app: app.trim(), others: fb.files.filter((f) => f.path !== "app.py" && f.path !== "bot.py"), summary: fb.sections.summary ?? "", unclosed: fb.unclosed };
}

/** Function names defined more than once across the merged sections. */
export function duplicateDefs(code: string) {
  const seen = new Map<string, number>();
  for (const m of code.matchAll(/^(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(/gm)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
  return [...seen].filter(([, n]) => n > 1).map(([k]) => k);
}

/** Merge: core -> admin -> user -> register_handlers (admin first so its patterns win) -> main. */
export function mergeSections(core: string, admin: SectionOut, user: SectionOut) {
  const handlers = [...new Set([...admin.handlers, ...user.handlers])];
  const errorHandlers = handlers.filter((h) => h.startsWith("app.add_error_handler"));
  const normal = handlers.filter((h) => !h.startsWith("app.add_error_handler"));
  return `${core}


# ===================== ADMIN PANEL =====================
${admin.code}


# ===================== USER FLOW =====================
${user.code}


def register_handlers(app):
${[...normal, ...errorHandlers.slice(0, 1)].map((h) => "    " + h).join("\n") || "    pass"}


async def _hexa_started(app):
    me = await app.bot.get_me()
    print(f"✅ Bot started — @{me.username}")


def main():
    app = Application.builder().token(BOT_TOKEN).post_init(_hexa_started).build()
    register_handlers(app)
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
`;
}

// ---------------- Parallel UPGRADE of an existing sectioned app.py ----------------

const ADMIN_MARK = "# ===================== ADMIN PANEL =====================";
const USER_MARK = "# ===================== USER FLOW =====================";

export type AppSections = { core: string; admin: string; user: string; tail: string };

/** Split an app.py produced by mergeSections back into its parts. null = not splittable. */
export function splitExistingApp(src: string): AppSections | null {
  const a = src.indexOf(ADMIN_MARK), u = src.indexOf(USER_MARK);
  const t = src.search(/^def register_handlers\(app\):/m);
  if (a < 0 || u < a || t < u) return null;
  return { core: src.slice(0, a).trimEnd(), admin: src.slice(a + ADMIN_MARK.length, u).trim(), user: src.slice(u + USER_MARK.length, t).trim(), tail: src.slice(t).trim() };
}

/** Upgrades run in parallel only on big bots that already have the section layout; never on crash-log fixes. */
export function shouldSplitUpgrade(src: string, hasErrorLog: boolean) {
  return !hasErrorLog && src.split("\n").length >= 800 && !!splitExistingApp(src);
}

const defs = (code: string) => [...code.matchAll(/^(?:async\s+)?def\s+\w+\s*\([^)]*\)/gm)].map((m) => m[0]).join("\n");

export function upgradePrompt(key: "core" | "user" | "admin", s: AppSections) {
  const own = key === "core" ? s.core : key === "user" ? s.user : s.admin;
  const role = key === "core"
    ? "the CORE section (imports, config, BUTTON_EMOJIS/TEXT_EMOJIS/BUTTON_STYLES, helpers, data). Other agents update the user and admin sections after you, using your helpers."
    : `the ${key.toUpperCase()} section. Use only helpers from the CORE code below; never redefine them.`;
  const ctx = key === "core"
    ? `OTHER SECTIONS (function signatures only):\n${defs(s.admin)}\n${defs(s.user)}`
    : `CORE CODE (read-only):\n${s.core}\n\nOTHER SECTION SIGNATURES (read-only):\n${defs(key === "user" ? s.admin : s.user)}`;
  return `You are one of 3 parallel sub-agents UPGRADING an existing Telegram bot app.py. You own ONLY ${role}
Apply the user's requested change to YOUR section only. Keep every existing function, callback_data, command, button and text unless the user asked to change it. Never write main(), register_handlers or run_polling.
If your section needs no change, reply with exactly: === UNCHANGED ===
Otherwise reply (plain text, no markdown fences):
=== CODE ===
<the COMPLETE updated section — never partial, never "# ... unchanged" placeholders>
=== END CODE ===
=== HANDLERS ===
<ONLY brand-new app.add_handler(...) lines, if any; leave empty otherwise>
=== END HANDLERS ===
=== CHANGES ===
<one short Bangla line per change>
=== END CHANGES ===

YOUR CURRENT SECTION:
${own}

${ctx}`;
}

export type UpgradeOut = { unchanged: true } | { unchanged: false; code: string; handlers: string[]; changes: string };

export function parseUpgrade(text: string): UpgradeOut | null {
  const t = text.replace(/\r\n?/g, "\n");
  if (/^\s*===\s*UNCHANGED\s*===\s*$/i.test(t.trim().split("\n")[0] ?? "") && !/===\s*CODE\s*===/i.test(t)) return { unchanged: true };
  const code = t.match(/===\s*CODE\s*===\n([\s\S]*?)\n\s*===\s*END CODE\s*===/i)?.[1];
  if (!code) return null;
  const hs = t.match(/===\s*HANDLERS\s*===\n?([\s\S]*?)\n?\s*===\s*END HANDLERS\s*===/i)?.[1] ?? "";
  const changes = t.match(/===\s*CHANGES\s*===\n?([\s\S]*?)\n?\s*===\s*END CHANGES\s*===/i)?.[1]?.trim() ?? "";
  const handlers = hs.split("\n").map((l) => l.trim()).filter((l) => /^app\.add_handler\(/.test(l));
  return { unchanged: false, code: code.replace(/^```\w*\n|\n?```\s*$/g, "").trim(), handlers, changes };
}

/** Re-join upgraded sections; new handler lines go at the top of register_handlers so specific patterns win. */
export function mergeUpgrade(s: AppSections, out: { core?: UpgradeOut; admin?: UpgradeOut; user?: UpgradeOut }) {
  const pick = (o: UpgradeOut | undefined, old: string) => (o && !o.unchanged ? o.code : old);
  const added = [...new Set([out.admin, out.user, out.core].flatMap((o) => (o && !o.unchanged ? o.handlers : [])))].filter((h) => !s.tail.includes(h));
  const tail = added.length ? s.tail.replace(/^def register_handlers\(app\):\n/m, (m) => m + added.map((h) => "    " + h).join("\n") + "\n") : s.tail;
  return `${pick(out.core, s.core)}


${ADMIN_MARK}
${pick(out.admin, s.admin)}


${USER_MARK}
${pick(out.user, s.user)}


${tail}
`;
}

/** True when an upgrade-agent reply opened === CODE === but never closed it (reply was cut off). */
export function upgradeCutOff(text: string) {
  return /===\s*CODE\s*===/i.test(text) && !/===\s*END CODE\s*===/i.test(text);
}

export type FlowSpec = { screens: { id: string; title?: string; text?: string; buttons?: { label: string; emoji?: string; style?: string; goes_to?: string }[][] }[] };

/** Bangla list shown in chat + strict blueprint text for the AI. */
export function flowToText(f: FlowSpec) {
  return f.screens.map((s, i) => `স্ক্রিন ${i + 1} (${s.id}${s.title ? " — " + s.title : ""}):` + (s.text ? `\n  লেখা: ${s.text.slice(0, 200)}` : "") +
    (s.buttons ?? []).map((row, r) => `\n  সারি ${r + 1}: ` + row.map((b) => `${b.emoji ? b.emoji + " " : ""}${b.label}${b.goes_to ? " → " + b.goes_to : ""}${b.style ? ` [${b.style}]` : ""}`).join(" | ")).join("")).join("\n");
}
