import { sanitizeBrain } from "./bot-validate";
// Telegram bot studio: AI writes Python bots; users download a ZIP or run a 5-minute test on the VPS agent.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MAX_OUTPUT_TOKENS = 32000;
export const FILE_FORMAT = `OUTPUT FORMAT — plain text, NOT JSON, no markdown fences:
=== SUMMARY ===
short Bangla summary
=== END SUMMARY ===
=== FILE: app.py ===
<complete file content>
=== END FILE ===
(repeat the FILE block for each file you return)`;

export type BotFile = { path: string; content: string };
export type BotPlan = { summary: string; menus: string[]; features: string[]; files: string[]; acceptance: string[] };
export type BotMsg = { role: "user" | "assistant"; content: string; mode: "chat" | "plan" | "build" | "fix"; at: string; plan?: BotPlan; coins?: number; ms?: number };
type BotQuestion = { q: string; options: string[] };
type BotAnswer = { question: string; answer: string };

const TEMP_MINUTES = 5;
export const MAIN_FILE = "app.py";
export const ALLOWED_FILES = [MAIN_FILE, "requirements.txt", "README.md"];
export const CHAT_DAILY_CAP = 50;
/** Older bots used bot.py; the Hexa Boost Panel package uses app.py. */
export const normalizeFiles = (list: BotFile[]) => {
  const hasApp = list.some((f) => f.path === MAIN_FILE);
  return list.filter((f) => !(hasApp && f.path === "bot.py")).map((f) => (f.path === "bot.py" ? { ...f, path: MAIN_FILE } : f));
};
export const CHAT_RULES = `You are Hexa AI in CHAT / ERROR DEBUG mode for a Telegram Python bot studio. This mode is FREE and advise-only.
HARD RULES: never write, patch or output a full fixed file; at most a 1-5 line illustrative snippet. Reply in simple Bangla (English terms ok).
Hosting is called "Hexa Boost Panel" — NEVER name the underlying panel software (no "Pterodactyl" or similar). Panel flow: upload ZIP, startup file app.py, pip install -r requirements.txt, env BOT_TOKEN/ADMIN_ID set in panel, Start, read Console.
Analyze the log/screenshot carefully. Many problems are NOT code bugs: wrong/missing BOT_TOKEN or ADMIN_ID, server not started, wrong main file, requirements not installed, offline/resource limit, Telegram flood/invalid token/network (Conflict: terminated by other getUpdates = bot running twice), info/warning lines that are not fatal.
- If not a code bug: start with "এটা কোড বাগ নয়" and give exact numbered steps.
- If a real code bug: start with "কোডে সম্ভাব্য বাগ আছে", explain briefly which part of app.py is wrong.
End your reply with exactly one line "VERDICT: code_bug" or "VERDICT: not_code". If code_bug, add a final line "FIX_BRIEF: <one English paragraph describing the exact scoped fix>".`;
const TODAY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function limitReached(value: number, limit: unknown) {
  const cap = Number(limit ?? -1);
  return cap >= 0 && value >= cap;
}

export async function usageToday(db: any, userId: string) {
  const { data } = await db.from("bot_usage_daily").select("ai_messages, fix_requests, temp_host_minutes, builds").eq("user_id", userId).eq("usage_date", TODAY()).maybeSingle();
  return data ?? { ai_messages: 0, fix_requests: 0, temp_host_minutes: 0, builds: 0 };
}

export async function addUsage(db: any, userId: string, patch: { ai_messages?: number; fix_requests?: number; temp_host_minutes?: number; builds?: number }) {
  const day = TODAY();
  const current = await usageToday(db, userId);
  await db.from("bot_usage_daily").upsert({
    user_id: userId,
    usage_date: day,
    ai_messages: current.ai_messages + (patch.ai_messages ?? 0),
    fix_requests: current.fix_requests + (patch.fix_requests ?? 0),
    temp_host_minutes: current.temp_host_minutes + (patch.temp_host_minutes ?? 0),
    builds: current.builds + (patch.builds ?? 0),
  }, { onConflict: "user_id,usage_date" });
}

