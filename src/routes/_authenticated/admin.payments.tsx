import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { bn, bnDate } from "@/lib/auth";
import { PageTitle } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  head: () => ({ meta: [{ title: "পেমেন্ট — অ্যাডমিন" }] }),
  component: Payments,
});

const statusBn: Record<string, string> = { pending: "অপেক্ষমাণ", completed: "সফল", failed: "ব্যর্থ", amount_mismatch: "পরিমাণ মেলেনি", error: "ত্রুটি" };
const filters = ["all", "completed", "pending", "failed"] as const;

function Payments() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("all");
  const { data } = useQuery({
    queryKey: ["admin-aura-payments"],
    queryFn: async () => {
      const [pay, prof, plans] = await Promise.all([
        supabase.from("aura_payments").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("profiles").select("id, name, email"),
        supabase.from("plans").select("id, name_bn"),
      ]);
      const u = Object.fromEntries((prof.data ?? []).map((p) => [p.id, p]));
      const pl = Object.fromEntries((plans.data ?? []).map((p) => [p.id, p.name_bn]));
      return (pay.data ?? []).map((p) => ({ ...p, user: u[p.user_id], plan: pl[p.plan_id] }));
    },
  });
  const rows = data?.filter((p) => filter === "all" || (filter === "failed" ? !["completed", "pending"].includes(p.status) : p.status === filter));
  const total = data?.filter((p) => p.status === "completed").reduce((a, p) => a + p.amount, 0) ?? 0;
  return (
    <>
      <PageTitle title="পেমেন্ট (AuraPay)" />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((k) => (
          <button key={k} onClick={() => setFilter(k)} className={`min-h-11 rounded-full px-4 text-sm ${filter === k ? "bg-primary" : "glass"}`}>
            {k === "all" ? "সব" : statusBn[k]}
          </button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">মোট আয়: <b className="text-foreground">৳{bn(total)}</b></span>
      </div>
      {!rows?.length && <p className="py-10 text-center text-muted-foreground">কোনো পেমেন্ট নেই</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {rows?.map((p) => (
          <div key={p.id} className="glass rounded-2xl p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><div className="font-medium">{p.user?.name ?? "—"}</div><div className="truncate text-xs text-muted-foreground">{p.user?.email}</div></div>
              <span className={`rounded-full px-2 py-0.5 text-xs ${p.status === "completed" ? "bg-success/20 text-success" : p.status === "pending" ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}`}>{statusBn[p.status] ?? p.status}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">প্ল্যান:</span> {p.plan}</div>
              <div><span className="text-muted-foreground">পরিমাণ:</span> ৳{bn(p.amount)}</div>
              <div><span className="text-muted-foreground">তারিখ:</span> {bnDate(p.created_at)}</div>
              <div className="truncate font-en text-xs"><span className="font-sans text-muted-foreground">Invoice:</span> {p.invoice_id ?? "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
