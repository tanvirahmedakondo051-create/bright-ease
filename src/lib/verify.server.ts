/** Post-build checks for generated HTML sites: pages, menu links, empty sections, broken images. Auto-fixes what it safely can. */

export type VerifyReport = { pages: number; links: number; brokenLinks: number; brokenNames: string[]; emptySections: number; images: number; fixedImages: number; brokenImages: number; qa?: string };


/** Depth-aware [start,end) of the first element with data-page="name" (handles nested sections). */
export function findPageBlock(html: string, name: string, from = 0): [number, number] | null {
  const re = new RegExp(`<(section|div|main|article)\\b[^>]*\\bdata-page=["']${name}["'][^>]*>`, "ig");
  re.lastIndex = from;
  const m = re.exec(html);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  const tagRe = new RegExp(`<(/?)${tag}\\b[^>]*>`, "ig");
  tagRe.lastIndex = m.index + m[0].length;
  let depth = 1, t: RegExpExecArray | null;
  while ((t = tagRe.exec(html))) {
    depth += t[1] ? -1 : 1;
    if (depth === 0) return [m.index, tagRe.lastIndex];
  }
  return null;
}

/** Visible text of a whole page (nested sections included), or null if missing. */
export function pageText(html: string, name: string): string | null {
  const b = findPageBlock(html, name);
  if (!b) return null;
  return html.slice(b[0], b[1]).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** Remove every occurrence of a page, whole (never leaves orphaned inner sections). */
export function removePage(html: string, name: string): string {
  let out = html, b = findPageBlock(out, name);
  while (b) { out = out.slice(0, b[0]) + out.slice(b[1]); b = findPageBlock(out, name); }
  return out;
}

/** Keep only the first copy of each page. */
export function dedupePagesDeep(html: string): string {
  let out = html;
  for (const name of pageNames(out)) {
    const first = findPageBlock(out, name);
    if (!first) continue;
    let b = findPageBlock(out, name, first[1]);
    while (b) { out = out.slice(0, b[0]) + out.slice(b[1]); b = findPageBlock(out, name, first[1]); }
  }
  return out;
}

/** Insert page fragment after the last existing page, else before </body>. */
export function insertPage(html: string, frag: string): string {
  let at = -1;
  for (const name of pageNames(html)) { const b = findPageBlock(html, name); if (b && b[1] > at) at = b[1]; }
  if (at > 0) return html.slice(0, at) + "\n" + frag + html.slice(at);
  return html.replace(/<\/body>/i, `${frag}\n</body>`);
}

const pageNames = (html: string) => [...new Set([...html.matchAll(/data-page=["']([\w-]+)["']/g)].map((m) => m[1].toLowerCase()))];

/** SSRF protection: only allow public http(s) URLs, block private IPs and metadata endpoints. */
function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) return false;
    const h = u.hostname.toLowerCase();
    // Block localhost, private IPs, cloud metadata
    if (h === "localhost" || h === "metadata.google.internal") return false;
    if (/^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.)/.test(h)) return false;
    if (h === "[::1]" || h.startsWith("[fd") || h.startsWith("[fe80")) return false;
    return true;
  } catch { return false; }
}

async function urlOk(url: string) {
  if (!isSafeUrl(url)) return false;
  try {
    let r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000), redirect: "follow" });
    if (r.status === 405 || r.status === 403) r = await fetch(url, { method: "GET", signal: AbortSignal.timeout(5000), headers: { Range: "bytes=0-0" } });
    return r.ok || r.status === 206;
  } catch { return false; }
}

