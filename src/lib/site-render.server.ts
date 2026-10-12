// Server-only: resolve a published site and render it as plain, cacheable HTML (no app shell).
import { hostingStatus } from "./hosting";

const CACHE = "public, max-age=60, s-maxage=60, stale-while-revalidate=300";

function page(title: string, body: string) {
  return `<!DOCTYPE html><html lang="bn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&display=swap" rel="stylesheet">
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f0a1e;color:#ece9f7;font-family:'Hind Siliguri',sans-serif;padding:24px;box-sizing:border-box;text-align:center}
.c{max-width:380px;padding:32px;border-radius:20px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
h1{font-size:24px;margin:0 0 8px}p{color:#a9a3c2;margin:0}a{display:inline-flex;min-height:48px;align-items:center;margin-top:20px;padding:0 20px;border-radius:12px;background:linear-gradient(135deg,#4f46e5,#06b6d4);color:#fff;text-decoration:none;font-weight:600}</style></head>
<body><div class="c">${body}</div></body></html>`;
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function inject(html: string, extra: string) {
  if (!extra) return html;
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i >= 0 ? html.slice(0, i) + extra + html.slice(i) : html + extra;
}

function supportLink(s: any): string {
  const wa = String(s?.support_whatsapp ?? "").replace(/[^\d]/g, "");
  if (wa) return `https://wa.me/${wa}`;
  if (s?.telegram_link) return s.telegram_link;
  if (s?.support_email) return `mailto:${s.support_email}`;
  return "";
}

export function toBn(n: number) {
  return String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]!);
}

export type SiteLookup = { subdomain: string } | { host: string };

export async function renderPublishedSite(lookup: SiteLookup, appOrigin: string): Promise<Response> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  let q = db.from("projects").select("name, code_html, published_html, show_badge, user_id").eq("is_published", true);
  if ("subdomain" in lookup) {
    q = q.eq("subdomain", lookup.subdomain);
  } else {
    const host = lookup.host.toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");
    const { data: s } = await db.from("site_settings").select("hosting_domain").eq("id", 1).maybeSingle();
    const base = String((s as any)?.hosting_domain ?? "").toLowerCase().replace(/^www\./, "");
    if (base && host.endsWith("." + base)) q = q.eq("subdomain", host.slice(0, -(base.length + 1)));
    else q = q.in("custom_domain", [host, "www." + host]).eq("domain_status", "connected");
  }
  const { data: p } = await q.limit(1).maybeSingle();
  const headers = { "Content-Type": "text/html; charset=utf-8" };
  if (!p) {
    return new Response(page("সাইট পাওয়া যায়নি", `<h1>সাইটটি পাওয়া যায়নি</h1><p>এটি হয়তো প্রকাশ বন্ধ করা হয়েছে।</p>`), {
      status: 404, headers: { ...headers, "Cache-Control": "public, max-age=30" },
    });
  }
  const [{ data: prof }, { data: def }, { data: s }] = await Promise.all([
    db.from("profiles").select("plan_expires_at, plan_ended_at, plans(price_bdt, can_publish)").eq("id", p.user_id).maybeSingle(),
    db.from("plans").select("price_bdt, can_publish").eq("is_default", true).order("created_at").limit(1).maybeSingle(),
    db.from("site_settings").select("free_block_publish, grace_days, delete_after_days, support_whatsapp, support_email, telegram_link").eq("id", 1).maybeSingle(),
  ]);
  const pr: any = prof;
  const expired = pr?.plan_expires_at && new Date(pr.plan_expires_at) < new Date();
  const fallback: any = expired ? def : (pr?.plans ?? def);
  const fallbackCanHost = !!fallback && fallback.can_publish !== false && !(s?.free_block_publish && (fallback.price_bdt ?? 0) === 0);
  const ss: any = s ?? {};
  const status = hostingStatus({ planExpiresAt: pr?.plan_expires_at ?? null, planEndedAt: pr?.plan_ended_at ?? null, fallbackCanHost, graceDays: ss.grace_days, deleteAfterDays: ss.delete_after_days });
  const contact = supportLink(ss);
  if (status.state === "grace") {
    return new Response(
      page("Plan expired", `<h1>⚠️ Contact your provider and upgrade your plan</h1><p>এই ওয়েবসাইটের প্যাকেজের মেয়াদ শেষ। চালু রাখতে প্যাকেজ রিনিউ বা আপগ্রেড করুন।</p>${contact ? `<a href="${esc(contact)}" target="_blank" rel="noopener">যোগাযোগ করুন</a>` : `<a href="${appOrigin}/pricing">প্যাকেজ আপগ্রেড করুন</a>`}`),
      { status: 200, headers: { ...headers, "Cache-Control": "public, max-age=60" } },
    );
  }
  if (status.state === "deleted") {
    return new Response(page("সাইট পাওয়া যায়নি", `<h1>সাইটটি পাওয়া যায়নি</h1>`), { status: 404, headers: { ...headers, "Cache-Control": "public, max-age=60" } });
  }

  if (status.state === "offline") {
    return new Response(
      page("ওয়েবসাইটটি বন্ধ আছে", `<h1>ওয়েবসাইটটি বন্ধ আছে</h1><p>এই ওয়েবসাইটের প্যাকেজের মেয়াদ শেষ। আবার চালু করতে প্যাকেজ আপগ্রেড করুন।</p><a href="${appOrigin}/pricing">প্যাকেজ আপগ্রেড করুন</a>`),
      { status: 200, headers: { ...headers, "Cache-Control": CACHE } },
    );
  }
  let extra = "";
  if (p.show_badge) {
    extra += `<a href="${appOrigin}/" target="_blank" rel="noopener" style="position:fixed;right:12px;bottom:12px;z-index:2147483646;padding:6px 12px;border-radius:999px;background:linear-gradient(135deg,#4f46e5,#06b6d4);color:#fff;font:600 12px 'Hind Siliguri',sans-serif;text-decoration:none">Hexa AI দিয়ে তৈরি</a>`;
  }
  let html = (p as any).published_html || p.code_html || page(esc(p.name), `<h1>${esc(p.name)}</h1>`);
  if (!/<html/i.test(html)) html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(p.name)}</title></head><body>${html}</body></html>`;
  return new Response(inject(html, extra), { status: 200, headers: { ...headers, "Cache-Control": CACHE, "X-Robots-Tag": "all" } });
}