export function extractGeneratedEmojis(code: string) {
  const found: Record<string, string> = {};
  const buttonBlock = code.match(/BUTTON_EMOJIS\s*=\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  for (const match of buttonBlock.matchAll(/["']([a-z0-9_.-]{2,60})["']\s*:\s*["'](\d{5,30})["']/gi)) found[match[1]] = match[2];
  const textBlock = code.match(/TEXT_EMOJIS\s*=\s*\{([\s\S]*?)\}/)?.[1] ?? "";
  for (const match of textBlock.matchAll(/["']([a-z0-9_.-]{2,60})["']\s*:\s*[\[(]\s*["'](\d{5,30})["']/gi)) found[match[1].startsWith("text.") ? match[1] : `text.${match[1]}`] = match[2];
  return found;
}

export async function mergeButtonEmojis(db: any, code: string, current: Record<string, string>) {
  const extracted = extractGeneratedEmojis(code);
  if (!Object.keys(extracted).length) return;
  const ids = new Set(Object.values(current).filter(Boolean));
  const merged = { ...current };
  for (const [key, id] of Object.entries(extracted)) {
    if (!id || key in merged) continue;
    merged[key] = id;
    ids.add(id);
  }
  if (Object.keys(merged).length !== Object.keys(current).length) await db.from("site_settings").update({ button_emojis: merged }).eq("id", 1);
}

export const DEFAULT_STYLES: Record<string, string> = { "main.": "primary", "admin.": "primary", "action.next": "primary", "action.approve": "success", "action.confirm": "success", "action.add": "success", "action.yes": "success", "action.reject": "danger", "action.cancel": "danger", "action.back": "danger", "action.delete": "danger", "action.no": "danger" };

/** Normal emoji mode: same helpers and colours, but no premium icons anywhere. */
export const NORMAL_MODE_RULE = `- EMOJI_MODE = "normal": keep ik_btn/rk_btn, BUTTON_STYLES, DEFAULT_STYLES and style_for exactly as above (colours stay ON), but set every BUTTON_EMOJIS/TEXT_EMOJIS id to "" and EMOJI_LIBRARY = {}, NEVER set icon_custom_emoji_id and never emit <tg-emoji>; buttons show their normal unicode fallback emoji.`;

const STANDARD_KEYS = ["main.shop", "main.cart", "main.orders", "main.support", "main.profile", "main.help", "admin.panel", "admin.dashboard", "admin.products", "admin.orders", "admin.users", "admin.broadcast", "admin.settings", "admin.emoji", "admin.hexa", "action.back", "action.approve", "action.reject", "action.cancel", "action.next", "action.add"];

export function rules(emojis: Record<string, string>, meta: Record<string, any> = {}) {
  const buttonIds: Record<string, string> = {}, styles: Record<string, string> = {}, fallbacks: Record<string, string> = {}, textIds: Record<string, [string, string]> = {}, library: Record<string, string> = {};
  for (const [k, id] of Object.entries(emojis)) {
    const m = meta[k] ?? {};
    if (m.fallback && id && m.fallback !== "🔹") library[m.fallback] = id;
    if (k.startsWith("u.")) continue;
    if (k.startsWith("text.") || m.kind === "text") { textIds[k.slice(5) || k] = [id, m.fallback || "🔹"]; continue; }
    buttonIds[k] = id; if (m.style) styles[k] = m.style; fallbacks[k] = m.fallback || "🔹";
  }
  for (const k of STANDARD_KEYS) if (!(k in buttonIds)) buttonIds[k] = "";
  return `OUTPUT STANDARD (always follow):
- Files: EXACTLY app.py (main/startup file), requirements.txt, README.md. Package is uploaded to Hexa Boost Panel (never name the underlying panel software). NEVER create .env or .env.example. NEVER write tokens, ids or secrets into any file.
- Python 3.10+, python-telegram-bot>=22.7 in requirements.txt (Application, async handlers, application.run_polling(allowed_updates=Update.ALL_TYPES)). Use ONLY documented methods/fields from https://core.telegram.org/bots/api and https://core.telegram.org/bots/api-changelog (Bot API 10.3 features allowed). On start print exactly "Bot started successfully" to the console.
- Config ONLY via os.environ: BOT_TOKEN = os.environ["BOT_TOKEN"], ADMIN_ID = int(os.environ["ADMIN_ID"]). No python-dotenv.
- Storage data.json (safe load/save helpers, created if missing; ATOMIC save: write data.json.tmp then os.replace). Keep settings under data["settings"]. Use MongoDB/Postgres ONLY if the user explicitly asks for it.
- MENU ROUTING (must work): ONE MessageHandler(filters.TEXT & ~filters.COMMAND) routes all bottom-menu labels by SUBSTRING match of the label words (e.g. if "দোকান" in text), so emoji/premium prefixes never break it. Register it in an earlier group than any admin catch-all text handler so nothing blocks it. Log print(f"RAW_TEXT: {text!r}") and print(f"MENU_ACTION: {action}") for every routed message.
- Admin panel = nested inline menus (Home → section → Back), never one wall of buttons.
- README must note: one bot token = one running copy — stop the 5-minute test before starting the bot on Hexa Boost Panel.
- Always /start, /help, inline keyboard menus, admin-only commands guarded by ADMIN_ID, a global error handler, logging. Bangla text for users unless asked otherwise.
- PREMIUM EMOJI + BUTTON COLOUR SYSTEM (mandatory, Telegram Bot API InlineKeyboardButton fields icon_custom_emoji_id and style):
  BUTTON_EMOJIS = ${JSON.stringify(buttonIds)}
  BUTTON_STYLES = ${JSON.stringify(styles)}   # "primary"=blue, "success"=green, "danger"=red
  DEFAULT_STYLES = ${JSON.stringify(DEFAULT_STYLES)}   # prefix -> colour, used when no explicit style
  EMOJI_LIBRARY = ${JSON.stringify(library)}   # unicode emoji -> premium custom_emoji_id (platform library)
  FALLBACK_EMOJIS = ${JSON.stringify(fallbacks)}
  TEXT_EMOJIS = ${JSON.stringify(textIds)}   # name -> [custom_emoji_id, fallback]
  Store in data.json: data["settings"]["button_emojis"] = {key: id}. Keys are stable strings (main.*, action.*, admin.*); values are numeric Telegram custom emoji id strings only. Only include the keys this bot actually uses.
  REQUIRED helpers in app.py (exactly this behaviour):
    def button_emoji(key: str) -> str | None:
        data = load_data()
        em = (data.get("settings") or {}).get("button_emojis") or {}
        val = em.get(key) or BUTTON_EMOJIS.get(key)
        if val and str(val).isdigit():
            return str(val)
        return None
    def _btn_kwargs(text, key, style):
        eid = button_emoji(key) if key else None
        kw = dict(text=text)
        if eid:
            kw["icon_custom_emoji_id"] = eid   # premium icon: NO leading unicode emoji on text
        elif key and FALLBACK_EMOJIS.get(key):
            kw["text"] = f"{FALLBACK_EMOJIS[key]} {text}"
        st = style or (data_style(key) if key else None) or style_for(key)   # data["settings"]["button_styles"] or BUTTON_STYLES, else DEFAULT_STYLES
        if st in ("primary", "success", "danger"):
            kw["style"] = st
        return kw
    def ik_btn(text, callback_data, key=None, style=None):
        """InlineKeyboardButton with premium icon + colour"""
        from telegram import InlineKeyboardButton
        return InlineKeyboardButton(callback_data=callback_data, **_btn_kwargs(text, key, style))
    def rk_btn(text, key=None, style=None):
        """Reply KeyboardButton (bottom Menu) with premium icon + colour"""
        from telegram import KeyboardButton
        return KeyboardButton(**_btn_kwargs(text, key, style))
    def style_for(key):
        # longest matching DEFAULT_STYLES prefix, e.g. "action.back" -> "danger", "main." -> "primary"
        k = key or ""
        best = max((p for p in DEFAULT_STYLES if k.startswith(p)), key=len, default=None)
        return DEFAULT_STYLES.get(best) if best else "primary"
  BUTTON COLOUR IS ALWAYS ON: every important inline and reply-menu button gets a style — main/nav "primary", approve/confirm/add "success", reject/cancel/back/delete "danger". Never ship grey/default buttons.
  UNICODE -> PREMIUM MATCHING: when a button key has no id but its label/fallback emoji exists in EMOJI_LIBRARY, use that library id as the button's icon_custom_emoji_id (and drop the unicode prefix). Same for message emojis via pe().
  Bot API 9.4+ fields icon_custom_emoji_id and style work on BOTH InlineKeyboardButton and KeyboardButton. Unicode emoji in text alone is NOT a premium icon.
  EVERY inline button uses ik_btn(...) with a key: InlineKeyboardMarkup([[ik_btn(...), ...], ...]). EVERY bottom Menu button uses rk_btn(...) with a key: ReplyKeyboardMarkup([[rk_btn(...), ...]], resize_keyboard=True). Reply-menu taps are matched in a MessageHandler by the plain label text (compare after stripping any fallback emoji prefix) — keep a LABEL->action map.
  BUTTON_EMOJIS must ALWAYS contain these standard keys (value "" when no ID): ${STANDARD_KEYS.join(", ")}.
  Messages: parse_mode="HTML"; pe(name) returns '<tg-emoji emoji-id="ID">FALLBACK</tg-emoji>' (or the fallback when ID empty) from TEXT_EMOJIS. In premium mode EVERY meaningful emoji-bearing heading, status, alert, success/error confirmation and menu description must use pe(); do not leave a mixture where only a few message emojis are premium.
  COMPLETENESS CHECK before returning code: inspect every InlineKeyboardButton, KeyboardButton and emoji-bearing message. Every user/admin button must go through ik_btn/rk_btn with a stable key and purpose-appropriate style; every eligible message emoji must go through pe(). No direct constructor may bypass these helpers.
- PROFESSIONAL NESTED ADMIN PANEL (admin-only via ADMIN_ID, callback prefix "adm:"): Admin Panel (admin.panel) → Dashboard (admin.dashboard: user/order counts), Products (admin.products), Orders (admin.orders), Users (admin.users), Broadcast (admin.broadcast), Settings (admin.settings) → Emoji Settings (admin.emoji). ALL admin screens, submenus, prompts, pagination, confirmations, Back/Cancel controls and settings controls use InlineKeyboardMarkup/ik_btn ONLY—NEVER ReplyKeyboardMarkup, KeyboardButton or a bottom menu in an admin flow. Every sub-screen has a Back (action.back) button to its parent; edit the same message (edit_message_text) instead of sending new ones. Paginate every potentially long Products/Orders/Users list. Require inline Yes/No confirmation before destructive actions and broadcasts. Include only sections relevant to the bot, but always Dashboard, Broadcast, Settings, Emoji Settings.
- Emoji Settings: EMOJI_LABELS dict lists ALL button keys used by this bot with readable names, paginated inline list; admin taps a key -> shows current id + colour; options: "Change emoji" (admin sends a message containing a premium emoji: read message.entities of type custom_emoji -> custom_emoji_id, or a plain numeric id), "Colour" (Blue/Green/Red/None buttons), "Reset default". Save to data["settings"]["button_emojis"][key] and data["settings"]["button_styles"][key]; changes apply instantly (rebuild menus) without restart. Also "Bulk paste" option: admin sends lines like "❤️‍🔥 - 6314409378971657327" (one per line); parse "<emoji> - <digits>", last id wins, report added/updated and invalid line counts, store in data["settings"]["emoji_library"] {unicode: id} and use it for unicode->premium matching. Applies to BOTH inline and reply-menu buttons on next render. If EMOJI_MODE is "normal", Emoji Settings shows: "প্রিমিয়াম আইকন চালু করতে Emoji mode = Premium করুন".
- README.md (Bangla): what the bot does, commands, then these steps: 1. Hexa Boost Panel-এ ZIP আপলোড 2. Main/startup file: app.py 3. Environment: BOT_TOKEN, ADMIN_ID 4. Start → Console দেখুন. Permanent hosting: https://hexahoster.xyz
- No website, no HTML — only Telegram bot code.`;
}

// The agent runs app.py; a tiny bot.py shim keeps older agents (which look for bot.py) working.
const testFiles = (list: BotFile[]) => { const f = normalizeFiles(list); return [...f, { path: "bot.py", content: 'import runpy\nrunpy.run_path("app.py", run_name="__main__")\n' }]; };

export const cleanFiles = (list: BotFile[]) => list.filter((f) => ALLOWED_FILES.includes(f.path));

export async function loadOwned(db: any, userId: string, botId: string) {
  const { data: bot } = await db.from("bots").select("*").eq("id", botId).single();
  if (!bot || bot.user_id !== userId) throw new Error("বট পাওয়া যায়নি");
  return bot;
}

export function botType(text: string) {
  if (/shop|store|দোকান|শপ|cart|কার্ট|product|প্রোডাক্ট|order|অর্ডার/i.test(text)) return "shop";
  if (/support|ticket|সাপোর্ট|টিকেট|help ?desk/i.test(text)) return "support";
  return "other";
}

/** After a successful build, remember its proven structure so the next similar bot starts from it. */
export async function savePattern(db: any, prompt: string, code: string, emojiMode: string) {
  if (!code) return;
  const uniq = (a: string[]) => [...new Set(a)].slice(0, 40);
  const keys = uniq([...code.matchAll(/["']((?:main|admin|action)\.[a-z0-9_.]+)["']/g)].map((m) => m[1]));
  const sections = uniq([...code.matchAll(/["']adm:([a-z_]+)/g)].map((m) => m[1]));
  const styleMap: Record<string, string> = {};
  for (const m of code.matchAll(/["']((?:main|admin|action)\.[a-z0-9_.]+)["']\s*:\s*["'](primary|success|danger)["']/g)) styleMap[m[1]] = m[2];
  const emojiMap: Record<string, string> = {};
  for (const m of code.matchAll(/["']((?:main|admin|action)\.[a-z0-9_.]+)["']\s*:\s*["'](\d{5,30})["']/g)) emojiMap[m[1]] = m[2];
  const flows: string[] = [];
  if (/cart|কার্ট/i.test(code) && /checkout|চেকআউট/i.test(code)) flows.push("category→product→cart→checkout");
  if (sections.length >= 3) flows.push("admin nested (Home → submenus → Back)");
  if (/emoji_library|Bulk paste/i.test(code)) flows.push("admin emoji settings with bulk paste");
  const quality = Math.min(5, 1 + (keys.length >= 10 ? 1 : 0) + (sections.length >= 4 ? 1 : 0) + (Object.keys(styleMap).length >= 5 ? 1 : 0) + (code.split("\n").length >= 800 ? 1 : 0));
  const type = botType(prompt);
  const pattern = { type, emoji_mode: emojiMode, flows, menu_keys: keys, admin_sections: sections, button_style_map: styleMap, emoji_map: emojiMap, pitfalls: [] as string[], quality_score: quality };
  pattern.flows = pattern.flows.map(sanitizeBrain);
  await db.from("bot_brain").insert({ source: "build", kind: "pattern", bot_type: type, pattern, quality, symptom: `${type} bot pattern`, fix_summary: flows.join("; ").slice(0, 300) });
}

export async function brainContext(db: any, text: string) {
  const type = botType(text);
  const { data: pats } = await db.from("bot_brain").select("pattern").eq("kind", "pattern").eq("bot_type", type).order("quality", { ascending: false }).order("created_at", { ascending: false }).limit(3);
  const patText = pats?.length ? `\n\nPROVEN PATTERNS from past successful ${type} bots (reuse their flows, admin nesting, key names and colour map; the user's request wins on conflicts):\n${pats.map((p: any) => JSON.stringify(p.pattern).slice(0, 1500)).join("\n")}` : "";
  const { data } = await db.from("bot_brain").select("id, error_signature, symptom, root_cause, fix_summary, use_count").neq("kind", "pattern").order("created_at", { ascending: false }).limit(300);
  if (!data?.length) return patText;
  const words = new Set(text.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter((w) => w.length > 3));
  const scored = data.map((r: any) => {
    const hay = `${r.error_signature} ${r.symptom} ${r.root_cause} ${r.fix_summary}`.toLowerCase();
    let s = 0; for (const w of words) if (hay.includes(w)) s++;
    return { r, s: s + Math.min(r.use_count, 20) / 20 };
  }).sort((a: any, b: any) => b.s - a.s).slice(0, 5).map((x: any) => x.r);
  await Promise.all(scored.map((r: any) => db.from("bot_brain").update({ use_count: r.use_count + 1 }).eq("id", r.id)));
  return `${patText}\n\nPast fixes (avoid these mistakes):\n${scored.map((r: any) => `- ${r.symptom ?? ""} → cause: ${r.root_cause ?? ""}; fix: ${r.fix_summary ?? ""}`.slice(0, 300)).join("\n")}`;
}

export const createBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name?: string }) => z.object({ name: z.string().max(60).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { effectivePlan } = await import("@/lib/plan.server");
    const profile = await effectivePlan(db, context.userId);
    const { count } = await db.from("bots").select("id", { count: "exact", head: true }).eq("user_id", context.userId);
    if (limitReached(count ?? 0, profile?.plans?.max_bot_projects)) throw new Error("আপনার প্ল্যানের সর্বোচ্চ বট সীমা পূর্ণ হয়েছে");
    const { data: row, error } = await db.from("bots").insert({ user_id: context.userId, name: data.name || "নতুন বট", language: "python" }).select("id").single();
    if (error) throw new Error("বট তৈরি করা যায়নি");
    return { id: row.id as string };
  });

export const renameBot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string; name: string }) => z.object({ botId: z.string().uuid(), name: z.string().trim().min(1).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bots").update({ name: data.name }).eq("id", data.botId).eq("user_id", context.userId);
    if (error) {
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      await loadOwned(db, context.userId, data.botId);
      await db.from("bots").update({ name: data.name }).eq("id", data.botId);
    }
    return { ok: true };
  });

export const botStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string }) => z.object({ botId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const bot = await loadOwned(db, context.userId, data.botId);
    let status: string = bot.temp_status ?? "stopped";
    let log: string = bot.test_log ?? "";
    const expired = bot.temp_expires_at && new Date(bot.temp_expires_at).getTime() <= Date.now();
    if (status === "running" && expired) {
      status = "stopped";
      await db.from("bots").update({ temp_status: "stopped" }).eq("id", bot.id);
    } else if (status === "running") {
      try {
        const { getAgent, agentCall } = await import("@/lib/deploy.server");
        const agent = await getAgent(db);
        if (agent) {
          const r = await agentCall(agent, "/bot/logs", { botId: bot.id }, undefined, 15_000);
          log = String(r?.log ?? log).slice(-6000);
          if (r && !r.running) status = /Traceback|Error|\[exit [1-9]/.test(log) ? "error" : "stopped";
          await db.from("bots").update({ temp_status: status, test_log: log }).eq("id", bot.id);
        }
      } catch (e) { console.error("bot logs", e); }
    }
    return { status, expiresAt: status === "running" ? bot.temp_expires_at as string : null, log, hasToken: !!bot.token_enc, hasAdmin: !!bot.admin_id, botUsername: bot.bot_username as string | null };
  });

export const saveBotSecrets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string; token: string; adminId: string }) => z.object({ botId: z.string().uuid(), token: z.string().max(256), adminId: z.string().max(24) }).parse(d))
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
      await loadOwned(db, context.userId, data.botId);
      const adminId = data.adminId.trim().replace(/\s+/g, "");
      if (!/^-?\d{5,20}$/.test(adminId)) return { error: "সঠিক numeric Telegram ADMIN_ID দিন" };
      const update: any = { admin_id: adminId };
      const token = data.token.trim().replace(/^bot/i, "").replace(/\s+/g, "");
      let username: string | null = null;
      if (token) {
      if (!/^\d{6,15}:[A-Za-z0-9_-]{20,}$/.test(token)) return { error: "টোকেনের ফরম্যাট ঠিক নয় — BotFather থেকে পুরো টোকেন কপি করুন" };
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { method: "POST", signal: AbortSignal.timeout(12_000) });
        const r: any = await response.json().catch(() => null);
        if (!response.ok || !r?.ok) return { error: response.status >= 500 ? "Telegram এখন সাড়া দিচ্ছে না — একটু পরে চেষ্টা করুন" : "Telegram টোকেনটি গ্রহণ করেনি — BotFather থেকে নতুন করে কপি করুন" };
        username = r.result.username;
      } catch (error) {
        return { error: error instanceof Error && error.name === "TimeoutError" ? "Telegram যাচাই করতে সময় শেষ হয়েছে — আবার চেষ্টা করুন" : "Telegram-এর সাথে সংযোগ হচ্ছে না — একটু পরে চেষ্টা করুন" };
      }
      const material = process.env['APP_USER_CONNECTION_KEY_SECRET'];
      if (!material) return { error: "নিরাপদভাবে টোকেন সেভ করার সেটআপ সম্পূর্ণ নয় — অ্যাডমিনকে জানান" };
      const { encryptBotSecret } = await import("@/lib/bot-secrets.server");
      update["token_enc"] = await encryptBotSecret(token, material);
      update["bot_username"] = username;
      }
      const { error } = await db.from("bots").update(update).eq("id", data.botId);
      if (error) return { error: "টোকেন ও Admin ID সেভ করা যায়নি — আবার চেষ্টা করুন" };
      return { ok: true, username };
    } catch (error) {
      console.error("save bot secrets failed", error instanceof Error ? error.message : "unknown error");
      return { error: "Token save service-এ সমস্যা হয়েছে — আবার চেষ্টা করুন" };
    }
  });

export const cancelBotJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string }) => z.object({ botId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    await loadOwned(db, context.userId, data.botId);
    await db.from("bots").update({ cancel_requested_at: new Date().toISOString() }).eq("id", data.botId);
    return { ok: true };
  });

export const listVersions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string }) => z.object({ botId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("bot_versions").select("id, note, coins_used, created_at").eq("bot_id", data.botId).order("created_at", { ascending: false }).limit(50);
    return rows ?? [];
  });

export const restoreVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string; versionId: string }) => z.object({ botId: z.string().uuid(), versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    await loadOwned(db, context.userId, data.botId);
    const { data: v } = await db.from("bot_versions").select("files, bot_id").eq("id", data.versionId).single();
    if (!v || v.bot_id !== data.botId) return { error: "ভার্সন পাওয়া যায়নি" };
    await db.from("bots").update({ files: v.files, last_build_at: new Date().toISOString() }).eq("id", data.botId);
    return { ok: true };
  });

export const startTempHost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string }) => z.object({ botId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const bot = await loadOwned(db, context.userId, data.botId);
    if (!bot.files?.length) return { error: "আগে বট বিল্ড করুন" };
    if (!bot.token_enc || !bot.admin_id) return { error: "NEED_SECRETS" };
    const { effectivePlan } = await import("@/lib/plan.server");
    const profile = await effectivePlan(db, context.userId);
    const usage = await usageToday(db, context.userId);
    const minutes = Number(profile?.plans?.temp_host_minutes_per_day ?? 15);
    if (minutes >= 0 && usage.temp_host_minutes + TEMP_MINUTES > minutes) return { error: "আজকের ৫ মিনিট টেস্ট সীমা শেষ হয়েছে" };
    const { getAgent, agentCall } = await import("@/lib/deploy.server");
    const agent = await getAgent(db);
    if (!agent) {
      await db.from("bots").update({ temp_status: "error", test_log: "টেস্ট সার্ভার অফলাইন" }).eq("id", bot.id);
      return { error: "টেস্ট সার্ভার অফলাইন — অ্যাডমিনকে জানান" };
    }
    await db.from("bots").update({ temp_status: "starting" }).eq("id", bot.id);
    try {
      const material = process.env['APP_USER_CONNECTION_KEY_SECRET'];
      if (!material) return { error: "টেস্ট সার্ভারের নিরাপদ সেটআপ সম্পূর্ণ নয়" };
      const { decryptBotSecret } = await import("@/lib/bot-secrets.server");
      const token = await decryptBotSecret(bot.token_enc, material);
      if (!token) return { error: "সেভ করা টোকেনটি আবার সেট করুন" };
      const r = await agentCall(agent, "/bot/start", { botId: bot.id, files: testFiles(bot.files ?? []), language: "python", token, adminId: bot.admin_id, mode: "test", minutes: TEMP_MINUTES }, undefined, 300_000);
      const ok = r?.step === "running";
      const now = Date.now();
      await db.from("bots").update({
        temp_status: ok ? "running" : "error",
        temp_started_at: ok ? new Date(now).toISOString() : null,
        temp_expires_at: ok ? new Date(now + TEMP_MINUTES * 60000).toISOString() : null,
        test_log: String(r?.log ?? "").slice(-6000),
      }).eq("id", bot.id);
      if (ok) await addUsage(db, context.userId, { temp_host_minutes: TEMP_MINUTES });
      return ok ? { ok: true } : { error: "বট চালু হয়নি — টেস্ট লগ দেখুন" };
    } catch (e: any) {
      console.error("temp host", e);
      await db.from("bots").update({ temp_status: "error", test_log: String(e?.message ?? e).slice(0, 2000) }).eq("id", bot.id);
      return { error: "টেস্ট সার্ভারে চালানো যায়নি" };
    }
  });

