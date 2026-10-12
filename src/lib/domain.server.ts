// Server-only: look up a domain's public nameservers over DNS-over-HTTPS and compare with admin settings.
const norm = (s: string) => s.trim().toLowerCase().replace(/\.$/, "");

async function nsFor(name: string): Promise<string[]> {
  const urls = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=NS`,
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=NS`,
  ];
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { accept: "application/dns-json" } });
      if (!r.ok) continue;
      const j: any = await r.json();
      return (j?.Answer ?? []).filter((a: any) => a.type === 2).map((a: any) => norm(String(a.data)));
    } catch { /* try next */ }
  }
  return [];
}

export async function checkNameservers(db: any, domain: string) {
  const { data: s } = await db.from("site_settings").select("ns1, ns2, ns3, ns4").eq("id", 1).maybeSingle();
  const expected = [s?.ns1, s?.ns2, s?.ns3, s?.ns4].filter(Boolean).map((x: string) => norm(x));
  // Subdomains usually have no NS records of their own; walk up to the registered domain.
  const labels = norm(domain).split(".");
  let found: string[] = [];
  for (let i = 0; i <= labels.length - 2 && !found.length; i++) found = await nsFor(labels.slice(i).join("."));
  found = [...new Set(found)].sort();
  let status: "pending" | "connected" | "wrong";
  if (!expected.length || !found.length) status = "pending";
  else status = found.every((f) => expected.includes(f)) && expected.slice(0, 2).every((e) => found.includes(e)) ? "connected" : "wrong";
  return { status, found, expected };
}
