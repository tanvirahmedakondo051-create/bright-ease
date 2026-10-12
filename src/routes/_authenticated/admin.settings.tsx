import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { adminGetAuraKey, adminGetBotSettings, adminGetDeployToken, adminNewDeployToken, adminSaveBotSettings, adminSaveEmojiMap, adminSetAuraKey, adminTestAgent } from "@/lib/admin.functions";
import { PageTitle, Panel } from "@/components/admin/ui";
import { Field, Toggle, inputCls } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";
import { ImportEmojis } from "@/components/admin/ImportEmojis";

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "Bot platform settings — Hexa AI" }, { name: "robots", content: "noindex" }] }),
  component: Settings,
});

type Style = "" | "primary" | "success" | "danger";
type EmojiRow = { key: string; id: string; fallback: string; style: Style; kind: "button" | "text" };
const STYLE_CLS: Record<Style, string> = { "": "bg-muted", primary: "bg-[hsl(217_91%_60%)]", success: "bg-success", danger: "bg-destructive" };

function Settings() {
  const getSettings = useServerFn(adminGetBotSettings);
  const saveSettings = useServerFn(adminSaveBotSettings);
  const saveEmojis = useServerFn(adminSaveEmojiMap);
  const qc = useQueryClient();
  const { data, refetch } = useQuery({ queryKey: ["admin-bot-settings"], queryFn: () => getSettings() });
  const [form, setForm] = useState<any>(null);
  const [rows, setRows] = useState<EmojiRow[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!data) return;
    setForm({ ...data, logo_url: data.logo_url ?? "" });
    const map = (data.button_emojis ?? {}) as Record<string, string>;
    const meta = ((data as any).button_emoji_meta ?? {}) as Record<string, any>;
    setRows(Object.entries(map).map(([key, id]) => ({ key, id, fallback: meta[key]?.fallback ?? "🔹", style: meta[key]?.style ?? "", kind: meta[key]?.kind ?? (key.startsWith("text.") ? "text" : "button") })));
  }, [data]);
  if (!form) return <div className="h-60 animate-pulse rounded-xl bg-card" />;
  const set = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });

  async function saveGeneral() {
    setSaving(true);
    try {
      const result: any = await saveSettings({ data: { ...form, button_emojis: undefined, agent_port: Number(form.agent_port) || 8443 } });
      if (result && "error" in result) { toast.error(result.error); return; }
      await refetch(); qc.invalidateQueries({ queryKey: ["site-settings"] }); toast.success("Bot platform settings সেভ হয়েছে");
    } catch (e) {
      console.error(e);
      toast.error("সেভ হয়নি — কোনো ঘর ভুল আছে কিনা দেখে আবার চেষ্টা করুন");
    } finally { setSaving(false); }
  }

  async function saveEmojiRows(list: EmojiRow[] = rows) {
    const map: Record<string, string> = {}; const meta: Record<string, any> = {};
    for (const row of list) {
      const key = row.key.trim().toLowerCase();
      if (!key) continue;
      if (!/^[a-z0-9_.-]{2,60}$/.test(key) || !/^\d{0,30}$/.test(row.id.trim())) return toast.error(`"${key}" — key বা ID ঠিক নয়`);
      map[key] = row.id.trim();
      meta[key] = { kind: row.kind, style: row.style, fallback: row.fallback.slice(0, 16) || "🔹", label: key };
    }
    const result = await saveEmojis({ data: { map, meta } });
    if ("error" in result) return toast.error(result.error);
    setRows(list); qc.invalidateQueries({ queryKey: ["site-settings"] }); toast.success("Premium emoji library সেভ হয়েছে");
  }

  return (
    <div className="space-y-6 pb-24">
      <PageTitle title="Bot platform settings" />
      <EmojiLibrary rows={rows} setRows={setRows} onSave={saveEmojiRows} />

      <Panel title="ব্র্যান্ড ও সাপোর্ট">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="প্ল্যাটফর্মের নাম"><input className={inputCls} value={form.site_name} onChange={set("site_name")} /></Field>
          <Field label="ট্যাগলাইন"><input className={inputCls} value={form.tagline} onChange={set("tagline")} /></Field>
          <Field label="লোগো URL (ঐচ্ছিক)"><input className={inputCls} value={form.logo_url} onChange={set("logo_url")} /></Field>
          <Field label="সাপোর্ট ইমেইল"><input className={inputCls} value={form.support_email} onChange={set("support_email")} /></Field>
          <Field label="সাপোর্ট Telegram link"><input className={inputCls} value={form.telegram_link} onChange={set("telegram_link")} /></Field>
          <Field label="সাপোর্ট WhatsApp"><input className={inputCls} value={form.support_whatsapp} onChange={set("support_whatsapp")} /></Field>
          <Field label="HexaHoster URL"><input className={`${inputCls} font-en`} value={form.hexahoster_url} onChange={set("hexahoster_url")} /></Field>
        </div>
      </Panel>

      <Panel title="ঘোষণা ও অ্যাক্সেস">
        <div className="space-y-3"><Field label="ঘোষণা"><input className={inputCls} value={form.announcement_text} onChange={set("announcement_text")} /></Field><Field label="ঘোষণার রঙ"><input type="color" className="h-11 w-20 rounded-lg border border-input bg-transparent" value={form.announcement_color} onChange={set("announcement_color")} /></Field><Toggle label="ঘোষণা দেখাবে" checked={form.announcement_active} onChange={(value) => setForm({ ...form, announcement_active: value })} /><Toggle label="Maintenance mode" checked={form.maintenance_mode} onChange={(value) => setForm({ ...form, maintenance_mode: value })} /><Toggle label="AuraPay চালু" checked={form.aurapay_enabled} onChange={(value) => setForm({ ...form, aurapay_enabled: value })} /></div>
      </Panel>

      <Panel title="৫ মিনিট টেস্ট VPS agent">
        <p className="mb-3 text-sm text-muted-foreground">এটি শুধু অস্থায়ী Telegram bot test চালায়; website publish বা permanent hosting করে না।</p>
        <div className="grid gap-3 sm:grid-cols-3"><Field label="VPS IP"><input className={`${inputCls} font-en`} value={form.server_ip} onChange={set("server_ip")} /></Field><Field label="Agent host"><input className={`${inputCls} font-en`} value={form.agent_host} onChange={set("agent_host")} /></Field><Field label="Agent port"><input type="number" className={inputCls} value={form.agent_port} onChange={set("agent_port")} /></Field></div>
        <DeployControls host={form.agent_host} port={Number(form.agent_port) || 8443} />
      </Panel>

      <AuraKey />
      <Button onClick={saveGeneral} disabled={saving} className="h-12 w-full sm:w-auto">{saving && <Loader2 className="animate-spin" />}সব সেটিংস সেভ করুন</Button>
    </div>
  );
}

