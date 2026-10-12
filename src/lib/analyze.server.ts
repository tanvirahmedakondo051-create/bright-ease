// Server-only: fetch a public website and extract its colours, fonts, sections and category.

export type Analysis = {
  url: string;
  title: string;
  description: string;
  colors: string[];
  fonts: string[];
  sections: string[];
  category: string;
};

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1|\[?fc|\[?fd)/i;

async function fetchText(url: string, max = 600_000) {
  const r = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; HexaAI-Analyzer/1.0)", accept: "text/html,text/css,*/*" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.text()).slice(0, max);
}

function normHex(h: string) {
  h = h.toLowerCase();
  if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  return h.slice(0, 7);
}
function rgbToHex(r: number, g: number, b: number) {
  return "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, "0")).join("");
}
function isNeutral(h: string) {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return Math.max(r, g, b) - Math.min(r, g, b) < 18;
}

const CATS: [string, RegExp][] = [
  ["ই-কমার্স / অনলাইন শপ", /shop|cart|buy|product|price|store|checkout|daraz|ক্রয়|দোকান|পণ্য/i],
  ["নিউজ / ব্লগ", /news|blog|article|post|খবর|সংবাদ/i],
  ["রেস্টুরেন্ট / খাবার", /restaurant|food|menu|cafe|pizza|খাবার|রেস্টুরেন্ট/i],
  ["শিক্ষা", /course|learn|school|education|university|শিক্ষা|কোর্স/i],
  ["পোর্টফোলিও", /portfolio|designer|developer|my work|resume/i],
  ["SaaS / সফটওয়্যার", /saas|software|app|platform|dashboard|api|pricing/i],
  ["ভ্রমণ / হোটেল", /travel|hotel|tour|booking|flight/i],
];

export async function analyzeUrl(url: string): Promise<{ error: string } | { ok: true; analysis: Analysis }> {
  const data = { url };
  {
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(data.url) ? data.url : "https://" + data.url);
    } catch {
      return { error: "সঠিক ওয়েবসাইট লিংক দিন" };
    }
    if (!/^https?:$/.test(u.protocol) || PRIVATE.test(u.hostname) || !u.hostname.includes(".")) return { error: "এই লিংকটি বিশ্লেষণ করা যাবে না" };

    let html: string;
    try {
      html = await fetchText(u.toString());
    } catch {
      return { error: "ওয়েবসাইটটি খোলা যায়নি। লিংক ঠিক আছে কিনা দেখুন।" };
    }

    // collect CSS: inline <style> + up to 3 linked stylesheets
    let css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
    css += "\n" + [...html.matchAll(/style="([^"]*)"/gi)].map((m) => m[1]).join(";");
    const links = [...html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi)]
      .map((m) => /href=["']([^"']+)["']/i.exec(m[0])?.[1])
      .filter(Boolean)
      .slice(0, 3) as string[];
    const sheets = await Promise.all(links.map((h) => fetchText(new URL(h, u).toString(), 400_000).catch(() => "")));
    css += "\n" + sheets.join("\n");

    // colors
    const counts = new Map<string, number>();
    const add = (h: string) => counts.set(h, (counts.get(h) ?? 0) + 1);
    for (const m of css.matchAll(/#([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) add(normHex(m[0]));
    for (const m of css.matchAll(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/gi)) add(rgbToHex(+m[1], +m[2], +m[3]));
    const theme = /<meta[^>]+name=["']theme-color["'][^>]*content=["'](#[0-9a-f]{3,6})/i.exec(html)?.[1];
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
    const colorful = sorted.filter((h) => !isNeutral(h));
    const neutral = sorted.filter((h) => isNeutral(h));
    const colors = [...new Set([...(theme ? [normHex(theme)] : []), ...colorful.slice(0, 4), ...neutral.slice(0, 2)])].slice(0, 5);

    // fonts
    const fonts = new Set<string>();
    for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>]+)/gi))
      for (const f of m[1].matchAll(/family=([^&:;]+)/g)) fonts.add(decodeURIComponent(f[1]).replace(/\+/g, " "));
    for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
      const first = m[1].split(",")[0].trim().replace(/["']/g, "");
      if (first && !/^(inherit|initial|var\(|sans-serif|serif|monospace|system-ui|-apple-system|icon|unset)/i.test(first) && first.length < 40) fonts.add(first);
    }

    // sections
    const body = html.replace(/<script[\s\S]*?<\/script>/gi, "");
    const sections: string[] = [];
    if (/<header|class=["'][^"']*(header|navbar)/i.test(body)) sections.push("হেডার / নেভিগেশন");
    if (/class=["'][^"']*(hero|banner|slider|carousel|jumbotron)/i.test(body)) sections.push("হিরো / ব্যানার স্লাইডার");
    for (const m of body.matchAll(/<section[^>]*(?:id|class)=["']([^"']+)["']/gi)) {
      const n = m[1].split(/\s+/)[0].replace(/[-_]/g, " ").slice(0, 30);
      if (n && !sections.includes(n)) sections.push(n);
      if (sections.length > 10) break;
    }
    const heads = [...body.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => m[1].replace(/<[^>]+>/g, "").trim()).filter((t) => t && t.length < 60).slice(0, 6);
    for (const h of heads) if (sections.length < 12) sections.push(h);
    if (/class=["'][^"']*(product|card|grid)/i.test(body) && sections.length < 13) sections.push("কার্ড / প্রোডাক্ট গ্রিড");
    if (/<form/i.test(body)) sections.push("ফর্ম");
    if (/<footer/i.test(body)) sections.push("ফুটার");

    const title = (/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? u.hostname).trim().slice(0, 120);
    const description = (/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)/i.exec(html)?.[1] ?? "").slice(0, 200);
    const hay = `${u.hostname} ${title} ${description} ${body.slice(0, 20000)}`;
    const category = CATS.find(([, re]) => re.test(hay))?.[0] ?? "সাধারণ ওয়েবসাইট";

    return {
      ok: true,
      analysis: { url: u.toString(), title, description, colors, fonts: [...fonts].slice(0, 5), sections: sections.length ? sections : ["হেডার", "মূল কনটেন্ট", "ফুটার"], category },
    };
  }
}

export function analysisContext(a: Analysis) {
  return `ANALYZED WEBSITE (${a.url}) — use as STYLE INSPIRATION only, create ORIGINAL content, do not copy text or images:
- Title: ${a.title}
- Category: ${a.category}
- Colors: ${a.colors.join(", ")}
- Fonts: ${a.fonts.join(", ") || "unknown"}
- Layout sections: ${a.sections.join(" → ")}`;
}
