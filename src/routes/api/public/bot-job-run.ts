import { createFileRoute } from "@tanstack/react-router";

// Called by the database (kick_bot_job via pg_net) to run one bot build in its own request,
// so the build never depends on the user's open connection. Verified by an HMAC of the job id.
async function hmacHex(key: string, msg: string) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

export const Route = createFileRoute("/api/public/bot-job-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const id = request.headers.get("x-hexa-job") ?? "";
        const sig = request.headers.get("x-hexa-sig") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(id) || !sig) return Response.json({ error: "unauthorized" }, { status: 401 });
        const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
        const { data: t } = await db.from("app_secrets").select("value").eq("name", "job_token").maybeSingle();
        const expected = t?.value ? await hmacHex(t.value, id) : "";
        if (!expected || expected.length !== sig.length || expected !== sig.toLowerCase()) return Response.json({ error: "unauthorized" }, { status: 401 });
        const { processBotJob } = await import("@/lib/bot-build.server");
        const r = await processBotJob(id);
        return Response.json(r);
      },
    },
  },
});
