// Server-only: talks to the deploy agent running on the admin's VPS (public/deploy-agent.js).
import { createHmac } from "node:crypto";

export type Agent = { url: string; token: string; hostingDomain: string };

export async function getAgent(db: any): Promise<Agent | null> {
  const [{ data: s }, { data: t }] = await Promise.all([
    db.from("site_settings").select("server_ip, agent_host, agent_port, hosting_domain").eq("id", 1).single(),
    db.from("app_secrets").select("value").eq("name", "deploy_token").maybeSingle(),
  ]);
  const host = (s?.agent_host || s?.server_ip || "").trim();
  if (!host || !t?.value) return null;
  return { url: `https://${host}:${s.agent_port || 8443}`, token: t.value, hostingDomain: s.hosting_domain || "" };
}

function sign(token: string, body: string) {
  const ts = String(Math.floor(Date.now() / 1000));
  return { ts, sig: createHmac("sha256", token).update(`${ts}.${body}`).digest("hex") };
}

/** POSTs to the agent and calls onStep for each NDJSON line it streams back. */
export async function agentCall(agent: Agent, path: string, payload: object, onStep?: (s: { step: string; msg?: string; url?: string; error?: string }) => Promise<void> | void, timeoutMs = 3600_000) {
  const body = JSON.stringify(payload);
  const { ts, sig } = sign(agent.token, body);
  const res = await fetch(agent.url + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Hexa-Timestamp": ts, "X-Hexa-Signature": sig },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok || !res.body) throw new Error(`agent ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let last: any = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const l of lines) {
      if (!l.trim()) continue;
      try { last = JSON.parse(l); await onStep?.(last); } catch { /* ignore */ }
    }
  }
  if (buf.trim()) { try { last = JSON.parse(buf); await onStep?.(last); } catch { /* ignore */ } }
  if (last?.error) throw new Error(last.error);
  return last;
}

export function siteDomains(p: { subdomain: string | null; custom_domain: string | null; domain_status: string }, hostingDomain: string) {
  const out: string[] = [];
  if (p.custom_domain && p.domain_status === "connected") out.push(p.custom_domain);
  if (p.subdomain && hostingDomain) out.push(`${p.subdomain}.${hostingDomain}`);
  return out;
}

const STEP_BN: Record<string, string> = {
  uploading: "আপলোড হচ্ছে...",
  nginx: "সার্ভার সেটআপ হচ্ছে...",
  ssl: "SSL চালু হচ্ছে...",
  live: "✅ লাইভ!",
  removed: "সার্ভার থেকে মুছে ফেলা হয়েছে",
};

/** Renders the site exactly as visitors should see it and pushes it to every domain on the VPS. */
export async function deployProject(db: any, projectId: string, appOrigin: string): Promise<{ ok: boolean; url?: string; skipped?: boolean; error?: string }> {
  const agent = await getAgent(db);
  const { data: p } = await db.from("projects").select("id, subdomain, custom_domain, domain_status, is_published").eq("id", projectId).single();
  if (!p) return { ok: false, error: "not found" };
  const domains = agent ? siteDomains(p, agent.hostingDomain) : [];
  if (!agent || !domains.length) return { ok: true, skipped: true };
  const set = (deploy_status: string, deploy_message: string, extra: object = {}) =>
    db.from("projects").update({ deploy_status, deploy_message, ...extra }).eq("id", projectId);
  if (!p.is_published) {
    for (const d of domains) await agentCall(agent, "/remove", { domain: d }).catch((e) => console.error("agent remove", e));
    await set("none", "", { deployed_url: null });
    return { ok: true };
  }
  const { renderPublishedSite } = await import("./site-render.server");
  const html = await (await renderPublishedSite({ subdomain: p.subdomain }, appOrigin)).text();
  await set("uploading", STEP_BN.uploading);
  try {
    let url = "";
    for (const d of domains) {
      const last = await agentCall(agent, "/deploy", { domain: d, html, ssl: true }, async (s) => {
        if (s.step && STEP_BN[s.step] && s.step !== "live") await set(s.step, STEP_BN[s.step]);
      });
      url ||= last?.url || `https://${d}`;
    }
    await set("live", STEP_BN.live, { deployed_url: url, deployed_at: new Date().toISOString() });
    return { ok: true, url };
  } catch (e: any) {
    console.error("deploy failed", e);
    await set("error", "সার্ভারে পাঠানো যায়নি — অ্যাডমিন সার্ভার সেটিংস দেখুন");
    return { ok: false, error: String(e?.message ?? e) };
  }
}

export async function removeDomains(db: any, domains: string[]) {
  const agent = await getAgent(db);
  if (!agent) return;
  for (const d of domains) await agentCall(agent, "/remove", { domain: d }).catch((e) => console.error("agent remove", e));
}

/** Creates the DNS zone for a custom domain on the VPS. "none" = no agent configured. */
export async function dnsAdd(db: any, domain: string): Promise<"ok" | "error" | "none"> {
  const agent = await getAgent(db);
  if (!agent) return "none";
  try { await agentCall(agent, "/dns-add", { domain }, undefined, 30_000); return "ok"; }
  catch (e) { console.error("dns add", e); return "error"; }
}

export async function dnsRemove(db: any, domain: string) {
  const agent = await getAgent(db);
  if (!agent) return;
  await agentCall(agent, "/dns-remove", { domain }, undefined, 30_000).catch((e) => console.error("dns remove", e));
}
