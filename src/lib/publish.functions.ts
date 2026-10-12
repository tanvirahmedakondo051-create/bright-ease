import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Id = z.object({ id: z.string().uuid() });

async function ownProject(supabase: any, userId: string, id: string) {
  const { data } = await supabase.from("projects").select("id, user_id, code_html, is_published, is_flagged, published_html, published_version").eq("id", id).single();
  return data && data.user_id === userId ? data : null;
}

export const liveUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const p = await ownProject(context.supabase, context.userId, data.id);
    if (!p) return { error: "প্রজেক্ট পাওয়া যায়নি" };
    if (!p.is_published) return { error: "সাইটটি এখনো প্রকাশিত নয়" };
    if (p.is_flagged) return { error: "এই প্রজেক্টটি পর্যালোচনার অপেক্ষায় আছে" };
    if (!p.code_html) return { error: "কোনো ওয়েবসাইট নেই" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { pushLive, hashHtml } = await import("./publish.server");
    if (p.published_html && hashHtml(p.published_html) === hashHtml(p.code_html)) {
      await supabaseAdmin.from("projects").update({ changes_since_publish: 0 }).eq("id", p.id);
      return { error: "নতুন কোনো পরিবর্তন নেই" };
    }
    const r = await pushLive(supabaseAdmin, context.userId, p, p.code_html);
    const { deployProject } = await import("./deploy.server");
    const { appOrigin } = await import("./origin.server");
    const dep = await deployProject(supabaseAdmin, p.id, appOrigin());
    return { ok: true as const, ...r, deployError: dep.ok ? null : "সার্ভারে পাঠানো যায়নি" };
  });

export const listVersions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => Id.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await context.supabase.from("project_versions").select("id, version_number, changelog_bn, created_at").eq("project_id", data.id).order("version_number", { ascending: false }).limit(50);
    return rows ?? [];
  });

export const rollbackVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; versionId: string }) => z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const p = await ownProject(context.supabase, context.userId, data.id);
    if (!p) return { error: "প্রজেক্ট পাওয়া যায়নি" };
    if (!p.is_published) return { error: "আগে সাইট প্রকাশ করুন" };
    const { data: v } = await context.supabase.from("project_versions").select("version_number, code_html").eq("id", data.versionId).eq("project_id", data.id).single();
    if (!v) return { error: "ভার্সন পাওয়া যায়নি" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashHtml } = await import("./publish.server");
    const { error } = await supabaseAdmin.from("projects").update({ code_html: v.code_html, published_html: v.code_html, published_code_hash: hashHtml(v.code_html), changes_since_publish: 0 }).eq("id", data.id);
    if (error) return { error: "রোলব্যাক করা যায়নি" };
    const { deployProject } = await import("./deploy.server");
    const { appOrigin } = await import("./origin.server");
    await deployProject(supabaseAdmin, data.id, appOrigin());
    return { ok: true as const, version: v.version_number as number, html: v.code_html as string };
  });