export const stopTempHost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string }) => z.object({ botId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const bot = await loadOwned(db, context.userId, data.botId);
    try {
      const { getAgent, agentCall } = await import("@/lib/deploy.server");
      const agent = await getAgent(db);
      if (agent) await agentCall(agent, "/bot/stop", { botId: bot.id }, undefined, 20_000);
    } catch (e) { console.error("temp stop", e); }
    await db.from("bots").update({ temp_status: "stopped", temp_expires_at: null }).eq("id", bot.id);
    return { ok: true };
  });

const attachmentsSchema = z.array(z.object({ name: z.string().max(200), kind: z.enum(["text", "image", "pdf", "video"]), content: z.string().max(11_000_000) })).max(10).optional()
  .refine((a) => !a || (a.reduce((n, x) => n + x.content.length, 0) <= 40_000_000 && a.every((x) =>
    x.kind === "image" ? /^data:image\/(jpeg|png|webp|gif);base64,/.test(x.content)
    : x.kind === "pdf" ? /^data:application\/pdf;base64,/.test(x.content)
    : x.kind === "video" ? (() => { try { const f = JSON.parse(x.content); return Array.isArray(f) && f.length <= 4 && f.every((u: unknown) => typeof u === "string" && u.startsWith("data:image/jpeg;base64,")); } catch { return false; } })()
    : x.content.length <= 300_000)), "Invalid attachments");

