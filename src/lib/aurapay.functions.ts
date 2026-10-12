import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const createAuraPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { planId: string }) => z.object({ planId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { auraCreate } = await import("./plan.server");
    const [{ data: plan }, { data: prof }, { data: s }] = await Promise.all([
      db.from("plans").select("id, price_bdt, name_en").eq("id", data.planId).single(),
      db.from("profiles").select("name, email, is_banned").eq("id", context.userId).single(),
      db.from("site_settings").select("aurapay_enabled").eq("id", 1).single(),
    ]);
    if (!plan || plan.price_bdt <= 0) return { error: "প্ল্যান পাওয়া যায়নি" };
    if (prof?.is_banned) return { error: "আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে" };
    if (s && !(s as any).aurapay_enabled) return { error: "এই মুহূর্তে পেমেন্ট বন্ধ আছে" };
    const origin = new URL(getRequest().url).origin;
    const { data: row, error } = await db.from("aura_payments").insert({ user_id: context.userId, plan_id: plan.id, amount: plan.price_bdt }).select("id").single();
    if (error || !row) return { error: "পেমেন্ট শুরু করা যায়নি" };
    const r = await auraCreate({
      cus_name: prof?.name || "Hexa AI User",
      cus_email: prof?.email || "user@hexa.ai",
      amount: plan.price_bdt,
      metadata: { payment_id: row.id },
      success_url: `${origin}/payment/success`,
      cancel_url: `${origin}/pricing`,
      webhook_url: `${origin}/api/public/aurapay-webhook`,
    });
    if ("error" in r) {
      await db.from("aura_payments").update({ status: "failed", raw: ("detail" in r ? r.detail : {}) as any }).eq("id", row.id);
      return { error: r.error as string };
    }
    return { url: r.url, paymentId: row.id as string };
  });

export const verifyAuraPayment = createServerFn({ method: "POST" })
  .inputValidator((d: { transactionId: string }) => z.object({ transactionId: z.string().min(3).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { auraVerifyAndApply } = await import("./plan.server");
    return (await auraVerifyAndApply(db, data.transactionId)) as { ok?: boolean; error?: string };
  });

/** Status of the signed-in user's own payment (used when AuraPay returns without a transaction id). */
export const getAuraPaymentStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { paymentId: string }) => z.object({ paymentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase.from("aura_payments").select("status").eq("id", data.paymentId).maybeSingle();
    return { status: (row?.status as string | undefined) ?? null };
  });
