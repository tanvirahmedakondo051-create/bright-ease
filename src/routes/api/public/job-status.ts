import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Q = z.object({ id: z.string().uuid(), after: z.coerce.number().int().min(0).default(0) });

// Short poll for a background build: owner only (RLS as the signed-in user).
export const Route = createFileRoute("/api/public/job-status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (!token) return Response.json({ error: "unauthorized" }, { status: 401 });
        const u = new URL(request.url);
        const p = Q.safeParse({ id: u.searchParams.get("id"), after: u.searchParams.get("after") ?? 0 });
        if (!p.success) return Response.json({ error: "bad request" }, { status: 400 });
        const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
        const sb = createClient(process.env["SUPABASE_URL"]!, key, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { headers: { Authorization: `Bearer ${token}`, apikey: key } },
        });
        const { data: j } = await sb.from("generation_jobs").select("status, events, mode, created_at").eq("id", p.data.id).maybeSingle();
        const h = { "cache-control": "no-store" };
        if (!j) return Response.json({ status: "missing", events: [], total: 0, mode: "build", createdAt: null }, { headers: h });
        const evs = (j.events as any[]) ?? [];
        return Response.json({ status: j.status, events: evs.slice(p.data.after), total: evs.length, mode: j.mode, createdAt: j.created_at }, { headers: h });
      },
    },
  },
});
