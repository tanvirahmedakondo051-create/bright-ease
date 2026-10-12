import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Search, Ban, Trash2, Eye, CheckCircle2, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bn, bnDate, tokensToday } from "@/lib/auth";
import { usePlans } from "@/lib/site";
import { adminDeleteUser, adminAddCoins } from "@/lib/admin.functions";
import { PageTitle, Confirm, btn } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/admin/users")({ component: Users });

function Users() {
  const qc = useQueryClient();
  const { data: plans } = usePlans();
  const del = useServerFn(adminDeleteUser);
  const [q, setQ] = useState("");
  const [planF, setPlanF] = useState("all");
  const [statusF, setStatusF] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [bulkPlan, setBulkPlan] = useState("");
  const [confirm, setConfirm] = useState<{ kind: "ban" | "delete"; id: string; banned?: boolean } | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const addCoinsFn = useServerFn(adminAddCoins);
  const [coinDialog, setCoinDialog] = useState<{ id: string; name: string } | null>(null);
  const [coinAmount, setCoinAmount] = useState("");
  const [coinNote, setCoinNote] = useState("");
  const submitCoins = async () => {
    if (!coinDialog) return;
    const amount = parseInt(coinAmount);
    if (!amount || amount < 1) return toast.error("সঠিক পরিমাণ দিন");
    const r = await addCoinsFn({ data: { user_id: coinDialog.id, amount, note: coinNote || undefined } });
    if ((r as any)?.error) return toast.error((r as any).error);
    toast.success(`${amount} কয়েন যোগ হয়েছে!`);
    setCoinDialog(null); setCoinAmount(""); setCoinNote(""); refresh();
  };

  const { data } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, pr] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("bots").select("user_id"),
      ]);
      const counts: Record<string, number> = {};
      (pr.data ?? []).forEach((x) => (counts[x.user_id] = (counts[x.user_id] ?? 0) + 1));
      return (p.data ?? []).map((u) => ({ ...u, bots: counts[u.id] ?? 0 }));
    },
  });
  const planName = Object.fromEntries((plans ?? []).map((p) => [p.id, p]));
  const rows = useMemo(
    () =>
      (data ?? []).filter((u) => {
        if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (planF !== "all" && u.plan_id !== planF) return false;
        if (statusF === "active" && u.is_banned) return false;
        if (statusF === "banned" && !u.is_banned) return false;
        return true;
      }),
    [data, q, planF, statusF],
  );
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const changePlan = async (ids: string[], planId: string) => {
    const { error } = await supabase.from("profiles").update({ plan_id: planId }).in("id", ids);
    if (error) return toast.error("প্ল্যান বদলানো যায়নি");
    toast.success("প্ল্যান বদলানো হয়েছে");
    setSel([]);
    refresh();
  };

  const runConfirm = async () => {
    if (!confirm) return;
    if (confirm.kind === "ban") {
      const { error } = await supabase.from("profiles").update({ is_banned: !confirm.banned }).eq("id", confirm.id);
      error ? toast.error("সমস্যা হয়েছে") : toast.success(confirm.banned ? "আনব্যান করা হয়েছে" : "ব্যান করা হয়েছে");
    } else {
      const r = await del({ data: { id: confirm.id } });
      "error" in r ? toast.error(r.error) : toast.success("ইউজার ডিলিট হয়েছে");
    }
    setConfirm(null);
    refresh();
  };

  const d = data?.find((u) => u.id === detail);

  return (
    <>
      <PageTitle title="ইউজার ম্যানেজমেন্ট" />
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_160px_160px]">
        <div className="relative"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input className="h-12 pl-9" placeholder="নাম বা ইমেইল খুঁজুন" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Select value={planF} onValueChange={setPlanF}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব প্ল্যান</SelectItem>{plans?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_bn}</SelectItem>)}</SelectContent></Select>
        <Select value={statusF} onValueChange={setStatusF}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সব স্ট্যাটাস</SelectItem><SelectItem value="active">সক্রিয়</SelectItem><SelectItem value="banned">ব্যান</SelectItem></SelectContent></Select>
      </div>
      {sel.length > 0 && (
        <div className="glass mb-4 flex flex-wrap items-center gap-2 rounded-xl p-3">
          <span className="text-sm">{bn(sel.length)} জন নির্বাচিত</span>
          <Select value={bulkPlan} onValueChange={setBulkPlan}><SelectTrigger className="h-11 w-40"><SelectValue placeholder="প্ল্যান বেছে নিন" /></SelectTrigger><SelectContent>{plans?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_bn}</SelectItem>)}</SelectContent></Select>
          <button disabled={!bulkPlan} onClick={() => changePlan(sel, bulkPlan)} className={`${btn} bg-brand disabled:opacity-50`}>প্ল্যান বদলান</button>
        </div>
      )}

      <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground"><tr>
            <th className="p-3"><Checkbox checked={rows.length > 0 && sel.length === rows.length} onCheckedChange={(c) => setSel(c ? rows.map((r) => r.id) : [])} /></th>
            <th className="p-3">নাম / ইমেইল</th><th className="p-3">প্ল্যান</th><th className="p-3">আজ টোকেন</th><th className="p-3">বট</th><th className="p-3">যোগদান</th><th className="p-3">স্ট্যাটাস</th><th className="p-3 text-right">অ্যাকশন</th>
          </tr></thead>
          <tbody>{rows.map((u) => (
            <tr key={u.id} className="border-t border-border">
              <td className="p-3"><Checkbox checked={sel.includes(u.id)} onCheckedChange={(c) => setSel((s) => (c ? [...s, u.id] : s.filter((x) => x !== u.id)))} /></td>
              <td className="p-3"><div className="font-medium">{u.name}</div><div className="text-xs text-muted-foreground">{u.email}</div></td>
              <td className="p-3">
                <Select value={u.plan_id ?? ""} onValueChange={(v) => changePlan([u.id], v)}><SelectTrigger className="h-9 w-28"><SelectValue placeholder="—" /></SelectTrigger><SelectContent>{plans?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_bn}</SelectItem>)}</SelectContent></Select>
              </td>
              <td className="p-3">{bn(tokensToday(u))}</td><td className="p-3">{bn(u.bots)}</td><td className="p-3">{bnDate(u.created_at)}</td>
              <td className="p-3">{u.is_banned ? <span className="text-destructive">ব্যান</span> : <span className="text-success">সক্রিয়</span>}</td>
              <td className="p-3"><div className="flex justify-end gap-1">
                <button onClick={() => setDetail(u.id)} className="grid size-9 place-items-center rounded-lg hover:bg-accent" title="বিস্তারিত দেখুন"><Eye className="size-4" /></button>
                <button onClick={() => setCoinDialog({ id: u.id, name: u.name || u.email || "" })} className="grid size-9 place-items-center rounded-lg text-amber-500 hover:bg-accent" title="কয়েন যোগ করুন"><Coins className="size-4" /></button>
                <button onClick={() => setConfirm({ kind: "ban", id: u.id, banned: u.is_banned })} className="grid size-9 place-items-center rounded-lg hover:bg-accent" title={u.is_banned ? "আনব্যান" : "ব্যান"}>{u.is_banned ? <CheckCircle2 className="size-4" /> : <Ban className="size-4" />}</button>
                <button onClick={() => setConfirm({ kind: "delete", id: u.id })} className="grid size-9 place-items-center rounded-lg text-destructive hover:bg-destructive/10" title="ডিলিট"><Trash2 className="size-4" /></button>
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">{rows.map((u) => (
        <div key={u.id} className="glass rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <Checkbox className="mt-1" checked={sel.includes(u.id)} onCheckedChange={(c) => setSel((s) => (c ? [...s, u.id] : s.filter((x) => x !== u.id)))} />
            <div className="min-w-0 flex-1"><div className="font-medium">{u.name}</div><div className="truncate text-xs text-muted-foreground">{u.email}</div></div>
            {u.is_banned ? <span className="text-xs text-destructive">ব্যান</span> : <span className="text-xs text-success">সক্রিয়</span>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
            <div>প্ল্যান<div className="text-foreground">{u.plan_id ? planName[u.plan_id]?.name_bn : "—"}</div></div>
            <div>আজ টোকেন<div className="text-foreground">{bn(tokensToday(u))}</div></div>
            <div>বট<div className="text-foreground">{bn(u.bots)}</div></div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={() => setDetail(u.id)} className={`${btn} border border-input`}>বিস্তারিত</button>
            <button onClick={() => setCoinDialog({ id: u.id, name: u.name || u.email || "" })} className={`${btn} border border-amber-500/50 text-amber-500`}>🪙 কয়েন</button>
            <button onClick={() => setConfirm({ kind: "ban", id: u.id, banned: u.is_banned })} className={`${btn} border border-input`}>{u.is_banned ? "আনব্যান" : "ব্যান"}</button>
            <button onClick={() => setConfirm({ kind: "delete", id: u.id })} className={`${btn} border border-destructive/50 text-destructive`}>ডিলিট</button>
          </div>
        </div>
      ))}</div>
      {!rows.length && <p className="py-10 text-center text-muted-foreground">কোনো ইউজার পাওয়া যায়নি</p>}

      <Dialog open={!!d} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{d?.name}</DialogTitle></DialogHeader>
          {d && (
            <div className="space-y-3 text-sm">
              <p><span className="text-muted-foreground">ইমেইল:</span> {d.email}</p>
              <p><span className="text-muted-foreground">যোগদান:</span> {bnDate(d.created_at)}</p>
              <p><span className="text-muted-foreground">বট:</span> {bn(d.bots)}টি</p>
              <p><span className="text-muted-foreground">আজ টোকেন:</span> {bn(tokensToday(d))}</p>
              <div><span className="text-muted-foreground">প্ল্যান বদলান:</span>
                <Select value={d.plan_id ?? ""} onValueChange={(v) => changePlan([d.id], v)}><SelectTrigger className="mt-1 h-12"><SelectValue /></SelectTrigger><SelectContent>{plans?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name_bn}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {coinDialog && (
        <Dialog open onOpenChange={() => setCoinDialog(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>🪙 কয়েন যোগ করুন</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{coinDialog.name}</p>
            <Input type="number" min="1" placeholder="পরিমাণ (যেমন: 50)" value={coinAmount} onChange={(e) => setCoinAmount(e.target.value)} />
            <Input placeholder="নোট (ঐচ্ছিক)" value={coinNote} onChange={(e) => setCoinNote(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button className={btn} onClick={() => setCoinDialog(null)}>বাতিল</button>
              <button className={`${btn} bg-brand`} onClick={submitCoins}>যোগ করুন</button>
            </div>
          </DialogContent>
        </Dialog>
      )}
      <Confirm
        open={!!confirm}
        title={confirm?.kind === "delete" ? "ইউজার ডিলিট করবেন?" : confirm?.banned ? "আনব্যান করবেন?" : "ইউজার ব্যান করবেন?"}
        desc={confirm?.kind === "delete" ? "অ্যাকাউন্ট ও সব bot project স্থায়ীভাবে মুছে যাবে।" : undefined}
        onCancel={() => setConfirm(null)}
        onConfirm={runConfirm}
      />
    </>
  );
}
