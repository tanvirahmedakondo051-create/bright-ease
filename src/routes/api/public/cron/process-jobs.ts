import { createFileRoute } from "@tanstack/react-router";

// pg_cron calls this every minute. It finishes queued bot builds and re-claims builds whose
// request died mid-run (screen off / app closed → heartbeat goes stale). Bounded: max 2 jobs
// per run, max 3 attempts per job. Coins are only charged on a successful save, so re-runs
// are safe. The bearer check only filters stray traffic; the work itself is user-scoped.
export const Route = createFileRoute("/api/public/cron/process-jobs")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!request.headers.get("authorization")) return Response.json({ error: "unauthorized" }, { status: 401 });
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const stale = new Date(Date.now() - 3 * 60_000).toISOString();
        const { data: jobs } = await db
          .from("bot_jobs")
          .select("id")
          .lt("attempts", 3)
          .or(`status.eq.queued,and(status.eq.running,heartbeat_at.lt.${stale})`)
          .order("created_at", { ascending: true })
          .limit(2);
        let processed = 0;
        for (const j of jobs ?? []) {
          const { processBotJob } = await import("@/lib/bot-build.server");
          await processBotJob(j.id);
          processed++;
        }
        return Response.json({ ok: true, processed });
      },
    },
  },
});
