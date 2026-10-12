import { createElement, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel, Confirm, btn } from "@/components/admin/ui";
import { Field, inputCls } from "@/components/admin/fields";

type Kind = "photos" | "lotties" | "icons";
const TABLE = { photos: "curated_photos", lotties: "curated_lotties", icons: "icon_favorites" } as const;
const CATS: Record<Kind, string[]> = {
  photos: ["hero-business", "hero-technology", "hero-creative", "hero-nature", "hero-abstract", "team", "food", "product", "office", "lifestyle"],
  lotties: ["hero", "loading_success", "business_technology", "fun_celebration"],
  icons: ["mdi", "lucide", "ph", "tabler", "carbon"],
};
const EMPTY: Record<Kind, any> = {
  photos: { category: "hero-business", url: "", alt: "", tags: "", source: "unsplash", source_url: "", license: "Unsplash License", attribution_required: false },
  lotties: { category: "hero", json_url: "", title: "", tags: "", source: "lottiefiles", source_url: "", license: "Lottie Simple License", attribution_required: false },
  icons: { icon_set: "lucide", name: "", tags: "" },
};

let lottieLoaded = false;
function ensureLottie() {
  if (lottieLoaded) return;
  lottieLoaded = true;
  const s = document.createElement("script");
  s.src = "https://unpkg.com/@lottiefiles/lottie-player@2/dist/lottie-player.js";
  document.head.appendChild(s);
}

function Preview({ kind, r }: { kind: Kind; r: any }) {
  if (kind === "photos") return r.url ? <img src={`${r.url}${r.url.includes("?") ? "&" : "?"}w=400`} alt={r.alt} loading="lazy" className="size-full object-cover" /> : null;
  if (kind === "lotties") { ensureLottie(); return r.json_url ? createElement("lottie-player", { src: r.json_url, autoplay: true, loop: true, style: { width: "100%", height: "100%" } }) : null; }
  return r.name ? <div className="grid size-full place-items-center rounded-lg bg-foreground/90"><img src={`https://api.iconify.design/${r.icon_set}:${r.name}.svg`} alt={r.name} className="size-10" /></div> : null;
}

