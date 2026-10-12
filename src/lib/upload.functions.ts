import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml", "application/pdf", "text/plain", "application/zip", "application/x-zip-compressed", "application/octet-stream"];

const MAX_MB = 50;
const MAX_B64 = Math.ceil(MAX_MB * 1024 * 1024 * 4 / 3) + 1000;

export const uploadChatFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; name: string; type: string; data: string }) =>
    z.object({ projectId: z.string().uuid(), name: z.string().min(1).max(120), type: z.string().max(60), data: z.string().max(MAX_B64) }).parse(d))
  .handler(async ({ data, context }) => {
    if (!TYPES.includes(data.type)) return { error: "শুধু ছবি, PDF, টেক্সট বা ZIP ফাইল দেওয়া যাবে" };
    const { data: p } = await context.supabase.from("projects").select("id, user_id").eq("id", data.projectId).single();
    if (!p || p.user_id !== context.userId) return { error: "প্রজেক্ট পাওয়া যায়নি" };
    const bytes = Buffer.from(data.data, "base64");
    if (bytes.length > MAX_MB * 1024 * 1024) return { error: `ফাইল ${MAX_MB}MB এর বেশি হতে পারবে না` };
    const ext = data.name.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase() ?? "bin";
    const base = data.name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) || "file";
    const file = `${base}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.${ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage.from("uploads").upload(`${p.id}/${file}`, bytes, { contentType: data.type, upsert: false });
    if (error) { console.error("upload", error.message); return { error: `আপলোড করা যায়নি: ${error.message}` }; }
    const { appOrigin } = await import("./origin.server");
    return { ok: true as const, path: `${p.id}/${file}`, url: `${appOrigin()}/uploads/${p.id}/${file}`, name: data.name, type: data.type };
  });
