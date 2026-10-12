import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Daily: expire paid plans and return users to the default plan.
export const Route = createFileRoute("/api/public/cron/expiry")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const given = request.headers.get("x-hexa-cron") ?? "";
        let ok = false;
        if (given) {
          const { data: t } = await db.from("app_secrets").select("value").eq("name", "cron_token").maybeSingle();
          const { timingSafeEqual, createHash } = await import("node:crypto");
          const h = (v: string) => createHash("sha256").update(v).digest();
          ok = !!t?.value && timingSafeEqual(h(given), h(t.value));
        }
        if (!ok) {
          const denied = await authenticateCronRequest(request);
          if (denied) return denied;
        }
        const { effectivePlan } = await import("@/lib/plan.server");
        const { data: expiring } = await db.from("profiles").select("id").lt("plan_expires_at", new Date().toISOString()).limit(500);
        for (const p of expiring ?? []) await effectivePlan(db, p.id);
        return Response.json({ ok: true, expired: expiring?.length ?? 0 });
      },
    },
  },
});
