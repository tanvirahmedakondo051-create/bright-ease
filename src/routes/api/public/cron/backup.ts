import { createFileRoute } from "@tanstack/react-router";

// Daily (00:00 Dhaka): send a full SQL backup to the admin's Telegram. Caller proves itself with app_secrets.backup_token.
export const Route = createFileRoute("/api/public/cron/backup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const given = request.headers.get("x-hexa-cron") ?? "";
        const { data: t } = await db.from("app_secrets").select("value").eq("name", "backup_token").maybeSingle();
        const { timingSafeEqual, createHash } = await import("node:crypto");
        const h = (v: string) => createHash("sha256").update(v).digest();
        if (!given || !t?.value || !timingSafeEqual(h(given), h(t.value))) return new Response("Unauthorized", { status: 401 });
        const { sendBackupToTelegram } = await import("@/lib/backup.server");
        const res = await sendBackupToTelegram(db);
        return Response.json(res, { status: "error" in res ? 500 : 200 });
      },
    },
  },
});
