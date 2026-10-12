import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listActiveProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { effectivePlan, allowedProviders } = await import("./plan.server");
    const prof = await effectivePlan(supabaseAdmin, context.userId);
    const list = await allowedProviders(supabaseAdmin, prof?.plans);
    return list.map((p: any) => ({ id: p.id as string, name: p.name as string, model: p.model as string, is_default: p.is_default as boolean }));
  });

async function planFor(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("is_banned, plans(*)").eq("id", userId).single();
  return data as { is_banned: boolean; plans: { max_published: number; show_badge: boolean; price_bdt: number; can_publish: boolean } | null } | null;
}

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name?: string; copyFrom?: string }) => z.object({ name: z.string().max(120).optional(), copyFrom: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const prof = await planFor(supabase, userId);
    if (prof?.is_banned) return { error: "আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে" };
    let row: { name: string; code_html: string; messages: any } = { name: data.name || "নতুন প্রজেক্ট", code_html: "", messages: [] };
    if (data.copyFrom) {
      const { data: src } = await supabase.from("projects").select("name, code_html, messages").eq("id", data.copyFrom).single();
      if (src) row = { name: src.name + " (কপি)", code_html: src.code_html, messages: src.messages };
    }
    const { data: p, error } = await supabase.from("projects").insert({ ...row, user_id: userId }).select("id").single();
    if (error) return { error: "প্রজেক্ট তৈরি করা যায়নি" };
    return { id: p.id };
  });

function slug(s: string) {
  const base = s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  return (base || "site") + "-" + Math.random().toString(36).slice(2, 7);
}

export const setPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; publish: boolean }) => z.object({ id: z.string().uuid(), publish: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: proj } = await supabase.from("projects").select("id, name, user_id, subdomain, is_flagged, code_html").eq("id", data.id).single();
    if (!proj || proj.user_id !== userId) return { error: "প্রজেক্ট পাওয়া যায়নি" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.publish) {
      await supabaseAdmin.from("projects").update({ is_published: false }).eq("id", data.id);
      const { deployProject } = await import("./deploy.server");
      const { appOrigin } = await import("./origin.server");
      await deployProject(supabaseAdmin, data.id, appOrigin());
      return { ok: true as const, subdomain: proj.subdomain };
    }
    if (!proj.code_html) return { error: "আগে একটি ওয়েবসাইট বানান, তারপর প্রকাশ করুন" };
    if (proj.is_flagged) return { error: "এই প্রজেক্টটি পর্যালোচনার অপেক্ষায় আছে, এখন প্রকাশ করা যাবে না" };
    const prof = await planFor(supabase, userId);
    if (prof?.is_banned) return { error: "আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে" };
    if (prof?.plans && prof.plans.can_publish === false) return { error: "আপনার প্ল্যানে প্রকাশ করার সুবিধা নেই। আপগ্রেড করুন।" };
    const { data: settings } = await supabase.from("site_settings").select("free_block_publish").eq("id", 1).single();
    if (settings?.free_block_publish && (prof?.plans?.price_bdt ?? 0) === 0) return { error: "ফ্রি প্ল্যানে প্রকাশ বন্ধ আছে। প্রকাশ করতে Pro নিন।" };
    const maxPub = prof?.plans?.max_published ?? 1;
    if (maxPub >= 0) {
      const { count } = await supabaseAdmin.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("is_published", true).neq("id", data.id);
      if ((count ?? 0) >= maxPub) return { error: `আপনার প্ল্যানে সর্বোচ্চ ${maxPub}টি সাইট প্রকাশ করা যায়। অন্য একটির প্রকাশ বন্ধ করুন বা আপগ্রেড করুন।` };
    }
    const subdomain = proj.subdomain ?? slug(proj.name);
    const { error } = await supabaseAdmin.from("projects").update({ is_published: true, subdomain, show_badge: prof?.plans?.show_badge ?? true }).eq("id", data.id);
    if (error) return { error: "প্রকাশ করা যায়নি" };
    const { data: full } = await supabaseAdmin.from("projects").select("id, published_html, published_version").eq("id", data.id).single();
    const { pushLive, hashHtml } = await import("./publish.server");
    if (full && (!full.published_html || hashHtml(full.published_html) !== hashHtml(proj.code_html))) {
      await pushLive(supabaseAdmin, userId, full as any, proj.code_html);
    }
    const { deployProject } = await import("./deploy.server");
      const { appOrigin } = await import("./origin.server");
    const dep = await deployProject(supabaseAdmin, data.id, appOrigin());
    return { ok: true as const, subdomain, deployedUrl: dep.url ?? null, deployError: dep.ok ? null : "সার্ভারে পাঠানো যায়নি" };
  });

