import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ownerDb(context: { userId: string }, projectId: string) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: p } = await db.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!p || p.user_id !== context.userId) throw new Error("Forbidden");
  return { db, p };
}

/** Asks the AI for a schema and creates the project's tables (1-click "Auto Setup"). */
export const setupBackend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; prompt: string }) => z.object({ projectId: z.string().uuid(), prompt: z.string().trim().min(2).max(3000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, p } = await ownerDb(context, data.projectId);
    const b = await import("@/lib/backend.server");
    const { effectivePlan, allowedProviders } = await import("@/lib/plan.server");
    const [profile, { data: settings }, { data: existing }] = await Promise.all([
      effectivePlan(db, context.userId),
      db.from("site_settings").select("tokens_per_coin").eq("id", 1).single(),
      db.from("backend_tables").select("table_name, schema_json").eq("project_id", p.id),
    ]);
    if (!profile || Number((profile as any).coins ?? 0) <= 0) return { error: "কয়েন শেষ" };
    const providers = await allowedProviders(db, profile.plans);
    if (!providers?.length) return { error: "এখনো কোনো AI সংযুক্ত নেই" };
    const out = await b.autoSetupBackend(db, p, context.userId, data.prompt, providers, settings?.tokens_per_coin ?? 10000, existing ?? []);
    return out;
  });

export const listBackend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string }) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, p } = await ownerDb(context, data.projectId);
    const { data: tables } = await db.from("backend_tables").select("table_name, schema_json, created_at").eq("project_id", p.id).order("created_at");
    const counts = await Promise.all((tables ?? []).map((t) => db.from("backend_rows").select("id", { count: "exact", head: true }).eq("project_id", p.id).eq("table_name", t.table_name)));
    const { count: users } = await db.from("site_users").select("id", { count: "exact", head: true }).eq("project_id", p.id);
    const b = await import("@/lib/backend.server");
    return { enabled: p.backend_enabled, users: users ?? 0, limits: await b.backendLimits(db), tables: (tables ?? []).map((t, i) => ({ name: t.table_name, schema: t.schema_json as any, rows: counts[i].count ?? 0 })) };
  });

export const backendRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; table: string; page: number }) => z.object({ projectId: z.string().uuid(), table: z.string().max(40), page: z.number().int().min(0).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, p } = await ownerDb(context, data.projectId);
    const { data: rows } = await db.from("backend_rows").select("id, data, created_at").eq("project_id", p.id).eq("table_name", data.table).order("created_at", { ascending: false }).range(data.page * 25, data.page * 25 + 24);
    return { rows: (rows ?? []) as any[] };
  });

export const deleteBackendItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; table: string; rowId?: string }) => z.object({ projectId: z.string().uuid(), table: z.string().max(40), rowId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, p } = await ownerDb(context, data.projectId);
    if (data.rowId) await db.from("backend_rows").delete().eq("id", data.rowId).eq("project_id", p.id);
    else {
      await db.from("backend_rows").delete().eq("project_id", p.id).eq("table_name", data.table);
      await db.from("backend_tables").delete().eq("project_id", p.id).eq("table_name", data.table);
    }
    return { ok: true };
  });

export const setProjectType = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; type: "html" | "react" }) => z.object({ projectId: z.string().uuid(), type: z.enum(["html", "react"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, p } = await ownerDb(context, data.projectId);
    if (p.code_html) return { error: "সাইট তৈরির পর ধরন বদলানো যায় না" };
    if (data.type === "react") {
      const { getAgent } = await import("@/lib/deploy.server");
      if (!(await getAgent(db))) return { error: "React মোডের জন্য অ্যাডমিনকে আগে VPS সার্ভার সেটআপ করতে হবে" };
    }
    await db.from("projects").update({ project_type: data.type }).eq("id", p.id);
    return { ok: true };
  });
