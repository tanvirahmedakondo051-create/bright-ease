import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bot, Download, Play, TrendingUp, Wallet, Users } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { bn } from "@/lib/auth";
import { PageTitle, Panel, StatCard, btn, lastNDays, dayKey, shortBn, downloadCsv } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/analytics")({
  head: () => ({ meta: [{ title: "অ্যানালিটিক্স — অ্যাডমিন" }] }),
  component: Analytics,
});

const tip = { contentStyle: { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 } };

function Analytics() {
  const { data } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [logs, profs, plans, pays, bots, botUsage] = await Promise.all([
        supabase.from("usage_logs").select("user_id,tokens_used,created_at").gte("created_at", since).limit(10000),
        supabase.from("profiles").select("id,email,plan_id"),
        supabase.from("plans").select("id,price_bdt"),
        supabase.from("payment_requests").select("amount,created_at,status").eq("status", "approved").gte("created_at", since),
        supabase.from("bots").select("id,created_at,temp_status").gte("created_at", since),
        supabase.from("bot_usage_daily").select("usage_date,builds,fix_requests,temp_host_minutes").gte("usage_date", since.slice(0, 10)),
      ]);
      return { logs: logs.data ?? [], profs: profs.data ?? [], plans: plans.data ?? [], pays: pays.data ?? [], bots: bots.data ?? [], botUsage: botUsage.data ?? [] };
    },
  });
  if (!data) return null;
  const days = lastNDays(30);
  const usage = days.map((d) => ({ d: shortBn(d), v: data.logs.filter((l) => dayKey(l.created_at) === d).reduce((a, l) => a + l.tokens_used, 0) }));
  const revenue = days.map((d) => ({ d: shortBn(d), v: data.pays.filter((p) => dayKey(p.created_at) === d).reduce((a, p) => a + p.amount, 0) }));
  const byUser: Record<string, number> = {};
  data.logs.forEach((l) => (byUser[l.user_id] = (byUser[l.user_id] ?? 0) + l.tokens_used));
  const email = Object.fromEntries(data.profs.map((p) => [p.id, p.email ?? ""]));
  const top = Object.entries(byUser).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const paid = new Set(data.plans.filter((p) => p.price_bdt > 0).map((p) => p.id));
  const proCount = data.profs.filter((p) => p.plan_id && paid.has(p.plan_id)).length;
  const conv = data.profs.length ? ((proCount / data.profs.length) * 100).toFixed(1) : "0";
  const totalRev = data.pays.reduce((a, p) => a + p.amount, 0);

  return (
    <div className="space-y-6">
      <PageTitle title="অ্যানালিটিক্স">
        <button className={`${btn} glass`} onClick={() => downloadCsv("usage.csv", [["date", "tokens", "revenue_bdt"], ...days.map((d, i) => [d, usage[i].v, revenue[i].v])])}><Download className="size-4" /> CSV</button>
      </PageTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Free→Pro রূপান্তর" value={`${bn(conv)}%`} icon={TrendingUp} />
        <StatCard label="Pro ইউজার" value={bn(proCount)} icon={Users} />
        <StatCard label="৩০ দিনের আয়" value={`৳${bn(totalRev)}`} icon={Wallet} />
        <StatCard label="নতুন Bot" value={bn(data.bots.length)} icon={Bot} />
        <StatCard label="Test মিনিট" value={bn(data.botUsage.reduce((sum, row) => sum + row.temp_host_minutes, 0))} icon={Play} />
      </div>
      <Panel title="৩০ দিনের টোকেন ব্যবহার">
        <div className="h-64"><ResponsiveContainer><BarChart data={usage}><XAxis dataKey="d" fontSize={11} /><YAxis fontSize={11} width={50} /><Tooltip {...tip} /><Bar dataKey="v" name="টোকেন" fill="var(--color-primary)" radius={4} /></BarChart></ResponsiveContainer></div>
      </Panel>
      <Panel title="আয় (৳)">
        <div className="h-64"><ResponsiveContainer><LineChart data={revenue}><XAxis dataKey="d" fontSize={11} /><YAxis fontSize={11} width={50} /><Tooltip {...tip} /><Line dataKey="v" name="আয়" stroke="var(--color-cyan)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
      </Panel>
      <Panel title="শীর্ষ ১০ ইউজার (টোকেন)">
        {!top.length ? <p className="text-sm text-muted-foreground">এখনো কোনো ব্যবহার নেই।</p> : (
          <ol className="space-y-2">
            {top.map(([id, v], i) => (
              <li key={id} className="flex items-center justify-between gap-3 rounded-xl bg-muted/50 px-3 py-2 text-sm">
                <span className="min-w-0 truncate">{bn(i + 1)}. {email[id] || id.slice(0, 8)}</span>
                <span className="shrink-0 font-semibold">{bn(v)}</span>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