function AuraKey() {
  const get = useServerFn(adminGetAuraKey); const save = useServerFn(adminSetAuraKey); const { data, refetch } = useQuery({ queryKey: ["aura-key"], queryFn: () => get() }); const [value, setValue] = useState("");
  return <Panel title="AuraPay"><Field label={`API key ${data?.masked ? "(সেভ আছে)" : ""}`}><div className="flex gap-2"><input type="password" className={`${inputCls} font-en`} value={value} onChange={(event) => setValue(event.target.value)} /><Button onClick={async () => { const result = await save({ data: { key: value } }); if ("error" in result) return toast.error(result.error); setValue(""); refetch(); toast.success("AuraPay key সেভ হয়েছে"); }}>Save</Button></div></Field></Panel>;
}

function DeployControls({ host, port }: { host: string; port: number }) {
  const get = useServerFn(adminGetDeployToken); const create = useServerFn(adminNewDeployToken); const test = useServerFn(adminTestAgent); const { data, refetch } = useQuery({ queryKey: ["deploy-token"], queryFn: () => get() });
  const [token, setToken] = useState(""); const [show, setShow] = useState(false);
  const origin = typeof window !== "undefined" && !/id-preview--|localhost|lovableproject\.com/.test(window.location.origin) ? window.location.origin : "https://bright-ease.lovable.app";
  const cmd = token && host.trim() ? `curl -fsSL ${origin}/install-agent.sh | sudo HEXA_APP_URL=${origin} bash -s -- ${token} ${host.trim()} "" ${port} && sudo systemctl restart hexa-agent` : "";
  const copy = async (text: string, msg: string) => { await navigator.clipboard.writeText(text); toast.success(msg); };
  return <div className="mt-4 space-y-3">
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={async () => { const result = await create(); if ("error" in result) return toast.error(result.error); setToken(result.token); setShow(true); refetch(); toast.success("নতুন agent token তৈরি হয়েছে"); }}>{token || data?.masked ? "নতুন token" : "Agent token তৈরি করুন"}</Button><Button variant="outline" onClick={async () => { const result = await test(); "error" in result ? toast.error(result.error) : toast.success("Test agent online"); }}>Agent connection test</Button></div>
    {token ? <>
      <Field label="Agent token (শুধু এখন পুরোটা দেখা যাবে)"><div className="flex gap-2"><input readOnly type={show ? "text" : "password"} value={token} className={`${inputCls} font-en`} /><Button type="button" variant="outline" size="icon" aria-label={show ? "লুকান" : "দেখুন"} onClick={() => setShow(!show)}>{show ? <EyeOff /> : <Eye />}</Button><Button type="button" variant="outline" onClick={() => copy(token, "Token কপি হয়েছে")}><Copy />Copy</Button></div></Field>
      <div><p className="mb-1 text-sm font-medium">VPS connect command</p>
        {cmd ? <><pre className="whitespace-pre-wrap break-all rounded-xl border border-border bg-background p-3 font-en text-xs">{cmd}</pre><Button type="button" className="mt-2" onClick={() => copy(cmd, "কমান্ড কপি হয়েছে — VPS-এ root হিসেবে রান করুন")}><Copy />কমান্ড কপি করুন</Button><p className="mt-1 text-xs text-muted-foreground">VPS terminal-এ paste করে Enter দিন। শেষ হলে "Agent connection test" চাপুন। নতুন token বানালে আগের token আর কাজ করবে না।</p></>
          : <p className="text-sm text-destructive">আগে Agent host দিন ও সেভ করুন</p>}
      </div>
    </> : data?.masked ? <p className="text-xs text-muted-foreground font-en">Token: {data.masked} — পুরো কমান্ড দেখতে "নতুন token" চাপুন</p> : null}
  </div>;
}
function EmojiLibrary({ rows, setRows, onSave }: { rows: EmojiRow[]; setRows: (r: EmojiRow[]) => void; onSave: (r?: EmojiRow[]) => void }) {
  const blank: EmojiRow = { key: "", id: "", fallback: "🔹", style: "", kind: "button" };
  const [draft, setDraft] = useState<EmojiRow>(blank);
  const [q, setQ] = useState("");
  const update = (key: string, patch: Partial<EmojiRow>) => setRows(rows.map((r) => r.key === key ? { ...r, ...patch } : r));
  const shown = rows.filter((r) => !q || r.key.includes(q.toLowerCase()) || r.id.includes(q));
  const styleSelect = (value: Style, onChange: (s: Style) => void) => <select aria-label="Button colour" value={value} onChange={(e) => onChange(e.target.value as Style)} className={`${inputCls} font-en`}><option value="">No colour</option><option value="primary">Blue (primary)</option><option value="success">Green (success)</option><option value="danger">Red (danger)</option></select>;
  return (
    <Panel title={`Premium emoji library (${rows.length})`}>
      <p className="mb-4 text-sm text-muted-foreground">একটা একটা করে premium emoji ID যোগ করুন, অথবা নিচে কোনো বটের ফাইল দিয়ে সব ID একসাথে সংগ্রহ করুন। পরের বিল্ডগুলোতে AI এই ID গুলো ব্যবহার করবে। key "text." দিয়ে শুরু হলে মেসেজের ভিতরের emoji।</p>
      <ImportEmojis rows={rows} onAdd={(found) => { const next = [...found, ...rows]; setRows(next); onSave(next); }} />
      <form className="mb-5 grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1.2fr_1.2fr_70px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); const key = draft.key.trim().toLowerCase(); if (!key || !/^\d{5,30}$/.test(draft.id.trim())) return toast.error("Key ও সঠিক emoji ID দিন"); const next = [{ ...draft, key, id: draft.id.trim(), kind: key.startsWith("text.") ? "text" as const : "button" as const }, ...rows.filter((r) => r.key !== key)]; setRows(next); onSave(next); setDraft(blank); }}>
        <input aria-label="New key" className={`${inputCls} font-en`} value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} placeholder="main.shop" />
        <input aria-label="New emoji ID" inputMode="numeric" className={`${inputCls} font-en`} value={draft.id} onChange={(e) => setDraft({ ...draft, id: e.target.value.replace(/\D/g, "") })} placeholder="5352877703043258544" />
        <input aria-label="Fallback emoji" className={inputCls} value={draft.fallback} onChange={(e) => setDraft({ ...draft, fallback: e.target.value })} />
        {styleSelect(draft.style, (style) => setDraft({ ...draft, style }))}
        <Button type="submit"><Plus />Add emoji</Button>
      </form>
      <input aria-label="Search emoji" className={`${inputCls} mb-3`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search key বা ID…" />
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {shown.map((row) => <div key={row.key} className="grid grid-cols-[1fr_1fr_56px_40px] items-center gap-2 sm:grid-cols-[1.2fr_1.2fr_64px_1fr_40px]">
          <div className="flex min-w-0 items-center gap-2"><span className={`size-2.5 shrink-0 rounded-full ${STYLE_CLS[row.style]}`} /><span className="truncate font-en text-sm">{row.key}</span></div>
          <input aria-label="Emoji ID" inputMode="numeric" className={`${inputCls} font-en`} value={row.id} onChange={(e) => update(row.key, { id: e.target.value.replace(/\D/g, "") })} />
          <input aria-label="Fallback" className={inputCls} value={row.fallback} onChange={(e) => update(row.key, { fallback: e.target.value })} />
          <div className="hidden sm:block">{row.kind === "button" ? styleSelect(row.style, (style) => update(row.key, { style })) : <span className="text-xs text-muted-foreground">message emoji</span>}</div>
          <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((r) => r.key !== row.key))} aria-label="মুছুন"><Trash2 className="size-4" /></Button>
        </div>)}
      </div>
      <Button className="mt-4" onClick={() => onSave()}>Save all</Button>
    </Panel>
  );
}
