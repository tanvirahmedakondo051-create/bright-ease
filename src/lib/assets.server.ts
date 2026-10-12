/** Free design asset selection (curated photos, Lottie, Iconify, optional Pexels) + post-processing for generated sites. */

type Photo = { url: string; alt: string; category: string; tags: string[] };

const SLUG_CATS: Record<string, string[]> = {
  shop: ["product", "lifestyle"], ecommerce: ["product", "lifestyle"],
  restaurant: ["food"], food: ["food"],
  portfolio: ["hero-creative", "hero-abstract"], blog: ["lifestyle", "hero-nature"],
  agency: ["hero-business", "office", "team"], coaching: ["office", "team", "hero-business"],
};
const KEYWORDS: [RegExp, string[]][] = [
  [/দোকান|শপ|shop|store|product|পণ্য|ecommerce/i, ["product", "lifestyle"]],
  [/রেস্টুরেন্ট|খাবার|ক্যাফে|restaurant|food|cafe|menu/i, ["food"]],
  [/পোর্টফোলিও|portfolio|designer|ডিজাইনার|শিল্পী|art/i, ["hero-creative", "hero-abstract"]],
  [/saas|software|সফটওয়্যার|অ্যাপ|app|tech|টেক|ai\b/i, ["hero-technology", "hero-abstract"]],
  [/এজেন্সি|agency|কোম্পানি|company|corporate|ব্যবসা|business/i, ["hero-business", "office"]],
  [/কোচিং|স্কুল|coaching|school|course|কোর্স/i, ["office", "team"]],
  [/ট্রাভেল|ভ্রমণ|travel|tour|nature|প্রকৃতি/i, ["hero-nature", "lifestyle"]],
  [/জিম|fitness|gym|health|স্বাস্থ্য/i, ["lifestyle"]],
];

function pickCats(prompt: string, slug?: string | null) {
  const cats = new Set<string>();
  if (slug && SLUG_CATS[slug]) SLUG_CATS[slug].forEach((c) => cats.add(c));
  for (const [re, c] of KEYWORDS) if (re.test(prompt)) c.forEach((x) => cats.add(x));
  if (!cats.size) ["hero-business", "hero-abstract"].forEach((c) => cats.add(c));
  cats.add("team");
  return [...cats];
}

const shuffle = <T,>(a: T[]) => a.map((v) => [Math.random(), v] as const).sort((x, y) => x[0] - y[0]).map((x) => x[1]);

export async function getPexelsKey(db: any): Promise<string | null> {
  const { data } = await db.from("app_secrets").select("value").eq("name", "pexels_api_key").maybeSingle();
  return data?.value || null;
}

