// Server-only helpers for resolving a user's effective plan (handles expiry) and allowed AI providers.
export async function effectivePlan(db: any, userId: string) {
  const { data: profile } = await db.from("profiles").select("*, plans(*)").eq("id", userId).single();
  if (!profile) return null;
  if (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) {
    const { data: def } = await db.from("plans").select("*").eq("is_default", true).order("created_at").limit(1).maybeSingle();
    await db.from("profiles").update({ plan_id: def?.id ?? null, plan_expires_at: null, plan_ended_at: profile.plan_expires_at }).eq("id", userId);
    profile.plan_id = def?.id ?? null;
    profile.plan_expires_at = null;
    profile.plans = def ?? null;
  }
  return profile as any;
}

export async function allowedProviders(db: any, plan: any) {
  const { data: providers } = await db.from("ai_providers").select("*").eq("is_active", true).order("is_default", { ascending: false }).order("sort_order");
  let list: any[] = providers ?? [];
  if (plan?.id) {
    const { data: links } = await db.from("plan_providers").select("provider_id").eq("plan_id", plan.id);
    const ids = new Set((links ?? []).map((l: any) => l.provider_id));
    if (ids.size) list = list.filter((p) => ids.has(p.id));
    if (plan.default_provider_id) {
      list = [...list.filter((p) => p.id === plan.default_provider_id), ...list.filter((p) => p.id !== plan.default_provider_id)];
    }
  }
  return list;
}

export async function applyPlan(db: any, userId: string, planId: string) {
  const { data: plan } = await db.from("plans").select("duration_days, bonus_coins, name_bn").eq("id", planId).single();
  const days = plan?.duration_days ?? 0;
  const { data: prof } = await db.from("profiles").select("plan_id, plan_expires_at").eq("id", userId).single();
  let base = Date.now();
  if (prof?.plan_id === planId && prof.plan_expires_at && new Date(prof.plan_expires_at).getTime() > base) base = new Date(prof.plan_expires_at).getTime();
  const expires = days > 0 ? new Date(base + days * 86400_000).toISOString() : null;
  await db.from("profiles").update({ plan_id: planId, plan_expires_at: expires, plan_ended_at: null }).eq("id", userId);
  if (plan?.bonus_coins > 0) await db.rpc("add_coins", { _user: userId, _amount: plan.bonus_coins, _type: "purchase", _reason: `${plan.name_bn} প্ল্যান কেনা` });
}

const AURA = "https://pay.aurapay.top/api/payment";

async function auraKey() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("app_secrets" as any).select("value").eq("name", "aurapay_api_key").maybeSingle();
  return ((data as any)?.value as string | undefined) || process.env["AURAPAY_API_KEY"];
}

function parseMeta(m: any): any {
  if (!m) return {};
  if (typeof m === "string") { try { return JSON.parse(m); } catch { return {}; } }
  return m;
}

/** Verify a transaction with AuraPay (official plugin format) and turn on the plan once. */
export async function auraVerifyAndApply(db: any, transactionId: string) {
  const key = await auraKey();
  if (!key) return { error: "পেমেন্ট সিস্টেম এখনো চালু হয়নি" };
  const r = await fetch(`${AURA}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json", "API-KEY": key },
    body: JSON.stringify({ transaction_id: transactionId }),
  });
  const j: any = await r.json().catch(() => ({}));
  const meta = parseMeta(j?.metadata ?? j?.data?.metadata);
  const paymentId = String(meta?.payment_id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(paymentId)) return { error: "পেমেন্ট পাওয়া যায়নি" };
  const { data: row } = await db.from("aura_payments").select("*").eq("id", paymentId).maybeSingle();
  if (!row) return { error: "পেমেন্ট পাওয়া যায়নি" };
  if (row.status === "completed") return { ok: true };
  const status = String(j?.status ?? j?.data?.status ?? "").toUpperCase();
  const amount = Number(j?.amount ?? j?.data?.amount ?? 0);
  if (status !== "COMPLETED") {
    if (status && status !== "1" && status !== "0") await db.from("aura_payments").update({ status: status.toLowerCase(), invoice_id: transactionId, raw: j }).eq("id", row.id);
    return { error: status === "PENDING" ? "পেমেন্ট এখনো যাচাই হচ্ছে, একটু পরে আবার দেখুন" : "পেমেন্ট সম্পন্ন হয়নি" };
  }
  if (amount && amount + 0.5 < row.amount) {
    await db.from("aura_payments").update({ status: "amount_mismatch", invoice_id: transactionId, raw: j }).eq("id", row.id);
    return { error: "পেমেন্টের পরিমাণ মেলেনি, সাপোর্টে যোগাযোগ করুন" };
  }
  const { data: claimed } = await db.from("aura_payments").update({ status: "completed", invoice_id: transactionId, raw: j }).eq("id", row.id).neq("status", "completed").select("id");
  if (claimed?.length) await applyPlan(db, row.user_id, row.plan_id);
  return { ok: true };
}

export async function auraCreate(body: object) {
  const key = await auraKey();
  if (!key) return { error: "পেমেন্ট সিস্টেম এখনো চালু হয়নি" } as const;
  const r = await fetch(`${AURA}/create`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json", "API-KEY": key },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let j: any = {};
  try { j = JSON.parse(text); } catch { /* ignore */ }
  const url = j?.payment_url ?? j?.data?.payment_url;
  if (!r.ok || !url) {
    console.error("aurapay create failed", r.status, text.slice(0, 300));
    const detail = { http_status: r.status, message: j?.message ?? text.slice(0, 300) };
    const keyProblem = /invalid api|unauthori|api key/i.test(String(detail.message));
    return { error: keyProblem ? "পেমেন্ট সিস্টেম সেটআপে সমস্যা আছে, অ্যাডমিনকে জানান" : "পেমেন্ট শুরু করা যায়নি, আবার চেষ্টা করুন", detail } as const;
  }
  return { url: String(url) } as const;
}