export async function verifySite(db: any, html: string, appOrigin: string): Promise<{ html: string; report: VerifyReport }> {
  let out = html;
  const pages = pageNames(out);
  // Menu links to pages that don't exist → send them home instead of a blank page.
  let links = 0, brokenLinks = 0;
  const brokenNames: string[] = [];
  for (const m of out.matchAll(/href=(["'])#\/([\w-]*)\1/g)) {
    links++;
    const name = (m[2] || "home").toLowerCase();
    if (name !== "home" && !pages.includes(name)) { brokenLinks++; brokenNames.push(name); }
  }
  // Empty sections (no text, image, icon or form inside).
  let emptySections = 0;
  for (const m of out.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)) {
    const inner = m[1];
    const text = inner.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").trim();
    if (text.length < 3 && !/<(img|svg|iframe|video|form|lottie-player|canvas|iconify-icon)/i.test(inner)) emptySections++;
  }
  // Images: check unique external URLs, swap broken ones for library photos.
  const urls = [...new Set([...out.matchAll(/<img\b[^>]*\bsrc=["'](https?:\/\/[^"']+)["']/gi)].map((m) => m[1]))].slice(0, 24);
  const own = (u: string) => u.startsWith(appOrigin + "/uploads/");
  const results = await Promise.all(urls.map(async (u) => [u, own(u) ? true : await urlOk(u)] as const));
  const bad = results.filter(([, ok]) => !ok).map(([u]) => u);
  let fixedImages = 0;
  if (bad.length) {
    const { data } = await db.from("curated_photos").select("url").eq("enabled", true).limit(60);
    const pool = ((data ?? []) as { url: string }[]).map((p) => p.url).filter((u) => !bad.includes(u) && !urls.includes(u));
    for (const u of bad) {
      const rep = pool.shift();
      if (!rep) break;
      out = out.split(u).join(rep);
      fixedImages++;
    }
  }
  // Emoji used as a picture (a lone emoji inside an image/card box) → real library photo.
  const EMO = /^\s*(?:\p{Extended_Pictographic}\uFE0F?\s*){1,3}$/u;
  const boxes = [...out.matchAll(/<(div|span|figure)\b([^>]*class=["'][^"']*(?:img|image|photo|thumb|emoji|icon-lg|dish|card-media|food)[^"']*["'][^>]*)>([^<]{1,12})<\/\1>/gi)].filter((m) => EMO.test(m[3]));
  let emojiImages = 0;
  if (boxes.length) {
    const cat = /খাবার|রেস্টুরেন্ট|food|menu|dish|মেনু/i.test(out) ? "food" : /product|পণ্য|শপ/i.test(out) ? "product" : "lifestyle";
    const { data } = await db.from("curated_photos").select("url, alt").eq("enabled", true).eq("category", cat).limit(30);
    const pool = ((data ?? []) as { url: string; alt: string }[]).sort(() => Math.random() - 0.5);
    for (const m of boxes) {
      const ph = pool[emojiImages % Math.max(1, pool.length)];
      if (!ph) break;
      out = out.replace(m[0], `<${m[1]}${m[2]}><img src="${ph.url}" alt="${ph.alt.replace(/"/g, "")}" loading="lazy" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block"></${m[1]}>`);
      emojiImages++;
    }
  }
  const disabledButtons = [...out.matchAll(/<button\b[^>]*\bdisabled\b[^>]*>/gi)].length;
  if (emojiImages) fixedImages += emojiImages;
  return { html: out, report: { pages: pages.length, links, brokenLinks, brokenNames, emptySections, images: urls.length, fixedImages, brokenImages: bad.length - fixedImages } };
}

const bnNum = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

export function reportText(r: VerifyReport) {
  const ok: string[] = [];
  if (r.pages) ok.push(`${bnNum(r.pages)}টি পেজ`);
  if (r.links) ok.push(`${bnNum(r.links - r.brokenLinks)}টি মেনু লিংক ঠিক আছে`);
  if (r.images) ok.push(`${bnNum(r.images - r.fixedImages - r.brokenImages)}টি ছবি লোড হচ্ছে`);
  const fixes: string[] = [];
  if (r.fixedImages) fixes.push(`${bnNum(r.fixedImages)}টি ছবি বদলানো হয়েছে`);
  const warn: string[] = [];
  if (r.brokenLinks) warn.push(`${bnNum(r.brokenLinks)}টি লিংকের পেজ নেই`);
  if (r.brokenImages) warn.push(`${bnNum(r.brokenImages)}টি ছবি লোড হয়নি`);
  if (r.emptySections) warn.push(`${bnNum(r.emptySections)}টি খালি অংশ`);
  let t = `🔎 চেক রিপোর্ট: ✅ ${ok.join(" • ") || "সব ঠিক আছে"}`;
  if (fixes.length) t += `\n🛠️ ${fixes.join(" • ")}`;
  if (warn.length) t += `\n⚠️ ${warn.join(" • ")}`;
  if (r.qa) t += `\n${r.qa}`;
  return t;
}

/** BULLETPROOF: Deep validation — every page must have real content, every button must work. */
export function bulletproofCheck(html: string, expectedPages: string[]): { pass: boolean; issues: string[] } {
  const issues: string[] = [];
  // 1. Check all expected pages exist with real content
  for (const pg of expectedPages) {
    const m = html.match(new RegExp(`<(?:section|div|main)[^>]*data-page=["']${pg}["'][\\s\\S]*?</(?:section|div|main)>`, "i"));
    if (!m) { issues.push(`missing-page:${pg}`); continue; }
    const text = m[0].replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").trim();
    if (text.length < 300) issues.push(`empty-page:${pg} (${text.length} chars)`);
  }
  // 2. Check for duplicate pages
  const allPages = [...html.matchAll(/data-page=["']([\w-]+)["']/g)].map((x) => x[1].toLowerCase());
  const dupes = allPages.filter((p, i) => allPages.indexOf(p) !== i);
  if (dupes.length) issues.push(`duplicate-pages:${[...new Set(dupes)].join(",")}`);
  // 3. Check buttons have REAL actions (not just onclick= with undefined function)
  const forms = [...html.matchAll(/<form\b[\s\S]*?<\/form>/gi)].map((m) => [m.index!, m.index! + m[0].length]);
  const inForm = (i: number) => forms.some(([a, b]) => i > a && i < b);
  const js = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join("\n");
  const defined = (fn: string) => new RegExp(`function\\s+${fn}\\b|(?:const|let|var)\\s+${fn}\\s*=|window\\.${fn}\\s*=`).test(js);
  let dead = 0; const undef = new Set<string>();
  for (const b of html.matchAll(/<button\b([^>]*)>/gi)) {
    const a = b[1];
    if (/\bdisabled\b/i.test(a)) continue;
    const oc = a.match(/onclick=(["'])([\s\S]*?)\1/i)?.[2];
    if (oc) {
      if (/\balert\s*\(/.test(oc)) issues.push("alert-in-onclick");
      const fn = oc.match(/^\s*([A-Za-z_$][\w$]*)\s*\(/)?.[1];
      if (fn && !/^(showToast|window|document|history|console)$/.test(fn) && !defined(fn)) undef.add(fn);
      continue;
    }
    if (/data-action=|data-nav=|data-href=/i.test(a)) continue;
    const type = a.match(/\btype=["']?(\w+)/i)?.[1]?.toLowerCase();
    if ((!type || type === "submit") && inForm(b.index!)) continue;
    dead++;
  }
  if (dead) issues.push(`dead-buttons:${dead}`);
  if (undef.size) issues.push(`undefined-handlers:${[...undef].join(",")}`);
  // 4. Check nav links point to real pages
  const navLinks = [...html.matchAll(/href=["']#\/([\w-]*)["']/g)].map((x) => (x[1] || "home").toLowerCase());
  for (const l of [...new Set(navLinks)]) {
    if (l && !allPages.includes(l)) issues.push(`broken-nav:#/${l}`);
  }
  if (navLinks.includes("home") && !allPages.includes("home")) issues.push("missing-page:home");
  // 5. Check for lorem ipsum / placeholder
  if (/lorem ipsum|coming soon|under construction/i.test(html)) issues.push("placeholder-text");
  // 6. Minimum viable size
  if (html.length < 30000 && expectedPages.length >= 2) issues.push(`too-small:${html.length} chars`);
  return { pass: issues.length === 0, issues };
}
