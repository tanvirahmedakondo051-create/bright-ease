import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { bn, bnDate, useProfile, useSession } from "@/lib/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function fmtCoins(n: number) {
  const r = Math.round(n * 10) / 10;
  return bn(Number.isInteger(r) ? String(r) : r.toFixed(1));
}

export function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${bn(m)} মি ${bn(s % 60)} সে` : `${bn(s)} সে`;
}

export function CoinIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" fill="oklch(0.82 0.16 85)" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="oklch(0.6 0.13 70)" strokeWidth="1.5" />
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700" fill="oklch(0.45 0.1 60)">H</text>
    </svg>
  );
}

export function CoinHistory({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["coin-tx", userId],
    queryFn: async () => {
      const { data } = await supabase.from("coin_transactions" as any).select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
      return (data ?? []) as any[];
    },
  });
  const label: Record<string, string> = { bonus: "বোনাস", refill: "দৈনিক রিফিল", purchase: "প্ল্যান কেনা", spend: "খরচ" };
  if (isLoading) return <div className="grid place-items-center py-6"><Loader2 className="size-5 animate-spin text-cyan" /></div>;
  if (!data?.length) return <p className="py-6 text-center text-sm text-muted-foreground">এখনো কোনো লেনদেন নেই</p>;
  return (
    <ul className="divide-y divide-border">
      {data.map((t) => {
        const amt = Number(t.amount);
        return (
          <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate">{t.reason || label[t.type]}</p>
              <p className="text-xs text-muted-foreground">{label[t.type]} • {bnDate(t.created_at)}</p>
            </div>
            <span className={`shrink-0 font-semibold ${amt < 0 ? "text-destructive" : "text-success"}`}>{amt < 0 ? "−" : "+"}{fmtCoins(Math.abs(amt))}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function CoinChip() {
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  if (!user || !profile) return null;
  const coins = Number((profile as any).coins ?? 0);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className={`flex min-h-10 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold ${coins <= 0 ? "border-destructive/60 text-destructive" : "border-border"}`} aria-label="কয়েন ওয়ালেট">
          <CoinIcon /> {fmtCoins(coins)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,340px)]">
        <div className="flex items-center gap-2"><CoinIcon className="size-7" /><div><p className="text-lg font-bold">{fmtCoins(coins)} কয়েন</p><p className="text-xs text-muted-foreground">১টি সাইট বানাতে ≈ ১-২ কয়েন</p></div></div>
        <p className="mt-3 text-xs font-semibold text-muted-foreground">🪙 হিস্টোরি</p>
        <div className="max-h-72 overflow-y-auto"><CoinHistory userId={user.id} /></div>
        <Link to="/pricing" className="mt-3 flex min-h-11 items-center justify-center rounded-xl bg-brand text-sm font-semibold">আরও কয়েন নিন</Link>
      </PopoverContent>
    </Popover>
  );
}

export type Progress = { step: string; tokens: number; start: number; last: number };

export function ProgressCard({ p, tpc, onCancel }: { p: Progress; tpc: number; onCancel: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const idle = now - p.last > 30_000;
  return (
    <div className="glass w-full max-w-md rounded-2xl p-4 text-sm">
      <div className="flex items-center gap-2 font-medium"><Loader2 className="size-4 animate-spin text-cyan" /> {p.step}</div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full w-1/3 animate-[progress-slide_1.4s_ease-in-out_infinite] rounded-full bg-cyan" /></div>
      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><CoinIcon className="size-3.5" /> {bn(p.tokens)} টোকেন ({fmtCoins(p.tokens / tpc)} কয়েন)</span>
        <span>⏱️ {fmtDuration(now - p.start)}</span>
      </div>
      {idle && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-warning/10 p-2 text-xs">
          <span>AI এখনো কাজ করছে, একটু অপেক্ষা করুন 🙏</span>
          <button onClick={onCancel} className="flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-border px-2"><X className="size-3" /> বাতিল</button>
        </div>
      )}
    </div>
  );
}
