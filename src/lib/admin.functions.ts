import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminDb(context: { supabase: any; userId: string }) {
  const { data: ok } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!ok) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const mask = (k: string) => (k.length <= 8 ? "••••" : k.slice(0, 4) + "••••••" + k.slice(-4));

export const adminListProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context);
    const { data } = await db.from("ai_providers").select("*").order("is_default", { ascending: false }).order("sort_order").order("created_at");
    return (data ?? []).map((p) => ({ ...p, api_key: mask(p.api_key) }));
  });

const ProviderInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  base_url: z.string().url().max(300),
  api_key: z.string().max(500).optional(),
  model: z.string().min(1).max(200),
  custom_headers: z.record(z.string()).default({}),
  max_tokens: z.number().int().min(100).max(200000),
  temperature: z.number().min(0).max(2),
  is_active: z.boolean(),
  sort_order: z.number().int().default(0),
});

export const adminSaveProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof ProviderInput>) => ProviderInput.parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { id, api_key, ...rest } = data;
    if (id) {
      const patch: any = { ...rest };
      if (api_key) patch.api_key = api_key;
      const { error } = await db.from("ai_providers").update(patch).eq("id", id);
      if (error) return { error: "সেভ করা যায়নি" };
    } else {
      if (!api_key) return { error: "API Key দিন" };
      const { count } = await db.from("ai_providers").select("id", { count: "exact", head: true });
      const { error } = await db.from("ai_providers").insert({ ...rest, api_key, is_default: (count ?? 0) === 0 });
      if (error) return { error: "সেভ করা যায়নি" };
    }
    return { ok: true };
  });

export const adminDeleteProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    await db.from("ai_providers").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminSetDefaultProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    await db.from("ai_providers").update({ is_default: false }).neq("id", data.id);
    await db.from("ai_providers").update({ is_default: true, is_active: true }).eq("id", data.id);
    return { ok: true };
  });

export const adminTestProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { data: p } = await db.from("ai_providers").select("*").eq("id", data.id).single();
    if (!p) return { ok: false, message: "Provider পাওয়া যায়নি", ms: 0 };
    const t0 = Date.now();
    try {
      const r = await fetch(p.base_url.replace(/\/+$/, "") + "/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${p.api_key}`, "Content-Type": "application/json", ...((p.custom_headers as Record<string, string>) ?? {}) },
        body: JSON.stringify({ model: p.model, messages: [{ role: "user", content: "Hello" }], max_tokens: 20 }),
      });
      const ms = Date.now() - t0;
      const text = await r.text();
      if (!r.ok) return { ok: false, message: `ত্রুটি ${r.status}: ${text.slice(0, 200)}`, ms };
      let reply = "";
      try {
        reply = JSON.parse(text).choices?.[0]?.message?.content ?? "";
      } catch { /* ignore */ }
      return { ok: true, message: reply ? `উত্তর: ${reply.slice(0, 80)}` : "সংযোগ সফল", ms };
    } catch (e) {
      return { ok: false, message: "সংযোগ করা যায়নি: " + String(e).slice(0, 150), ms: Date.now() - t0 };
    }
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    if (data.id === context.userId) return { error: "নিজেকে ডিলিট করা যাবে না" };
    const { error } = await db.auth.admin.deleteUser(data.id);
    if (error) return { error: "ডিলিট করা যায়নি" };
    return { ok: true };
  });

export const adminResetUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
    await db.from("profiles").update({ tokens_used_today: 0, last_reset_date: today }).gte("tokens_used_today", 0);
    return { ok: true };
  });

export const adminDecidePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; approve: boolean }) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { data: req } = await db.from("payment_requests").select("*").eq("id", data.id).single();
    if (!req || req.status !== "pending") return { error: "অনুরোধটি পাওয়া যায়নি" };
    await db.from("payment_requests").update({ status: data.approve ? "approved" : "rejected" }).eq("id", data.id);
    if (data.approve) await db.from("profiles").update({ plan_id: req.plan_id }).eq("id", req.user_id);
    return { ok: true };
  });

