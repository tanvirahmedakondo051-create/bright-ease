import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { getAuraPaymentStatus, verifyAuraPayment } from "@/lib/aurapay.functions";

export const Route = createFileRoute("/payment/success")({
  validateSearch: (s: Record<string, unknown>) => {
    const t = s.transactionId ?? s.transaction_id ?? s.invoice_id;
    return { transactionId: typeof t === "string" || typeof t === "number" ? String(t) : undefined };
  },
  head: () => ({
    meta: [
      { title: "পেমেন্ট যাচাই — Hexa AI" },
      { name: "description", content: "আপনার AuraPay পেমেন্ট যাচাই করা হচ্ছে।" },
      { property: "og:title", content: "পেমেন্ট যাচাই — Hexa AI" },
      { property: "og:description", content: "আপনার AuraPay পেমেন্ট যাচাই করা হচ্ছে।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Success,
});

function Success() {
  const { transactionId } = Route.useSearch();
  const verify = useServerFn(verifyAuraPayment);
  const status = useServerFn(getAuraPaymentStatus);
  const qc = useQueryClient();
  const [state, setState] = useState<{ s: "load" | "ok" | "err"; msg?: string }>({ s: "load" });
  useEffect(() => {
    let stop = false;
    const done = () => { setState({ s: "ok" }); qc.invalidateQueries(); try { sessionStorage.removeItem("hexa_pay_id"); } catch { /* ignore */ } };
    (async () => {
      try {
        if (transactionId) {
          const r = await verify({ data: { transactionId } });
          if (r.ok) return done();
          return setState({ s: "err", msg: r.error });
        }
        // No transaction id in the link: wait for AuraPay's background confirmation.
        let pid: string | null = null;
        try { pid = sessionStorage.getItem("hexa_pay_id"); } catch { /* ignore */ }
        if (!pid) return setState({ s: "err", msg: "পেমেন্টের তথ্য পাওয়া যায়নি" });
        for (let i = 0; i < 20 && !stop; i++) {
          const r = await status({ data: { paymentId: pid } });
          if (r.status === "completed") return done();
          await new Promise((res) => setTimeout(res, 3000));
        }
        if (!stop) setState({ s: "err", msg: "পেমেন্ট এখনো নিশ্চিত হয়নি। কয়েক মিনিট পরে ড্যাশবোর্ডে দেখুন।" });
      } catch {
        setState({ s: "err", msg: "যাচাই করা যায়নি, আবার চেষ্টা করুন" });
      }
    })();
    return () => { stop = true; };
  }, [transactionId]);
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="glass w-full max-w-md rounded-2xl p-8 text-center">
        {state.s === "load" && <><Loader2 className="mx-auto size-12 animate-spin text-cyan" /><p className="mt-4">পেমেন্ট যাচাই হচ্ছে...</p></>}
        {state.s === "ok" && <><CheckCircle2 className="mx-auto size-12 text-success" /><h1 className="mt-4 text-2xl font-bold">পেমেন্ট সফল!</h1><p className="mt-2 text-muted-foreground">আপনার প্ল্যান চালু হয়েছে।</p></>}
        {state.s === "err" && <><XCircle className="mx-auto size-12 text-destructive" /><h1 className="mt-4 text-xl font-bold">সমস্যা হয়েছে</h1><p className="mt-2 text-muted-foreground">{state.msg}</p></>}
        <Link to="/dashboard" className="mt-6 flex min-h-12 items-center justify-center rounded-xl bg-brand font-semibold">ড্যাশবোর্ডে যান</Link>
      </div>
    </div>
  );
}
