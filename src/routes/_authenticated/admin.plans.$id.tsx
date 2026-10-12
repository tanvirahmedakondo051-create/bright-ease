import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { adminListProviders } from "@/lib/admin.functions";
import { PageTitle, Panel, btn } from "@/components/admin/ui";
import { Field, Toggle, inputCls } from "@/components/admin/fields";

export const Route = createFileRoute("/_authenticated/admin/plans/$id")({
  head: () => ({ meta: [{ title: "প্ল্যান সেটিংস — অ্যাডমিন" }] }),
  component: PlanEdit,
});

const empty = {
  name_en: "", name_bn: "", price_bdt: 0, features: "", is_default: false,
  tokens_per_day: 50000, bonus_coins: 10, daily_coins: 1, coin_cap: 15, rate_limit_per_minute: 10,
  daily_ai_messages: 20, max_bot_projects: 5, temp_host_minutes_per_day: 15, max_fix_requests_per_day: 10, zip_download_allowed: true,
  duration_days: 30,
  default_provider_id: "" as string,
};

function PlanEdit() {
  const { id } = Route.useParams();
  const isNew = id === "new";
  const nav = useNavigate();
  const qc = useQueryClient();
  const listProviders = useServerFn(adminListProviders);
  const { data: providers } = useQuery({ queryKey: ["admin-providers"], queryFn: () => listProviders() });
  const [f, setF] = useState<typeof empty | null>(isNew ? { ...empty } : null);
  const [allowed, setAllowed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    (async () => {
      const [{ data: p }, { data: links }] = await Promise.all([
        supabase.from("plans").select("*").eq("id", id).single(),
        supabase.from("plan_providers").select("provider_id").eq("plan_id", id),
      ]);
      if (!p) return;
      const x: any = p;
      setF({ ...empty, ...x, features: (x.features ?? []).join("\n"), default_provider_id: x.default_provider_id ?? "" });
      setAllowed(new Set((links ?? []).map((l) => l.provider_id)));
    })();
  }, [id, isNew]);

  if (!f) return <div className="glass h-64 animate-pulse rounded-2xl" />;
  const num = (k: keyof typeof empty) => (e: any) => setF({ ...f, [k]: +e.target.value });
  const txt = (k: keyof typeof empty) => (e: any) => setF({ ...f, [k]: e.target.value });
  const tog = (k: keyof typeof empty) => (v: boolean) => setF({ ...f, [k]: v });

  async function save() {
    if (!f!.name_bn || !f!.name_en) return toast.error("নাম দিন");
    setSaving(true);
    const { features, default_provider_id, ...rest } = f!;
    const row: any = { ...rest, features: features.split("\n").map((s) => s.trim()).filter(Boolean), default_provider_id: default_provider_id || null };
    delete row.id; delete row.created_at;
    if (row.is_default) await supabase.from("plans").update({ is_default: false } as any).neq("id", isNew ? "00000000-0000-0000-0000-000000000000" : id);
    const res = isNew ? await supabase.from("plans").insert(row).select("id").single() : await supabase.from("plans").update(row).eq("id", id).select("id").single();
    if (res.error || !res.data) { setSaving(false); return toast.error("সেভ করা যায়নি"); }
    const planId = res.data.id;
    await supabase.from("plan_providers").delete().eq("plan_id", planId);
    if (allowed.size) await supabase.from("plan_providers").insert([...allowed].map((provider_id) => ({ plan_id: planId, provider_id })));
    setSaving(false);
    qc.invalidateQueries({ queryKey: ["plans"] });
    toast.success("সেভ হয়েছে");
    nav({ to: "/admin/plans" });
  }

  return (
    <div className="space-y-6 pb-24">
      <PageTitle title={isNew ? "নতুন প্ল্যান" : `প্ল্যান সেটিংস — ${f.name_bn}`}>
        <Link to="/admin/plans" className={`${btn} glass`}><ArrowLeft className="size-4" /> ফিরে যান</Link>
      </PageTitle>

      <Panel title="সাধারণ">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="বাংলা নাম"><input className={inputCls} value={f.name_bn} onChange={txt("name_bn")} /></Field>
          <Field label="ইংরেজি নাম"><input className={inputCls} value={f.name_en} onChange={txt("name_en")} /></Field>
          <Field label="দাম (৳)"><input type="number" className={inputCls} value={f.price_bdt} onChange={num("price_bdt")} /></Field>
        </div>
        <div className="mt-3"><Field label="ফিচার তালিকা (প্রতি লাইনে একটি)"><textarea rows={4} className={`${inputCls} py-2`} value={f.features} onChange={txt("features")} /></Field></div>
        <div className="mt-3"><Toggle label="নতুন ইউজারের ডিফল্ট প্ল্যান" checked={f.is_default} onChange={tog("is_default")} /></div>
      </Panel>

      <Panel title="লিমিট">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="সাইনআপ/কেনার কয়েন"><input type="number" className={inputCls} value={(f as any).bonus_coins} onChange={num("bonus_coins" as any)} /></Field>
          <Field label="দৈনিক রিফিল কয়েন"><input type="number" className={inputCls} value={(f as any).daily_coins} onChange={num("daily_coins" as any)} /></Field>
          <Field label="সর্বোচ্চ জমা (ক্যাপ)"><input type="number" className={inputCls} value={(f as any).coin_cap} onChange={num("coin_cap" as any)} /></Field>
          <Field label="দৈনিক AI মেসেজ (-১ = সীমাহীন)"><input type="number" className={inputCls} value={f.daily_ai_messages} onChange={num("daily_ai_messages")} /></Field>
          <Field label="সর্বোচ্চ বট প্রজেক্ট (-১ = সীমাহীন)"><input type="number" className={inputCls} value={f.max_bot_projects} onChange={num("max_bot_projects")} /></Field>
          <Field label="দৈনিক টেস্ট মিনিট (-১ = সীমাহীন)"><input type="number" className={inputCls} value={f.temp_host_minutes_per_day} onChange={num("temp_host_minutes_per_day")} /></Field>
          <Field label="দৈনিক scoped fix (-১ = সীমাহীন)"><input type="number" className={inputCls} value={f.max_fix_requests_per_day} onChange={num("max_fix_requests_per_day")} /></Field>
          <Field label="প্রতি মিনিটে অনুরোধ"><input type="number" className={inputCls} value={f.rate_limit_per_minute} onChange={num("rate_limit_per_minute")} /></Field>
        </div>
      </Panel>

      <Panel title="অনুমতি">
        <div className="space-y-2">
          <Toggle label="বটের ZIP ডাউনলোড করতে পারবে" checked={f.zip_download_allowed} onChange={tog("zip_download_allowed")} />
        </div>
      </Panel>

      <Panel title="মেয়াদ">
        <Field label="কত দিন চলবে (০ = আজীবন)"><input type="number" className={inputCls} value={f.duration_days} onChange={num("duration_days")} /></Field>
        <p className="mt-2 text-sm text-muted-foreground">মেয়াদ শেষ হলে ইউজার স্বয়ংক্রিয়ভাবে ডিফল্ট (ফ্রি) প্ল্যানে ফিরে যাবে।</p>
      </Panel>

      <Panel title="AI প্রোভাইডার">
        <p className="mb-3 text-sm text-muted-foreground">কোনোটি না বাছলে সব চালু প্রোভাইডার ব্যবহার হবে।</p>
        {!providers?.length && <p className="text-sm text-muted-foreground">এখনো কোনো প্রোভাইডার যোগ করা হয়নি।</p>}
        <div className="space-y-2">
          {providers?.map((p: any) => (
            <label key={p.id} className="flex min-h-12 items-center gap-3 rounded-xl border border-input px-3">
              <input type="checkbox" className="size-5 accent-[var(--color-primary)]" checked={allowed.has(p.id)} onChange={(e) => {
                const n = new Set(allowed); e.target.checked ? n.add(p.id) : n.delete(p.id); setAllowed(n);
              }} />
              <span className="min-w-0 flex-1"><span className="font-medium">{p.name}</span> <span className="font-en text-xs text-muted-foreground">{p.model}</span></span>
              {!p.is_active && <span className="text-xs text-muted-foreground">বন্ধ</span>}
            </label>
          ))}
        </div>
        <div className="mt-3">
          <Field label="এই প্ল্যানের ডিফল্ট প্রোভাইডার">
            <select className={inputCls} value={f.default_provider_id} onChange={txt("default_provider_id")}>
              <option value="">স্বয়ংক্রিয়</option>
              {providers?.filter((p: any) => !allowed.size || allowed.has(p.id)).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>
      </Panel>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 p-3 backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
        <button disabled={saving} className={`${btn} w-full bg-brand disabled:opacity-60`} onClick={save}>{saving ? "সেভ হচ্ছে..." : "সেভ করুন"}</button>
      </div>
    </div>
  );
}
