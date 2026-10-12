import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, UserPlus, Zap, Wallet, Bot } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { bn, bnDate } from "@/lib/auth";
import { PageTitle, Panel, StatCard, dayKey, lastNDays, shortBn } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminHome });

export function useAdminData() {
  return useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 86400000).toISOString();
      const [profiles, usage, bots, versions, payments, plans] = await Promise.all([
        supabase.from("profiles").select("id, name, email, plan_id, created_at"),
        supabase.from("usage_logs").select("user_id, tokens_used, created_at").gte("created_at", since).limit(50000),
        supabase.from("bots").select("id, name, user_id, updated_at").order("updated_at", { ascending: false }).limit(500),
        supabase.from("bot_versions").select("id, bot_id, created_at").gte("created_at", since).limit(50000),
        supabase.from("payment_requests").select("id, user_id, amount, status, created_at, plan_id").order("created_at", { ascending: false }),
        supabase.from("plans").select("*"),
      ]);
      return { profiles: profiles.data ?? [], usage: usage.data ?? [], bots: bots.data ?? [], versions: versions.data ?? [], payments: payments.data ?? [], plans: plans.data ?? [] };
    },
  });
}

const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 } };

function AdminHome() {
  const { data } = useAdminData();
  if (!data) return <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="glass h-28 animate-pulse rounded-2xl" />)}</div>;
  const today = lastNDays(1)[0];
  const days = lastNDays(30);
  const planPrice = Object.fromEntries(data.plans.map((p) => [p.id, p.price_bdt]));
  const mrr = data.profiles.reduce((s, p) => s + (p.plan_id ? planPrice[p.plan_id] ?? 0 : 0), 0);
  const signups = days.map((d) => ({ d: shortBn(d), v: data.profiles.filter((p) => dayKey(p.created_at) === d).length }));
  const tokens = days.map((d) => ({ d: shortBn(d), v: data.usage.filter((u) => dayKey(u.created_at) === d).reduce((s, u) => s + u.tokens_used, 0) }));
  const names = Object.fromEntries(data.profiles.map((p) => [p.id, p.name || p.email]));
  const activity = [
    ...data.profiles.map((p) => ({ at: p.created_at, text: `${p.name || p.email} সাইন আপ করেছেন` })),
    ...data.bots.map((bot) => ({ at: bot.updated_at, text: `${names[bot.user_id] ?? "একজন"} “${bot.name}” bot update করেছেন` })),
    ...data.payments.filter((p) => p.status === "approved").map((p) => ({ at: p.created_at, text: `${names[p.user_id] ?? "একজন"} আপগ্রেড করেছেন` })),
  ].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 10);

  return (
    <>
      <PageTitle title="অ্যাডমিন ড্যাশবোর্ড" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="মোট ইউজার" value={bn(data.profiles.length)} icon={Users} />
        <StatCard label="আজকের সাইনআপ" value={bn(data.profiles.filter((p) => dayKey(p.created_at) === today).length)} icon={UserPlus} />
        <StatCard label="আজকের টোকেন খরচ" value={bn(data.usage.filter((u) => dayKey(u.created_at) === today).reduce((s, u) => s + u.tokens_used, 0))} icon={Zap} />
        <StatCard label="মোট Bot" value={bn(data.bots.length)} icon={Bot} />
        <StatCard label="মাসিক আয় (MRR)" value={`৳${bn(mrr)}`} icon={Wallet} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="সাইনআপ (গত ৩০ দিন)">
          <div className="h-56"><ResponsiveContainer><AreaChart data={signups}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={6} /><YAxis allowDecimals={false} width={28} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} /><Tooltip {...tip} /><Area dataKey="v" name="সাইনআপ" stroke="var(--cyan)" fill="var(--cyan)" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div>
        </Panel>
        <Panel title="টোকেন ব্যবহার (গত ৩০ দিন)">
          <div className="h-56"><ResponsiveContainer><BarChart data={tokens}><CartesianGrid stroke="var(--border)" vertical={false} /><XAxis dataKey="d" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval={6} /><YAxis width={44} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} /><Tooltip {...tip} /><Bar dataKey="v" name="টোকেন" fill="var(--primary)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </Panel>
      </div>
      <div className="mt-4">
        <Panel title="সাম্প্রতিক কার্যক্রম">
          {activity.length ? (
            <ul className="divide-y divide-border">{activity.map((a, i) => <li key={i} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{a.text}</span><span className="text-muted-foreground">{bnDate(a.at)}</span></li>)}</ul>
          ) : <p className="text-sm text-muted-foreground">এখনো কোনো কার্যক্রম নেই</p>}
        </Panel>
      </div>
    </>
  );
}
