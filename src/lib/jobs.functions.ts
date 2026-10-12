import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Status + new events of a background build job (owner only via RLS). */
export const getJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid(), after: z.number().int().min(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: j } = await context.supabase.from("generation_jobs").select("status, events, mode, created_at, heartbeat_at").eq("id", data.jobId).maybeSingle();
    if (!j) return { status: "missing", events: [], total: 0, mode: "build", createdAt: null as string | null };
    const evs = (j.events as any[]) ?? [];
    return { status: j.status, events: evs.slice(data.after), total: evs.length, mode: j.mode, createdAt: j.created_at };
  });

/** Latest still-active job of a project, so progress continues after reopening the builder. */
export const activeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: j } = await context.supabase.from("generation_jobs").select("id, mode, created_at").eq("project_id", data.projectId).in("status", ["queued", "running"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return j ? { id: j.id, mode: j.mode, createdAt: j.created_at } : null;
  });

export const cancelJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: j } = await context.supabase.from("generation_jobs").select("id").eq("id", data.jobId).maybeSingle();
    if (!j) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("generation_jobs").update({ status: "cancelled" }).eq("id", data.jobId).in("status", ["queued", "running"]);
    return { ok: true };
  });

/* ---------------- Bot build jobs (background builds) ---------------- */

/** Status + new progress events of a bot build job (owner only via RLS). */
export const botJobStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid(), after: z.number().int().min(0) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: j } = await context.supabase.from("bot_jobs").select("status, events, error, result, created_at").eq("id", data.jobId).maybeSingle();
    if (!j) return { status: "missing", events: [], total: 0, error: null as string | null, result: null as any, createdAt: null as string | null };
    const evs = (j.events as any[]) ?? [];
    return { status: j.status, events: evs.slice(data.after), total: evs.length, error: j.error, result: j.result, createdAt: j.created_at };
  });

/** Latest still-active build job of a bot, so progress resumes after reopening the studio. */
export const activeBotJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ botId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: j } = await context.supabase.from("bot_jobs").select("id, created_at").eq("bot_id", data.botId).in("status", ["queued", "running"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return j ? { id: j.id, createdAt: j.created_at } : null;
  });

export const cancelBotBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: j } = await context.supabase.from("bot_jobs").select("id, bot_id").eq("id", data.jobId).maybeSingle();
    if (!j) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("bot_jobs").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", data.jobId).in("status", ["queued", "running"]);
    // Also flag the bot so a build already inside the AI call stops before saving.
    await supabaseAdmin.from("bots").update({ cancel_requested_at: new Date().toISOString() }).eq("id", j.bot_id);
    return { ok: true };
  });