const DOMAIN_RE = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

async function domainCtx(supabase: any, userId: string, projectId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { effectivePlan } = await import("./plan.server");
  const { data: proj } = await supabase.from("projects").select("id, user_id, custom_domain").eq("id", projectId).single();
  if (!proj || proj.user_id !== userId) return { error: "প্রজেক্ট পাওয়া যায়নি" } as const;
  const prof = await effectivePlan(supabaseAdmin, userId);
  if (prof?.is_banned) return { error: "আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে" } as const;
  if (!prof?.plans?.allow_custom_domain) return { error: "আপনার প্ল্যানে কাস্টম ডোমেইন নেই। আপগ্রেড করুন।" } as const;
  return { db: supabaseAdmin, proj } as const;
}

export const setCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; domain: string | null }) => z.object({ id: z.string().uuid(), domain: z.string().max(253).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await domainCtx(context.supabase, context.userId, data.id);
    if ("error" in c) return { error: c.error as string };
    let domain: string | null = null;
    if (data.domain) {
      domain = data.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/\.$/, "");
      if (!DOMAIN_RE.test(domain)) return { error: "সঠিক ডোমেইন দিন, যেমন myshop.com" };
    }
    const old = c.proj.custom_domain as string | null;
    const { error } = await c.db.from("projects").update({ custom_domain: domain, domain_status: "pending", domain_found_ns: [], domain_checked_at: null, dns_status: "none" }).eq("id", data.id);
    if (error) return { error: error.code === "23505" ? "এই ডোমেইনটি অন্য একটি প্রজেক্টে যুক্ত আছে" : "ডোমেইন সেভ করা যায়নি" };
    const { dnsAdd, dnsRemove } = await import("./deploy.server");
    if (old && old !== domain) await dnsRemove(c.db, old);
    let dns: "ok" | "error" | "none" = "none";
    if (domain) {
      dns = await dnsAdd(c.db, domain);
      await c.db.from("projects").update({ dns_status: dns }).eq("id", data.id);
    }
    return { ok: true as const, dns };
  });

export const checkCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const c = await domainCtx(context.supabase, context.userId, data.id);
    if ("error" in c) return { error: c.error as string };
    if (!c.proj.custom_domain) return { error: "আগে একটি ডোমেইন যোগ করুন" };
    const { checkNameservers } = await import("./domain.server");
    const r = await checkNameservers(c.db, c.proj.custom_domain);
    await c.db.from("projects").update({ domain_status: r.status, domain_found_ns: r.found, domain_checked_at: new Date().toISOString() }).eq("id", data.id);
    return { ok: true as const, status: r.status, found: r.found, expected: r.expected };
  });

/** Re-check all of the user's pending/wrong domains (called when the dashboard opens). */
export const recheckMyDomains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkNameservers } = await import("./domain.server");
    const { data: list } = await supabaseAdmin.from("projects").select("id, custom_domain, domain_checked_at").eq("user_id", context.userId).not("custom_domain", "is", null).neq("domain_status", "connected");
    let changed = 0;
    for (const p of (list ?? []).slice(0, 10)) {
      if (p.domain_checked_at && Date.now() - new Date(p.domain_checked_at).getTime() < 5 * 60_000) continue;
      const r = await checkNameservers(supabaseAdmin, p.custom_domain!);
      await supabaseAdmin.from("projects").update({ domain_status: r.status, domain_found_ns: r.found, domain_checked_at: new Date().toISOString() }).eq("id", p.id);
      if (r.status === "connected") changed++;
    }
    return { changed };
  });
