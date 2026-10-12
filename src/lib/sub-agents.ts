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