export const botChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string; prompt: string; mode: "chat" | "plan" | "build"; errorLog?: string; questionAnswers?: BotAnswer[]; attachments?: { name: string; kind: "text" | "image" | "pdf" | "video"; content: string }[] }) =>
    z.object({
      botId: z.string().uuid(),
      prompt: z.string().min(1).max(60000),
      mode: z.enum(["chat", "plan", "build"]),
      errorLog: z.string().max(60000).optional(),
      questionAnswers: z.array(z.object({ question: z.string().max(4000), answer: z.string().max(20000) })).max(20).optional(),
      attachments: attachmentsSchema,
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { runBotChat } = await import("@/lib/bot-build.server");
    return runBotChat(db, context.userId, data);
  });

const buildInput = z.object({
  botId: z.string().uuid(),
  mode: z.enum(["chat", "plan", "build"]).default("build"),
  prompt: z.string().min(1).max(60000),
  errorLog: z.string().max(60000).optional(),
  questionAnswers: z.array(z.object({ question: z.string().max(4000), answer: z.string().max(20000) })).max(20).optional(),
  attachments: attachmentsSchema,
});

// Starts a background build: the job row is created first, then the build runs on the server.
// If the user's connection drops mid-build, the cron sweeper re-runs the stuck job, so the
// build finishes even with the screen off or the app closed. Coins are charged only on save.
export const startBotBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string; prompt: string; mode?: "chat" | "plan" | "build"; errorLog?: string; questionAnswers?: BotAnswer[]; attachments?: { name: string; kind: "text" | "image" | "pdf" | "video"; content: string }[] }) => buildInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const bot = await loadOwned(db, context.userId, data.botId);
    if (data.mode === "build" && (!bot.token_enc || !bot.admin_id)) return { error: "NEED_SECRETS" };
    // One active job per bot (Chat/Plan also run as jobs so a dropped connection never loses the answer).
    const { data: existing } = await db.from("bot_jobs").select("id, created_at").eq("bot_id", data.botId).in("status", ["queued", "running"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing) return { ok: true, jobId: existing.id as string, createdAt: existing.created_at as string };
    const input = { ...data };
    const { data: job, error } = await db.from("bot_jobs").insert({ bot_id: data.botId, user_id: context.userId, status: "queued", input } as any).select("id, created_at").single();
    if (error || !job) return { error: "বিল্ড শুরু করা যায়নি — আবার চেষ্টা করুন" };
    // The database starts the build in its own server request (pg_net), so it keeps running
    // even if this request or the user's phone disconnects. A sweeper re-kicks dead jobs.
    const { appOrigin } = await import("@/lib/origin.server");
    let origin = appOrigin();
    // Preview hosts need a login cookie that the database call cannot send.
    if (/id-preview--|localhost|lovableproject\.com/.test(origin)) origin = "https://bright-ease.lovable.app";
    const { error: kickErr } = await db.rpc("kick_bot_job" as any, { _id: job.id, _origin: origin } as any);
    if (kickErr) {
      const { processBotJob } = await import("@/lib/bot-build.server");
      await processBotJob(job.id);
    }
    return { ok: true, jobId: job.id as string, createdAt: job.created_at as string };
  });

/** Per-bot preferences the studio saves: emoji mode and in-progress plan answers (survive closing the browser). */
export const setBotPrefs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { botId: string; emojiMode?: "premium" | "normal"; pendingAnswers?: string[]; clearPending?: boolean }) =>
    z.object({ botId: z.string().uuid(), emojiMode: z.enum(["premium", "normal"]).optional(), pendingAnswers: z.array(z.string().max(20000)).max(20).optional(), clearPending: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    await loadOwned(db, context.userId, data.botId);
    const patch: Record<string, unknown> = {};
    if (data.emojiMode) patch.emoji_mode = data.emojiMode;
    if (data.pendingAnswers) patch.pending_answers = data.pendingAnswers;
    if (data.clearPending) { patch.pending_questions = null; patch.pending_answers = null; }
    if (Object.keys(patch).length) await db.from("bots").update(patch as any).eq("id", data.botId);
    return { ok: true };
  });
