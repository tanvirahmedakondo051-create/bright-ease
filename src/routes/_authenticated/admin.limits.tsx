import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlans, useSiteSettings } from "@/lib/site";
import { adminResetUsage } from "@/lib/admin.functions";
import { PageTitle, Panel, Confirm } from "@/components/admin/ui";
import { Field, inputCls } from "@/components/admin/fields";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin/limits")({ head: () => ({ meta: [{ title: "Bot limits — Hexa AI" }, { name: "robots", content: "noindex" }] }), component: Limits });

function Limits() {
  const qc = useQueryClient(); const { data: plans } = usePlans(); const { data: settings } = useSiteSettings(); const reset = useServerFn(adminResetUsage);
  const [rows, setRows] = useState<Record<string, any>>({}); const [global, setGlobal] = useState({ rate_limit_per_minute: 10, max_output_tokens: 16000, tokens_per_coin: 10000 }); const [confirm, setConfirm] = useState(false);
  useEffect(() => { if (plans) setRows(Object.fromEntries(plans.map((plan) => [plan.id, { daily_ai_messages: plan.daily_ai_messages, max_bot_projects: plan.max_bot_projects, temp_host_minutes_per_day: plan.temp_host_minutes_per_day, max_fix_requests_per_day: plan.max_fix_requests_per_day }]))) }, [plans]);
  useEffect(() => { if (settings) setGlobal({ rate_limit_per_minute: settings.rate_limit_per_minute, max_output_tokens: settings.max_output_tokens, tokens_per_coin: settings.tokens_per_coin }) }, [settings]);
  const update = (id: string, key: string, value: number) => setRows({ ...rows, [id]: { ...rows[id], [key]: value } });
  async function save() {
    for (const [id, values] of Object.entries(rows)) await supabase.from("plans").update(values).eq("id", id);
    const { error } = await supabase.from("site_settings").update(global).eq("id", 1);
    if (error) return toast.error("লিমিট সেভ করা যায়নি"); qc.invalidateQueries({ queryKey: ["plans"] }); qc.invalidateQueries({ queryKey: ["site-settings"] }); toast.success("Bot limits সেভ হয়েছে");
  }
  return <div className="space-y-6"><PageTitle title="Bot limits"><Button variant="outline" onClick={() => setConfirm(true)}><RotateCcw />আজকের AI usage reset</Button></PageTitle>
    {plans?.map((plan) => <Panel key={plan.id} title={plan.name_bn}><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="দৈনিক AI message"><input type="number" className={inputCls} value={rows[plan.id]?.daily_ai_messages ?? 0} onChange={(e) => update(plan.id, "daily_ai_messages", +e.target.value)} /></Field><Field label="সর্বোচ্চ bot project"><input type="number" className={inputCls} value={rows[plan.id]?.max_bot_projects ?? 0} onChange={(e) => update(plan.id, "max_bot_projects", +e.target.value)} /></Field><Field label="দৈনিক test মিনিট"><input type="number" className={inputCls} value={rows[plan.id]?.temp_host_minutes_per_day ?? 0} onChange={(e) => update(plan.id, "temp_host_minutes_per_day", +e.target.value)} /></Field><Field label="দৈনিক scoped fix"><input type="number" className={inputCls} value={rows[plan.id]?.max_fix_requests_per_day ?? 0} onChange={(e) => update(plan.id, "max_fix_requests_per_day", +e.target.value)} /></Field></div></Panel>)}
    <Panel title="AI ও coin"><div className="grid gap-3 sm:grid-cols-3"><Field label="প্রতি মিনিটে request"><input type="number" className={inputCls} value={global.rate_limit_per_minute} onChange={(e) => setGlobal({ ...global, rate_limit_per_minute: +e.target.value })} /></Field><Field label="সর্বোচ্চ output token"><input type="number" className={inputCls} value={global.max_output_tokens} onChange={(e) => setGlobal({ ...global, max_output_tokens: +e.target.value })} /></Field><Field label="কত token-এ ১ coin"><input type="number" className={inputCls} value={global.tokens_per_coin} onChange={(e) => setGlobal({ ...global, tokens_per_coin: +e.target.value })} /></Field></div></Panel>
    <Button onClick={save} className="h-12">সব সেভ করুন</Button><Confirm open={confirm} title="সবার আজকের AI usage reset করবেন?" onCancel={() => setConfirm(false)} onConfirm={async () => { await reset(); setConfirm(false); toast.success("Reset হয়েছে"); }} /></div>;
}