export const adminGetAuraKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = await adminDb(context);
    const { data } = await db.from("app_secrets").select("value").eq("name", "aurapay_api_key").maybeSingle();
    return { masked: data?.value ? mask(data.value) : "" };
  });

export const adminSetAuraKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => z.object({ key: z.string().trim().min(8).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = await adminDb(context);
    const { error } = await db.from("app_secrets").upsert({ name: "aurapay_api_key", value: data.key, updated_at: new Date().toISOString() });
    if (error) return { error: "সেভ করা যায়নি" };
    return { ok: true };
  });

export const adminGetDeployToken = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = await adminDb(context);
    const { data } = await db.from("app_secrets").select("value").eq("name", "deploy_token").maybeSingle();
    return { masked: data?.value ? mask(data.value) : "" };
  });

/** Generates a fresh random deploy token, saves it, and returns it once so the admin can paste it into the VPS install command. */
export const adminNewDeployToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = await adminDb(context);
    const { randomBytes } = await import("node:crypto");
    const token = randomBytes(32).toString("hex");
    const { error } = await db.from("app_secrets").upsert({ name: "deploy_token", value: token, updated_at: new Date().toISOString() });
    if (error) return { error: "সেভ করা যায়নি" };
    return { ok: true as const, token };
  });

export const adminTestAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = await adminDb(context);
    const { getAgent, agentCall } = await import("./deploy.server");
    const agent = await getAgent(db);
    if (!agent) return { error: "সার্ভার ঠিকানা বা টোকেন দেওয়া হয়নি" };
    try {
      const r = await fetch(agent.url + "/health", { signal: AbortSignal.timeout(10000) });
      if (!r.ok) return { error: `সার্ভার সাড়া দিয়েছে কিন্তু সমস্যা (${r.status})` };
    } catch {
      return { error: "সার্ভারে সংযোগ হয়নি — ঠিকানা, পোর্ট ও SSL যাচাই করুন" };
    }
    // Signed call: proves the VPS has the same token as the website.
    try {
      await agentCall(agent, "/bot/logs", { botId: "00000000-0000-0000-0000-000000000000" }, undefined, 10000);
      return { ok: true as const };
    } catch (e: any) {
      if (String(e?.message ?? "").includes("401")) return { error: "সার্ভার অনলাইন, কিন্তু token মেলেনি — VPS-এ নতুন কমান্ড রান করুন, তারপর: sudo systemctl restart hexa-agent" };
      return { error: "টোকেন যাচাই করা যায়নি" };
    }
  });

export const adminGetBackendKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = await adminDb(context);
    const { data } = await db.from("app_secrets").select("value").eq("name", "backend_master_key").maybeSingle();
    return { masked: data?.value ? mask(data.value) : "" };
  });

export const adminSetBackendKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => z.object({ key: z.string().trim().min(8).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = await adminDb(context);
    const { error } = await db.from("app_secrets").upsert({ name: "backend_master_key", value: data.key, updated_at: new Date().toISOString() });
    if (error) return { error: "সেভ করা যায়নি" };
    return { ok: true };
  });

export const adminGetPexelsKey = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = await adminDb(context);
    const { data } = await db.from("app_secrets").select("value").eq("name", "pexels_api_key").maybeSingle();
    return { masked: data?.value ? mask(data.value) : "" };
  });

export const adminSetPexelsKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => z.object({ key: z.string().trim().min(8).max(500) }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = await adminDb(context);
    const { error } = await db.from("app_secrets").upsert({ name: "pexels_api_key", value: data.key, updated_at: new Date().toISOString() });
    if (error) return { error: "সেভ করা যায়নি" };
    return { ok: true };
  });

export const adminTestPexels = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db: any = await adminDb(context);
    const { getPexelsKey } = await import("./assets.server");
    const key = await getPexelsKey(db);
    if (!key) return { error: "Pexels key দেওয়া হয়নি" };
    try {
      const r = await fetch("https://api.pexels.com/v1/search?per_page=1&query=office", { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) });
      return r.ok ? { ok: true as const } : { error: `Pexels সংযোগ ব্যর্থ (${r.status}) — key যাচাই করুন` };
    } catch {
      return { error: "Pexels এ সংযোগ হয়নি" };
    }
  });

