import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Zap, Star, Pencil, Loader2 } from "lucide-react";
import { adminListProviders, adminSaveProvider, adminDeleteProvider, adminSetDefaultProvider, adminTestProvider } from "@/lib/admin.functions";
import { PageTitle, Panel, Confirm, btn } from "@/components/admin/ui";
import { Field, Toggle, inputCls } from "@/components/admin/fields";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useSiteSettings } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/admin/providers")({
  head: () => ({ meta: [{ title: "AI প্রোভাইডার — অ্যাডমিন" }] }),
  component: Providers,
});

const empty = { id: undefined as string | undefined, name: "", base_url: "", api_key: "", model: "", headers: "{}", max_tokens: 8000, temperature: 0.7, is_active: true, sort_order: 0 };

function Providers() {
  const qc = useQueryClient();
  const list = useServerFn(adminListProviders);
  const save = useServerFn(adminSaveProvider);
  const del = useServerFn(adminDeleteProvider);
  const setDef = useServerFn(adminSetDefaultProvider);
  const test = useServerFn(adminTestProvider);
  const { data, isLoading } = useQuery({ queryKey: ["admin-providers"], queryFn: () => list() });
  const [form, setForm] = useState<typeof empty | null>(null);
  const [delId, setDelId] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-providers"] });

  async function submit() {
    if (!form) return;
    let headers: Record<string, string> = {};
    try { headers = JSON.parse(form.headers || "{}"); } catch { return toast.error("হেডার সঠিক JSON নয়"); }
    const r = await save({ data: { id: form.id, name: form.name, base_url: form.base_url, api_key: form.api_key || undefined, model: form.model, custom_headers: headers, max_tokens: Number(form.max_tokens), temperature: Number(form.temperature), is_active: form.is_active, sort_order: Number(form.sort_order) } }).catch(() => ({ error: "তথ্য সঠিক নয়" }));
    if ("error" in r && r.error) return toast.error(r.error);
    toast.success("সেভ হয়েছে");
    setForm(null);
    refresh();
  }

  async function runTest(id: string) {
    setTesting(id);
    const r = await test({ data: { id } });
    setTesting(null);
    (r.ok ? toast.success : toast.error)(`${r.message} (${r.ms}ms)`);
  }

  return (
    <div className="space-y-6">
      <PageTitle title="AI প্রোভাইডার">
        <button className={`${btn} bg-brand`} onClick={() => setForm({ ...empty })}><Plus className="size-4" /> নতুন প্রোভাইডার</button>
      </PageTitle>
      {isLoading ? <Loader2 className="size-6 animate-spin text-cyan" /> : !data?.length ? (
        <Panel><p className="text-muted-foreground">এখনো কোনো প্রোভাইডার নেই। Telegram bot plan ও build চালু করতে একটি যোগ করুন।</p></Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((p) => (
            <div key={p.id} className="glass rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{p.name}</h3>
                {p.is_default && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-cyan">ডিফল্ট</span>}
                <span className={`rounded-full px-2 py-0.5 text-xs ${p.is_active ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"}`}>{p.is_active ? "চালু" : "বন্ধ"}</span>
              </div>
              <p className="mt-2 break-all font-en text-xs text-muted-foreground">{p.base_url}</p>
              <p className="break-all font-en text-xs text-muted-foreground">{p.model} · {p.api_key}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className={`${btn} glass`} onClick={() => runTest(p.id)} disabled={testing === p.id}>{testing === p.id ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />} টেস্ট</button>
                <button className={`${btn} glass`} onClick={() => setForm({ ...empty, ...p, api_key: "", headers: JSON.stringify(p.custom_headers ?? {}) })}><Pencil className="size-4" /> এডিট</button>
                {!p.is_default && <button className={`${btn} glass`} onClick={async () => { await setDef({ data: { id: p.id } }); refresh(); toast.success("ডিফল্ট করা হয়েছে"); }}><Star className="size-4" /> ডিফল্ট</button>}
                <button className={`${btn} text-destructive`} onClick={() => setDelId(p.id)}><Trash2 className="size-4" /> মুছুন</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <SystemPrompt />

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form?.id ? "প্রোভাইডার এডিট" : "নতুন প্রোভাইডার"}</DialogTitle></DialogHeader>
          {form && (
            <div className="space-y-3">
              <Field label="নাম"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="যেমন: OpenRouter" /></Field>
              <Field label="Base URL"><input className={inputCls} value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} placeholder="https://openrouter.ai/api/v1" /></Field>
              <Field label={form.id ? "API Key (খালি রাখলে আগেরটাই থাকবে)" : "API Key"}><input type="password" className={inputCls} value={form.api_key} onChange={(e) => setForm({ ...form, api_key: e.target.value })} /></Field>
              <Field label="মডেল"><input className={inputCls} value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="deepseek/deepseek-chat" /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="সর্বোচ্চ টোকেন"><input type="number" className={inputCls} value={form.max_tokens} onChange={(e) => setForm({ ...form, max_tokens: +e.target.value })} /></Field>
                <Field label="টেম্পারেচার"><input type="number" step="0.1" className={inputCls} value={form.temperature} onChange={(e) => setForm({ ...form, temperature: +e.target.value })} /></Field>
                <Field label="ক্রম"><input type="number" className={inputCls} value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: +e.target.value })} /></Field>
              </div>
              <Field label="অতিরিক্ত হেডার (JSON)"><textarea className={`${inputCls} py-2 font-en`} rows={2} value={form.headers} onChange={(e) => setForm({ ...form, headers: e.target.value })} /></Field>
              <Toggle label="চালু" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
              <button className={`${btn} w-full bg-brand`} onClick={submit}>সেভ করুন</button>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <Confirm open={!!delId} title="প্রোভাইডার মুছবেন?" onCancel={() => setDelId(null)} onConfirm={async () => { if (!delId) return; await del({ data: { id: delId } }); setDelId(null); refresh(); toast.success("মুছে ফেলা হয়েছে"); }} />
    </div>
  );
}

function SystemPrompt() {
  return (
    <>
      <PromptEditor field="build_prompt" title="Bot build ও scoped fix নির্দেশনা" />
      <PromptEditor field="plan_prompt" title="Bot plan নির্দেশনা" />
    </>
  );
}

function PromptEditor({ field, title }: { field: "build_prompt" | "plan_prompt"; title: string }) {
  const { data: s } = useSiteSettings();
  const qc = useQueryClient();
  const [v, setV] = useState("");
  useEffect(() => { if (s) setV((s as any)[field] ?? ""); }, [s, field]);
  return (
    <Panel title={title}>
      <textarea className={`${inputCls} py-2 font-en`} rows={8} value={v} onChange={(e) => setV(e.target.value)} />
      <button className={`${btn} mt-3 bg-brand`} onClick={async () => {
        const { error } = await supabase.from("site_settings").update({ [field]: v } as any).eq("id", 1);
        if (error) return toast.error("সেভ করা যায়নি");
        qc.invalidateQueries({ queryKey: ["site-settings"] });
        toast.success("নির্দেশনা সেভ হয়েছে");
      }}>সেভ করুন</button>
    </Panel>
  );
}