export async function pexelsSearch(db: any, key: string, query: string): Promise<Photo[]> {
  const q = query.toLowerCase().trim().slice(0, 60);
  const { data: hit } = await db.from("pexels_cache").select("results, created_at").eq("query", q).maybeSingle();
  if (hit && Date.now() - new Date(hit.created_at).getTime() < 7 * 864e5) return hit.results as Photo[];
  const r = await fetch(`https://api.pexels.com/v1/search?per_page=6&query=${encodeURIComponent(q)}`, { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) throw new Error("pexels " + r.status);
  const j: any = await r.json();
  const results: Photo[] = (j.photos ?? []).map((p: any) => ({ url: p.src?.large2x || p.src?.large, alt: p.alt || q, category: "pexels", tags: [q] })).filter((p: Photo) => p.url);
  await db.from("pexels_cache").upsert({ query: q, results, created_at: new Date().toISOString() });
  return results;
}

/** English search term for Pexels from the pack/keywords. */
function pexelsQuery(cats: string[]) {
  const map: Record<string, string> = { product: "product photography", food: "restaurant food", "hero-creative": "creative studio", "hero-technology": "technology", "hero-business": "modern business", office: "modern office", "hero-nature": "nature landscape", lifestyle: "lifestyle people" };
  return map[cats.find((c) => map[c]) ?? "hero-business"];
}

export async function selectAssets(db: any, prompt: string, slug?: string | null) {
  const cats = pickCats(prompt, slug);
  const [{ data: photos }, { data: lotties }, { data: icons }] = await Promise.all([
    db.from("curated_photos").select("url, alt, category, tags").eq("enabled", true).in("category", cats),
    db.from("curated_lotties").select("json_url, title, category, tags").eq("enabled", true),
    db.from("icon_favorites").select("icon_set, name, tags").eq("enabled", true).limit(60),
  ]);
  let picked: Photo[] = [];
  const key = await getPexelsKey(db).catch(() => null);
  if (key) picked = (await pexelsSearch(db, key, pexelsQuery(cats)).catch(() => [])).slice(0, 4);
  const curated = shuffle((photos ?? []) as Photo[]);
  const team = curated.filter((p) => p.category === "team").slice(0, 2);
  picked = [...picked, ...curated.filter((p) => p.category !== "team")].slice(0, 4).concat(team);

  const lot = ((lotties ?? []) as any[]);
  const lottie = shuffle(lot.filter((l) => l.tags.some((t: string) => prompt.toLowerCase().includes(t)) || l.category === "hero"))[0] ?? null;
  const iconList = ((icons ?? []) as any[]).map((i) => `${i.icon_set}:${i.name}`).join(", ");

  const w = (u: string) => (/images\.unsplash\.com/.test(u) && !/[?&]w=/.test(u) ? `${u}?auto=format&fit=crop&w=1600&q=75` : u);
  return `\n\nFREE DESIGN ASSETS (licensed for free commercial use — use these, never invent image URLs):
PHOTOS (use the most relevant; every <img> needs descriptive alt, loading="lazy" except the hero, object-fit:cover):
${picked.map((p) => `- ${w(p.url)} — ${p.alt}`).join("\n") || "- (none: use gradient/SVG visuals)"}
${lottie ? `LOTTIE (optional, max one, hero or CTA only): <lottie-player src="${lottie.json_url}" background="transparent" loop autoplay style="width:100%;max-width:420px" aria-hidden="true"></lottie-player> — "${lottie.title}". Wrap it in a container with class "hx-lottie".` : ""}
ICONS: use Iconify SVG images: <img src="https://api.iconify.design/{set}:{name}.svg?color=%23HEX" width="24" height="24" alt="" aria-hidden="true" class="hx-icon">. Pick semantically. Suggested: ${iconList}. Other mdi/lucide/ph/tabler/carbon names are fine if they exist. Lordicon (<lord-icon src="https://cdn.lordicon.com/....json">) is allowed sparingly for feature/success icons.
RULES: NEVER use emoji as UI icons. Backgrounds: subtle Haikei-style inline SVG waves/blobs/layered gradients in brand colors — never downloaded background images. Hero = one strong photo OR visual background, plus Lottie only if it doesn't clutter. Scroll-reveal + hover interactions, respect prefers-reduced-motion. No irrelevant stock imagery.`;
}

const FALLBACK = `<script data-hx-fallback>(function(){document.addEventListener("error",function(e){var t=e.target;if(!t||t.tagName!=="IMG")return;if(t.classList.contains("hx-icon")){t.style.visibility="hidden";return}var d=document.createElement("div");d.setAttribute("role","img");d.setAttribute("aria-label",t.alt||"");d.style.cssText="width:100%;height:100%;min-height:"+(t.offsetHeight||200)+"px;border-radius:inherit;background:linear-gradient(135deg,rgba(99,102,241,.35),rgba(34,211,238,.25))";t.replaceWith(d)},true);setTimeout(function(){document.querySelectorAll("lottie-player").forEach(function(l){if(!l.shadowRoot||!l.shadowRoot.querySelector("svg,canvas")){var c=l.closest(".hx-lottie")||l;c.style.display="none"}})},6000);if(matchMedia("(prefers-reduced-motion: reduce)").matches)document.querySelectorAll("lottie-player").forEach(function(l){l.removeAttribute("autoplay");l.removeAttribute("loop")})})();</script>`;

/** Lightweight CSS-only animated backgrounds (Stripe-style mesh + shifting gradient). */
export const ANIMATED_BG_CSS = `<style data-hx-bg>
.hx-mesh{position:absolute;inset:0;overflow:hidden;z-index:0;pointer-events:none;isolation:isolate;background:var(--hx-c1,#1e1b4b)}
.hx-mesh::before,.hx-mesh::after,.hx-mesh>span{content:"";position:absolute;width:60vmax;height:60vmax;border-radius:50%;filter:blur(80px);opacity:.65;will-change:transform;animation:hx-drift 22s ease-in-out infinite alternate}
.hx-mesh::before{background:radial-gradient(circle,var(--hx-c2,#6366f1),transparent 65%);top:-25%;left:-15%}
.hx-mesh::after{background:radial-gradient(circle,var(--hx-c3,#22d3ee),transparent 65%);bottom:-30%;right:-15%;animation-duration:26s;animation-direction:alternate-reverse}
.hx-mesh>span:nth-child(1){background:radial-gradient(circle,var(--hx-c4,#0ea5e9),transparent 65%);top:20%;left:35%;animation-duration:30s}
.hx-mesh>span:nth-child(2){background:radial-gradient(circle,var(--hx-c2,#6366f1),transparent 65%);bottom:-10%;left:-20%;width:45vmax;height:45vmax;animation-duration:34s;animation-direction:alternate-reverse}
@keyframes hx-drift{0%{transform:translate(0,0) scale(1)}50%{transform:translate(8%,-6%) scale(1.12)}100%{transform:translate(-6%,8%) scale(.95)}}
.hx-gradient{background:linear-gradient(120deg,var(--hx-c1,#1e1b4b),var(--hx-c2,#6366f1),var(--hx-c3,#22d3ee),var(--hx-c4,#0ea5e9),var(--hx-c1,#1e1b4b));background-size:300% 300%;animation:hx-shift 18s ease-in-out infinite}
@keyframes hx-shift{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
@media (prefers-reduced-motion:reduce){.hx-mesh::before,.hx-mesh::after,.hx-mesh>span,.hx-gradient{animation:none}}
</style>`;

/** Inject only the scripts the page uses, lazy-load images, size Unsplash URLs, add graceful fallbacks. */
/** Hash router for multi-page sites: top-level [data-page] blocks shown at #/name; unknown → home; reveals content in the shown page. */
const PAGES = `<style data-hx-pages>[data-page][hidden]{display:none!important}[data-hx-off]{display:none!important}[data-page][data-hx-on]{display:block!important;visibility:visible!important;opacity:1!important}</style><script data-hx-pages>(function(){var P=[].slice.call(document.querySelectorAll("[data-page]")).filter(function(p){return !(p.parentElement&&p.parentElement.closest("[data-page]"))});if(!P.length)return;var N=P.map(function(p){return (p.getAttribute("data-page")||"").toLowerCase()});var H=N.indexOf("home")>=0?"home":N[0];function cur(){var m=location.hash.match(/^#\\/?([\\w-]*)/);var h=((m&&m[1])||"").toLowerCase();if(!h)return H;if(N.indexOf(h)>=0)return h;if(document.getElementById(h))return null;return H}function go(){var n=cur();if(n===null){var t=document.getElementById(location.hash.slice(1)),pg=t&&t.closest("[data-page]");if(pg)n=(pg.getAttribute("data-page")||"").toLowerCase();else return}P.forEach(function(p,i){var on=N[i]===n;p.hidden=!on;p.classList.toggle("active",on);if(on){p.removeAttribute("data-hx-off");p.setAttribute("data-hx-on","")}else{p.setAttribute("data-hx-off","");p.removeAttribute("data-hx-on")}});var sh=P[N.indexOf(n)];if(sh)sh.querySelectorAll(".reveal,.fade-up,.fade-in,[data-reveal],[data-aos],.animate-on-scroll").forEach(function(e){e.classList.add("visible","in-view","is-visible","show","active","revealed","aos-animate");e.style.opacity="";});document.querySelectorAll('a[href^="#"]').forEach(function(a){var t=(a.getAttribute("href").replace(/^#\\/?/,"")||H).toLowerCase();if(N.indexOf(t)<0)return;var on=t===n;a.classList.toggle("active",on);if(on)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current")});if(/^#\\/?[\\w-]*$/.test(location.hash||"#")&&N.indexOf(((location.hash.match(/^#\\/?([\\w-]*)/)||[])[1]||"").toLowerCase())>=0||!location.hash)window.scrollTo(0,0);window.dispatchEvent(new Event("scroll"))}window.addEventListener("hashchange",go);window.addEventListener("load",go);if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",go);else go();setTimeout(go,400)})();</script>`;
/** Removes AI-written page switchers that would fight the built-in router. */
function stripAiRouters(s: string) {
  return s.replace(/<script(?![^>]*\bsrc=)(?![^>]*data-hx)[^>]*>([\s\S]*?)<\/script>/gi, (m, body) => (/hashchange/.test(body) && /data-page/.test(body) ? "" : m));
}

/** Counters always show their real final number (never "0"); animate up when visible, re-run on page switch. */
const COUNTERS = `<script data-hx-count>(function(){var BN="০১২৩৪৫৬৭৮৯";function toEn(s){return String(s).replace(/[০-৯]/g,function(d){return BN.indexOf(d)})}function fmt(n,bn){var s=Math.round(n).toLocaleString("en-US");return bn?s.replace(/[0-9]/g,function(d){return BN[d]}):s}var sel="[data-count],[data-target],[data-counter],.counter,.count-up,.stat-number,.stat-num,.counter-value";function setup(){document.querySelectorAll(sel).forEach(function(el){if(el.dataset.hxc)return;var raw=el.getAttribute("data-count")||el.getAttribute("data-target")||el.getAttribute("data-counter")||el.textContent;var m=toEn(raw).replace(/,/g,"").match(/\\d+(\\.\\d+)?/);if(!m)return;var t=parseFloat(m[0]);if(!t)return;var bn=/[০-৯]/.test(raw+el.textContent);var txt=el.textContent;var suf=(txt.match(/[^\\d০-৯,.\\s]+\\s*$/)||[""])[0];if(!suf&&!/\\d|[০-৯]/.test(txt))suf="";el.dataset.hxc="1";el.dataset.hxt=t;el.dataset.hxs=suf;el.dataset.hxb=bn?"1":"";el.textContent=fmt(t,bn)+suf})}function run(el){var t=+el.dataset.hxt,s=el.dataset.hxs,bn=!!el.dataset.hxb,st=null;if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;function f(ts){if(!st)st=ts;var p=Math.min(1,(ts-st)/1600);el.textContent=fmt(t*(1-Math.pow(1-p,3)),bn)+s;if(p<1)requestAnimationFrame(f);else el.textContent=fmt(t,bn)+s}requestAnimationFrame(f)}function watch(){setup();var els=[].slice.call(document.querySelectorAll("[data-hxc]"));if(!("IntersectionObserver" in window))return;var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){io.unobserve(e.target);run(e.target)}})},{threshold:.3});els.forEach(function(el){io.observe(el)})}function go(){try{watch()}catch(e){}}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(go,50)});else setTimeout(go,50);window.addEventListener("hashchange",function(){setTimeout(go,80)});window.addEventListener("load",function(){setTimeout(function(){document.querySelectorAll("[data-hxc]").forEach(function(el){if(/^\\s*0\\D*$/.test(el.textContent))el.textContent=fmt(+el.dataset.hxt,!!el.dataset.hxb)+el.dataset.hxs})},2500)})})();</script>`;

const WAVE_CSS = `<style data-hx-wave>.hx-wave{display:block;line-height:0;margin:-1px 0;overflow:hidden}.hx-wave svg{display:block;width:100%;height:56px}@media(min-width:768px){.hx-wave svg{height:80px}}</style>`;

/** Shared interaction runtime — AI uses data-hx-* attributes, never writes onclick JS. */
const HX_RUNTIME = `<script data-hx-runtime>(function(){
"use strict";
window.showToast=window.showToast||function(m){try{var d=document.createElement("div");d.setAttribute("role","status");d.textContent=String(m==null?"":m);d.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:90vw;padding:12px 18px;border-radius:12px;background:#111827;color:#fff;font:500 14px/1.4 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.3);z-index:2147483000;opacity:0;transition:opacity .2s";document.body.appendChild(d);requestAnimationFrame(function(){d.style.opacity="1"});setTimeout(function(){d.style.opacity="0";setTimeout(function(){d.remove()},250)},3200)}catch(e){}};
window.toggleMobile=window.toggleMobile||function(open){var m=document.getElementById("mobileMenu");if(!m)return;if(open===undefined)open=!m.classList.contains("open");m.classList.toggle("open",!!open);document.body.style.overflow=open?"hidden":"";};
function openModal(id){var m=document.getElementById(id);if(m){m.classList.add("open");m.style.display="flex";document.body.style.overflow="hidden";}}
function closeModal(m){if(typeof m==="string")m=document.getElementById(m);if(m){m.classList.remove("open");m.style.display="none";document.body.style.overflow="";}}
window.hxOpenModal=openModal;window.hxCloseModal=closeModal;
function activateTab(btn){var target=btn.getAttribute("data-hx-tab");if(!target)return;var wrap=btn.closest("[data-hx-tabs]")||document;wrap.querySelectorAll("[data-hx-tab]").forEach(function(b){b.classList.toggle("active",b===btn)});wrap.querySelectorAll("[data-hx-tabpanel]").forEach(function(p){var on=p.getAttribute("data-hx-tabpanel")===target;p.style.display=on?"":"none";p.classList.toggle("active",on);});}
function toggleAccordion(btn){var panel=btn.nextElementSibling;if(!panel)return;var open=btn.classList.toggle("active");panel.style.display=open?"":"none";}
function applyFilter(btn){var cat=btn.getAttribute("data-hx-filter");var gsel=btn.getAttribute("data-hx-filter-group");var scope=gsel?document.querySelector(gsel)||document:document;var btnWrap=btn.closest("[data-hx-filter-btns]")||document;btnWrap.querySelectorAll("[data-hx-filter]").forEach(function(b){b.classList.toggle("active",b===btn)});scope.querySelectorAll("[data-hx-filter-item]").forEach(function(it){var c=it.getAttribute("data-hx-filter-item")||"";var show=!cat||cat==="all"||c===cat||c.split(" ").indexOf(cat)>=0;it.style.display=show?"":"none";});}
document.addEventListener("click",function(e){
  var t=e.target.closest("[data-hx-toast],[data-hx-tab],[data-hx-accordion],[data-hx-filter],[data-hx-modal],[data-hx-close],[data-hx-action]");
  if(!t)return;
  if(t.hasAttribute("data-hx-toast")){window.showToast(t.getAttribute("data-hx-toast"));}
  else if(t.hasAttribute("data-hx-tab")){activateTab(t);}
  else if(t.hasAttribute("data-hx-accordion")){toggleAccordion(t);}
  else if(t.hasAttribute("data-hx-filter")){applyFilter(t);}
  else if(t.hasAttribute("data-hx-modal")){openModal(t.getAttribute("data-hx-modal"));}
  else if(t.hasAttribute("data-hx-close")){var m=t.closest(".hx-modal");if(m)closeModal(m);toggleMobile(false);}
  else if(t.hasAttribute("data-hx-action")){var a=t.getAttribute("data-hx-action");if(a==="menu")toggleMobile();else if(a==="menu-close")toggleMobile(false);else if(a==="back")history.back();else if(a==="top")window.scrollTo({top:0,behavior:"smooth"});}
});
document.addEventListener("keydown",function(e){if(e.key==="Escape"){document.querySelectorAll(".hx-modal.open").forEach(function(m){closeModal(m)});toggleMobile(false);}});
document.addEventListener("click",function(e){if(e.target.classList&&e.target.classList.contains("hx-modal"))closeModal(e.target);});
})();
</scr` + `ipt>`;

/** Mobile hardening — force mobile-friendliness regardless of AI output. */
const MOBILE_CSS = `<style data-hx-mobile>
html,body{overflow-x:hidden!important;max-width:100vw!important}
img,video,iframe{max-width:100%!important;height:auto!important}
@media(max-width:768px){
*{max-width:100vw!important}
button,a,input[type="submit"],input[type="button"]{min-height:44px!important}
table{display:block!important;overflow-x:auto!important}
}
</style>`;

/** Shared toast utility — safe replacement for alert(). Injected once in head. */
const TOAST = `<script data-hx-toast>window.showToast=window.showToast||function(m){var t=document.getElementById("hx-toast");if(!t){t=document.createElement("div");t.id="hx-toast";t.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1e1b4b;color:#fff;padding:12px 24px;border-radius:12px;z-index:99999;font-size:14px;box-shadow:0 4px 20px rgba(0,0,0,.3);transition:opacity .3s";document.body.appendChild(t)}t.textContent=m;t.style.opacity="1";clearTimeout(t._h);t._h=setTimeout(function(){t.style.opacity="0"},3000)};</script>`;

/** Top-level data-page blocks: keep only the first of each name (AI sometimes repeats "contact"). */
function dedupePages(s: string) {
  const seen = new Set<string>();
  return s.replace(/<(section|div|main)\b([^>]*\bdata-page=["']([\w-]+)["'][^>]*)>/gi, (m, tag, attrs, name) => {
    const k = name.toLowerCase();
    if (!seen.has(k)) { seen.add(k); return m; }
    let i = 2; while (seen.has(`${k}-${i}`)) i++;
    seen.add(`${k}-${i}`);
    return `<${tag}${attrs.replace(/data-page=["'][\w-]+["']/, `data-page="${k}-${i}" data-hx-dup="1"`)}>`;
  }).replace(/<(section|div|main)\b[^>]*data-hx-dup="1"[^>]*>[\s\S]*?<\/\1>/gi, (m) => (/<(section|div|main)\b/gi.test(m.slice(1)) ? m.replace(/data-hx-dup="1"/, "") : ""));
}

/** Booking / admin / order links go where they promise; buttons are never dead. */
function fixLinks(s: string) {
  const pages = new Set([...s.matchAll(/data-page=["']([\w-]+)["']/g)].map((m) => m[1].toLowerCase()));
  const bookingTarget = pages.has("booking") ? "#/booking" : pages.has("reservation") ? "#/reservation" : /id=["']booking["']/.test(s) ? "#booking" : /id=["']reservation["']/.test(s) ? "#reservation" : pages.has("contact") ? "#/contact" : null;
  s = s.replace(/<a\b([^>]*)>([\s\S]{0,120}?)<\/a>/gi, (m, attrs, inner) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    let to: string | null = null;
    if (/টেবিল বুক|বুক করুন|রিজার্ভ|book (a )?table|reserve/i.test(text) && bookingTarget) to = bookingTarget;
    if (!to) return m;
    const a = /href=/.test(attrs) ? attrs.replace(/href=(["'])[^"']*\1/, `href="${to}"`) : `${attrs} href="${to}"`;
    return `<a${a}>${inner}</a>`;
  });
  return s;
}

/** Neutralize model's duplicate showToast definitions — our injected window.showToast wins. */
function dedupeShowToast(s: string): string {
  s = s.replace(/function\s+showToast\s*\(/g, "function _dup_showToast_(");
  s = s.replace(/window\.showToast\s*=\s*(?!\|\|)/g, "window._dup_showToast=");
  s = s.replace(/(?:const|let|var)\s+showToast\s*=/g, (m) => m.replace("showToast", "_dup_showToast"));
  return s;
}

/** Remove duplicate function declarations — keep first, rename rest.
 *  Prevents later definitions from silently overriding earlier ones with different logic. */
function dedupeFunctions(s: string): string {
  const seen = new Set<string>();
  // Match function declarations (not expressions)
  return s.replace(/function\s+([A-Za-z_$][\w$]*)\s*\(/g, (m, name) => {
    // Skip our injected utilities and common safe ones
    if (/^(showToast|toggleMobile)$/.test(name)) return m;
    if (seen.has(name)) return m.replace(`function ${name}`, `function _dup_${name}_`);
    seen.add(name);
    return m;
  });
}

export function postProcessAssets(html: string) {
  if (!/<\/body>/i.test(html)) return html;
  let n = 0;
  let s = fixLinks(dedupePages(html)).replace(/<img\b(?![^>]*\bloading=)([^>]*)>/gi, (m, a) => (n++ === 0 ? m : `<img loading="lazy" decoding="async"${a}>`));
  s = s.replace(/(https:\/\/images\.unsplash\.com\/photo-[\w-]+)(?![\w?=&-]*[?&]w=)(\?[^"'\s)]*)?/g, (_m, base, q) => `${base}${q ? q + "&" : "?"}auto=format&fit=crop&w=1600&q=75`);
  const head: string[] = [];
  if (/<lottie-player/i.test(s) && !/lottie-player\.js/i.test(s)) head.push(`<script defer src="https://unpkg.com/@lottiefiles/lottie-player@2/dist/lottie-player.js"></script>`);
  if (/<lord-icon/i.test(s) && !/lordicon\.js/i.test(s)) head.push(`<script defer src="https://cdn.lordicon.com/lordicon.js"></script>`);
  if (/\bhx-(mesh|gradient)\b/.test(s) && !s.includes("data-hx-bg")) head.push(ANIMATED_BG_CSS);
  if (/\bhx-wave\b/.test(s) && !s.includes("data-hx-wave")) head.push(WAVE_CSS);
  if (/showToast\(|alert\(/i.test(s) && !s.includes("data-hx-toast")) head.push(TOAST);
  if (!s.includes("data-hx-mobile")) head.push(MOBILE_CSS);
  if (/data-page=/.test(s) && !s.includes("data-hx-runtime")) head.push(HX_RUNTIME);
  if (head.length) s = /<\/head>/i.test(s) ? s.replace(/<\/head>/i, head.join("\n") + "\n</head>") : s;
  s = s.replace(/<script data-hx-count>[\s\S]*?<\/script>/g, "");
  if (/data-count|data-target|data-counter|class=["'][^"']*\b(counter|count-up|stat-number|stat-num|counter-value)\b/.test(s)) s = s.replace(/<\/body>(?![\s\S]*<\/body>)/i, COUNTERS + "\n</body>");
  if (!s.includes("data-hx-fallback")) s = s.replace(/<\/body>(?![\s\S]*<\/body>)/i, FALLBACK + "\n</body>");
  // Background photos: put a brand gradient underneath so a failed photo never leaves an empty box.
  s = s.replace(/background-image\s*:\s*url\(([^)]+)\)(?!\s*,)/gi, (m, u) => (/linear-gradient/i.test(m) ? m : `background-image:url(${u}),linear-gradient(135deg,rgba(99,102,241,.35),rgba(34,211,238,.25))`));
  s = s.replace(/<script data-hx-pages>[\s\S]*?<\/script>/g, "").replace(/<style data-hx-pages>[\s\S]*?<\/style>/g, "");
  s = dedupeShowToast(s);
  s = dedupeFunctions(s);
  // Mobile: convert large fixed widths to max-width (prevent overflow)
  s = s.replace(/(?<!max-)width:\s*(\d{3,})px/gi, (m, w) => parseInt(w) > 480 ? `max-width:${w}px;width:100%` : m);
  if (/data-page=/.test(s)) s = stripAiRouters(s).replace(/<\/body>(?![\s\S]*<\/body>)/i, PAGES + "\n</body>");
  return s;
}