export const adminAddCoins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { user_id: string; amount: number; note?: string }) =>
    z.object({ user_id: z.string().uuid(), amount: z.number().int().min(1).max(100000), note: z.string().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { error } = await db.rpc("add_coins", { _user: data.user_id, _amount: data.amount, _type: "bonus", _reason: data.note ?? "Admin manually added" });
    if (error) return { error: "কয়েন যোগ করা যায়নি: " + error.message };
    return { ok: true };
  });

const EmojiMap = z.record(z.string().regex(/^[a-z0-9_.-]{2,60}$/), z.string().regex(/^\d{0,30}$/)).refine((map) => Object.keys(map).length <= 1500);
const EmojiMetaMap = z.record(z.string(), z.object({ kind: z.enum(["button", "text"]), style: z.enum(["", "primary", "success", "danger"]), fallback: z.string().max(16), label: z.string().max(80) })).optional();

export const adminGetBotSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context);
    const { data } = await db.from("site_settings").select("site_name, tagline, logo_url, announcement_text, announcement_color, announcement_active, maintenance_mode, support_email, telegram_link, support_whatsapp, agent_host, agent_port, server_ip, aurapay_enabled, button_emojis, button_emoji_meta, hexahoster_url").eq("id", 1).single();
    if (data && !Object.keys((data as any).button_emoji_meta ?? {}).length) {
      const { DEFAULT_EMOJI_IDS, DEFAULT_EMOJI_META } = await import("@/lib/emoji-defaults");
      const ids = { ...DEFAULT_EMOJI_IDS, ...((data.button_emojis as Record<string, string>) ?? {}) };
      const meta = { ...DEFAULT_EMOJI_META };
      await db.from("site_settings").update({ button_emojis: ids, button_emoji_meta: meta as any }).eq("id", 1);
      return { ...data, button_emojis: ids, button_emoji_meta: meta };
    }
    return data;
  });

export const adminSaveBotSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    site_name: z.string().trim().min(1).max(80), tagline: z.string().trim().max(180), logo_url: z.string().trim().max(500),
    announcement_text: z.string().trim().max(300), announcement_color: z.string().regex(/^#[0-9a-f]{6}$/i), announcement_active: z.boolean(), maintenance_mode: z.boolean(),
    support_email: z.union([z.string().trim().email(), z.literal("")]), telegram_link: z.union([z.string().trim().url(), z.literal("")]), support_whatsapp: z.string().trim().max(30),
    agent_host: z.string().trim().max(200), agent_port: z.number().int().min(1).max(65535), server_ip: z.string().trim().max(80), aurapay_enabled: z.boolean(),
    hexahoster_url: z.string().trim().url().max(500),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const { error } = await db.from("site_settings").update({ ...data, logo_url: data.logo_url || null }).eq("id", 1);
    return error ? { error: "সেটিংস সেভ করা যায়নি" } : { ok: true as const };
  });

export const adminSaveEmojiMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { map: Record<string, string>; meta?: Record<string, any> }) => z.object({ map: EmojiMap, meta: EmojiMetaMap }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    const clean: Record<string, string> = {};
    const meta: Record<string, any> = {};
    for (const [rawKey, rawId] of Object.entries(data.map)) {
      const key = rawKey.trim().toLowerCase();
      clean[key] = rawId.trim();
      meta[key] = data.meta?.[rawKey] ?? { kind: key.startsWith("text.") ? "text" : "button", style: "", fallback: "🔹", label: key };
    }
    const { error } = await db.from("site_settings").update({ button_emojis: clean, button_emoji_meta: meta }).eq("id", 1);
    return error ? { error: "Premium emoji IDs সেভ করা যায়নি" } : { ok: true as const, map: clean, meta };
  });

export const adminListBotBrain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await adminDb(context);
    const { data } = await db.from("bot_brain").select("id, source, kind, bot_type, quality, error_signature, symptom, fix_summary, code_snippet, use_count, created_at").order("created_at", { ascending: false }).limit(500);
    return data ?? [];
  });

export const adminDeleteBrain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await adminDb(context);
    await db.from("bot_brain").delete().eq("id", data.id);
    return { ok: true };
  });