function Manager({ kind }: { kind: Kind }) {
  const qc = useQueryClient();
  const table = TABLE[kind] as any;
  const { data } = useQuery({ queryKey: ["free-assets", kind], queryFn: async () => (await supabase.from(table).select("*").order("created_at", { ascending: false })).data ?? [] });
  const [f, setF] = useState<any>(EMPTY[kind]);
  const [editId, setEditId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["free-assets", kind] });
  const catKey = kind === "icons" ? "icon_set" : "category";
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const save = async () => {
    const main = kind === "photos" ? f.url : kind === "lotties" ? f.json_url : f.name;
    if (!String(main).trim()) return toast.error("প্রয়োজনীয় ঘর পূরণ করুন");
    const row = { ...f, tags: String(f.tags).split(",").map((t: string) => t.trim()).filter(Boolean) };
    const { error } = editId ? await supabase.from(table).update(row).eq("id", editId) : await supabase.from(table).insert(row);
    if (error) return toast.error("সেভ করা যায়নি");
    toast.success(editId ? "আপডেট হয়েছে" : "যোগ হয়েছে");
    setF(EMPTY[kind]); setEditId(null); refresh();
  };
  const toggle = async (r: any) => { await supabase.from(table).update({ enabled: !r.enabled }).eq("id", r.id); refresh(); };

  const term = q.trim().toLowerCase();
  const list = ((data as any[]) ?? []).filter((r) => !term || JSON.stringify([r.name, r.title, r.alt, r.tags, r.category]).toLowerCase().includes(term));

  return (
    <div className="space-y-4">
      <Panel title={editId ? "এডিট করুন" : "নতুন যোগ করুন"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={kind === "icons" ? "আইকন সেট" : "ক্যাটাগরি"}>
            <select className={inputCls} value={f[catKey]} onChange={set(catKey)}>{CATS[kind].map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          {kind === "photos" && <><Field label="ছবির URL"><input className={`${inputCls} font-en`} value={f.url} onChange={set("url")} /></Field><Field label="Alt টেক্সট"><input className={inputCls} value={f.alt} onChange={set("alt")} /></Field></>}
          {kind === "lotties" && <><Field label="JSON URL"><input className={`${inputCls} font-en`} value={f.json_url} onChange={set("json_url")} /></Field><Field label="টাইটেল"><input className={inputCls} value={f.title} onChange={set("title")} /></Field></>}
          {kind === "icons" && <Field label="আইকনের নাম (যেমন home-outline)"><input className={`${inputCls} font-en`} value={f.name} onChange={set("name")} /></Field>}
          <Field label="ট্যাগ (কমা দিয়ে)"><input className={inputCls} value={f.tags} onChange={set("tags")} /></Field>
          {kind !== "icons" && <>
            <Field label="সোর্স লিংক"><input className={`${inputCls} font-en`} value={f.source_url} onChange={set("source_url")} /></Field>
            <Field label="লাইসেন্স"><input className={inputCls} value={f.license} onChange={set("license")} /></Field>
            <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={!!f.attribution_required} onChange={set("attribution_required")} /> ক্রেডিট দেওয়া বাধ্যতামূলক</label>
          </>}
        </div>
        <div className="mt-3 h-32 w-48 overflow-hidden rounded-lg bg-muted"><Preview kind={kind} r={f} /></div>
        <div className="mt-3 flex gap-2">
          <button onClick={save} className={`${btn} flex-1 bg-brand`}>{editId ? "আপডেট" : "যোগ করুন"}</button>
          {editId && <button onClick={() => { setEditId(null); setF(EMPTY[kind]); }} className={`${btn} glass`}>বাতিল</button>}
        </div>
      </Panel>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="খুঁজুন..." className={inputCls} />
      <div className={`grid gap-3 ${kind === "icons" ? "grid-cols-3 sm:grid-cols-5 lg:grid-cols-8" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4"}`}>
        {list.map((r) => (
          <div key={r.id} className={`glass rounded-xl p-2 ${r.enabled ? "" : "opacity-50"}`}>
            <div className={`${kind === "icons" ? "aspect-square" : "aspect-video"} overflow-hidden rounded-lg bg-muted`}><Preview kind={kind} r={r} /></div>
            <p className="mt-1 line-clamp-1 text-xs">{r.title || r.alt || `${r.icon_set}:${r.name}`}</p>
            <p className="text-[11px] text-muted-foreground">{r.category ?? r.icon_set}{r.license ? ` • ${r.license}` : ""}</p>
            <div className="mt-1 flex items-center gap-1">
              <button onClick={() => toggle(r)} className="min-h-11 flex-1 rounded-lg text-xs hover:bg-accent">{r.enabled ? "চালু" : "বন্ধ"}</button>
              <button aria-label="এডিট" onClick={() => { setEditId(r.id); setF({ ...EMPTY[kind], ...r, tags: (r.tags ?? []).join(", ") }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="grid size-11 place-items-center rounded-lg hover:bg-accent"><Pencil className="size-4" /></button>
              <button aria-label="মুছুন" onClick={() => setDelId(r.id)} className="grid size-11 place-items-center rounded-lg text-destructive hover:bg-accent"><Trash2 className="size-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <Confirm open={!!delId} title="মুছবেন?" desc="এটি লাইব্রেরি থেকে সরিয়ে দেওয়া হবে।" onCancel={() => setDelId(null)} onConfirm={async () => {
        const { error } = await supabase.from(table).delete().eq("id", delId!);
        setDelId(null);
        if (error) return toast.error("মুছা যায়নি");
        toast.success("মুছে ফেলা হয়েছে"); refresh();
      }} />
    </div>
  );
}

export default function FreeAssets({ kind }: { kind: Kind }) {
  return <Manager key={kind} kind={kind} />;
}
