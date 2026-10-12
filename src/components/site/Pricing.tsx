import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { usePlans } from "@/lib/site";
import { bn, useSession } from "@/lib/auth";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { createAuraPayment } from "@/lib/aurapay.functions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export function PricingCards() {
  const { data: plans } = usePlans();
  const { user } = useSession();
  const create = useServerFn(createAuraPayment);
  const [busy, setBusy] = useState<string | null>(null);
  const buy = async (planId: string) => {
    setBusy(planId);
    try {
      const r = await create({ data: { planId } });
      if ("error" in r) { toast.error(r.error); setBusy(null); return; }
      try { sessionStorage.setItem("hexa_pay_id", r.paymentId); } catch { /* ignore */ }
      window.location.href = r.url;
    } catch { toast.error("পেমেন্ট শুরু করা যায়নি"); setBusy(null); }
  };
  if (!plans) return <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((i) => <div key={i} className="glass h-96 animate-pulse rounded-2xl" />)}</div>;
  return (
    <>
      <div className={`grid gap-4 ${plans.length > 2 ? "md:grid-cols-3" : "md:grid-cols-2"} mx-auto max-w-4xl`}>
        {plans.map((p) => {
          const featured = p.price_bdt > 0;
          return (
            <div key={p.id} className={`relative rounded-2xl p-6 ${featured ? "border border-primary/60 bg-gradient-to-b from-primary/20 to-card shadow-glow" : "glass"}`}>
              {featured && <span className="absolute right-4 top-4 rounded-full bg-brand px-3 py-1 text-xs font-semibold">জনপ্রিয়</span>}
              <h3 className="text-xl font-bold">{p.name_bn}</h3>
              <p className="mt-3">
                <span className="text-4xl font-bold">৳{bn(p.price_bdt)}</span>
                <span className="text-muted-foreground"> / মাস</span>
              </p>
              <div className="mt-5 rounded-xl border border-border bg-background/40 p-3">
                <p className="flex items-center gap-2 text-lg font-bold">🪙 {bn((p as any).bonus_coins ?? 0)} <span className="text-sm font-normal text-muted-foreground">কয়েন {p.price_bdt ? "কেনার সাথে" : "সাইনআপে"}</span></p>
                <p className="mt-1 text-sm">+{bn((p as any).daily_coins ?? 0)} কয়েন প্রতিদিন <span className="text-muted-foreground">(সর্বোচ্চ {bn((p as any).coin_cap ?? 0)})</span></p>
                <p className="mt-1 text-xs text-muted-foreground">সর্বোচ্চ {Number((p as any).max_bot_projects) < 0 ? "সীমাহীন" : bn((p as any).max_bot_projects)}টি বট · {bn((p as any).daily_ai_messages)} AI message/দিন</p>
                <p className="mt-1 text-xs text-muted-foreground">{bn((p as any).temp_host_minutes_per_day)} মিনিট test/দিন · {bn((p as any).max_fix_requests_per_day)} scoped fix/দিন</p>
              </div>
              <ul className="mt-6 space-y-3">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2 text-sm">
                    <Check className="size-5 shrink-0 text-cyan" /> {f}
                  </li>
                ))}
              </ul>
              {p.price_bdt === 0 ? (
                <Link to={user ? "/dashboard" : "/signup"} className="mt-8 flex min-h-12 items-center justify-center rounded-xl border border-input font-semibold">
                  ফ্রি শুরু করুন
                </Link>
              ) : user ? (
                <button disabled={busy === p.id} onClick={() => buy(p.id)} className="mt-8 disabled:opacity-60 flex min-h-12 w-full items-center justify-center rounded-xl bg-brand font-semibold">
                  {busy === p.id ? "অপেক্ষা করুন..." : `${p.name_bn} নিন`}
                </button>
              ) : (
                <Link to="/signup" className="mt-8 flex min-h-12 items-center justify-center rounded-xl bg-brand font-semibold">
                  {p.name_bn} নিন
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">🪙 কয়েন AI plan, build ও scoped fix-এ ব্যবহার হয়। আপনার বট ZIP হিসেবে ডাউনলোড হবে।</p>
    </>
  );
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <Accordion type="single" collapsible className="mx-auto max-w-3xl">
      {items.map((it, i) => (
        <AccordionItem key={i} value={String(i)} className="border-border">
          <AccordionTrigger className="min-h-12 text-left text-base">{it.q}</AccordionTrigger>
          <AccordionContent className="text-muted-foreground">{it.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
