import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { callAsAppUser } from "@/integrations/lovable/appUserConnector";

export const GATEWAY = "https://connector-gateway.lovable.dev";
export const GITHUB_SCOPES = ["read:user", "repo"];

function key(): Buffer {
  const raw = process.env['APP_USER_CONNECTION_KEY_SECRET'];
  if (!raw) throw new Error("APP_USER_CONNECTION_KEY_SECRET is not set");
  return Buffer.from(raw, "base64");
}
export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}
export function decrypt(stored: string) {
  const b = Buffer.from(stored, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}

export async function adminDb() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function getConn(userId: string) {
  const db = await adminDb();
  const { data } = await db.from("github_connections").select("*").eq("user_id", userId).maybeSingle();
  return data ? { ...data, key: decrypt(data.access_token_encrypted) } : null;
}

export async function gh(connKey: string, path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/vnd.github+json");
  if (init?.body) headers.set("Content-Type", "application/json");
  return callAsAppUser({ gatewayBaseUrl: GATEWAY, connectionAPIKey: connKey, connectorId: "github", path, init: { ...init, headers }, requiredScopes: GITHUB_SCOPES });
}

export const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");
export const unb64 = (s: string) => Buffer.from(s.replace(/\n/g, ""), "base64").toString("utf8");
