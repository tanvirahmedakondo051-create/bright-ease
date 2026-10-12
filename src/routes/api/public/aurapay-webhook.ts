import { createFileRoute } from "@tanstack/react-router";

// Never trusts the body: the transaction is re-verified with AuraPay before any plan is applied.
async function handle(request: Request) {
  const url = new URL(request.url);
  let tx = url.searchParams.get("transactionId") ?? url.searchParams.get("transaction_id") ?? "";
  if (!tx && request.method === "POST") {
    const text = await request.text().catch(() => "");
    try {
      const j: any = JSON.parse(text);
      tx = String(j?.transaction_id ?? j?.transactionId ?? j?.data?.transaction_id ?? "");
    } catch {
      const f = new URLSearchParams(text);
      tx = f.get("transaction_id") ?? f.get("transactionId") ?? "";
    }
  }
  if (!tx || tx.length > 200) return new Response("bad request", { status: 400 });
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { auraVerifyAndApply } = await import("@/lib/plan.server");
  const r = await auraVerifyAndApply(db, tx);
  return Response.json({ ok: !!r.ok });
}

export const Route = createFileRoute("/api/public/aurapay-webhook")({
  server: { handlers: { POST: ({ request }) => handle(request), GET: ({ request }) => handle(request) } },
});
