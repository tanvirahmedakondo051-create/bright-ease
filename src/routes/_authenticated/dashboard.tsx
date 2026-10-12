import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Crown, Bot, Loader2 } from "lucide-react";
import { BotList } from "@/components/app/BotList";
import { createBot } from "@/lib/bot.functions";
import { AppHeader } from "@/components/app/AppHeader";
import { bn, useProfile, useSession } from "@/lib/auth";
import { Progress } from "@/components/ui/progress";
import { CoinHistory, CoinIcon, fmtCoins } from "@/components/app/Coins";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "আমার বট — Hexa AI" }, { name: "description", content: "আপনার সব টেলিগ্রাম বট প্রজেক্ট।" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useSession();
  const nav = useNavigate();
  const { data: profile } = useProfile(user?.id);
  const createBotFn = useServerFn(createBot);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [showHist, setShowHist] = useState(false);

  const make = async () => {
    setBusy(true);
    try {
      const r = await createBotFn({ data: { name: name.trim() || undefined } });
      nav({ to: "/bot/$botId", params: { botId: r.id } });
    } catch { toast.error("বট তৈরি করা যায়নি"); }
    setBusy(false);
  };

  const plan = profile?.plans as { name_bn: string; price_bdt: number } | null;
  const coins = Number((profile as any)?.coins ?? 0);
  const cap = (plan as any)?.coin_cap ?? 15;
  const daily = (plan as any)?.daily_coins ?? 1;
  const pct = Math.min(100, (coins / Math.max(cap, coins, 1)) * 100);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_280px]">
        <section>
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-2xl font-bold">আমার বট</h1>
            <button onClick={() => setOpen(true)} className="flex min-h-12 items-center gap-2 rounded-xl bg-brand px-4 font-semibold shadow-glow">
              <Plus className="size-5" /> নতুন বট
            </button>
          </div>
          <BotList onNew={() => setOpen(true)} />
        </section>
        <aside className="space-y-4">
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><CoinIcon /> কয়েন ওয়ালেট</div>
            <p className="mt-2 text-2xl font-bold">🪙 {fmtCoins(coins)} <span className="text-sm font-normal text-muted-foreground">কয়েন</span></p>
            <Progress value={pct} className={`mt-2 h-2 ${coins < 2 ? "[&>div]:bg-destructive" : "[&>div]:bg-cyan"}`} />
            <p className="mt-2 text-xs text-muted-foreground">প্রতিদিন রাত ১২টায় +{bn(daily)} কয়েন (সর্বোচ্চ {bn(cap)})</p>
            {coins <= 0 && <p className="mt-2 text-xs text-destructive">🪙 কয়েন শেষ! কাল আবার পাবেন, অথবা <Link to="/pricing" className="font-semibold text-cyan">আপগ্রেড করুন</Link></p>}
            <button onClick={() => setShowHist((v) => !v)} className="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border border-border text-sm">🪙 হিস্টোরি</button>
            {showHist && user && <div className="mt-2 max-h-80 overflow-y-auto"><CoinHistory userId={user.id} /></div>}
          </div>
          <div className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Crown className="size-4 text-cyan" /> বর্তমান প্ল্যান</div>
            <p className="mt-2 text-lg font-semibold">{plan?.name_bn ?? "ফ্রি"}</p>
            {(plan?.price_bdt ?? 0) === 0 && <Link to="/pricing" className="mt-3 flex min-h-12 items-center justify-center rounded-xl bg-brand font-semibold">আপগ্রেড</Link>}
          </div>
        </aside>
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bot className="size-5 text-cyan" /> নতুন টেলিগ্রাম বট</DialogTitle>
            <DialogDescription>Python বট — বানানোর পর ফাইল ডাউনলোড করে যেকোনো জায়গায় চালাবেন।</DialogDescription>
          </DialogHeader>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && make()} maxLength={60} placeholder="বটের নাম (যেমন: অর্ডার বট)" className="min-h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-cyan" />
          <button disabled={busy} onClick={make} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand font-semibold disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} তৈরি করুন
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
