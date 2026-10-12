import { useEffect, useMemo, useState, type ReactNode } from "react";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import { Bookmark, BookmarkCheck, MoreHorizontal, Copy, Check, Link2, RefreshCw, Clock, ChevronRight, ChevronDown, FileText, Eye, Play, Pause, RotateCcw, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { CoinIcon, fmtCoins, fmtDuration } from "@/components/app/Coins";
import { bn } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);

export type ChatMsg = {
  role: "user" | "assistant"; content: string; at?: string; mode?: "plan" | "build"; id?: string; ms?: number; coins?: number;
  title?: string; kind?: string; bookmarked?: boolean; checkpointId?: string; percent?: number; doneTitles?: string[]; leftTitles?: string[]; resumed?: boolean;
  files?: { name: string; url: string; type: string }[];
};

/** Responsive sheet: bottom drawer on mobile, dialog on desktop. */
export function Sheet({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (v: boolean) => void; title: ReactNode; children: ReactNode }) {
  const mobile = useIsMobile();
  if (mobile) return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90dvh] pb-[env(safe-area-inset-bottom)]"><DrawerHeader className="text-left"><DrawerTitle>{title}</DrawerTitle></DrawerHeader><div className="overflow-y-auto px-4 pb-4">{children}</div></DrawerContent>
    </Drawer>
  );
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>{children}</DialogContent></Dialog>;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [ok, setOk] = useState(false);
  const html = useMemo(() => {
    const l = hljs.getLanguage(lang) ? lang : "html";
    try { return hljs.highlight(code, { language: l }).value; } catch { return code.replace(/</g, "&lt;"); }
  }, [lang, code]);
  return (
    <div className="my-2 overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-1 text-[11px] text-muted-foreground">
        <span className="font-en">{lang || "code"}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setOk(true); setTimeout(() => setOk(false), 1500); }} className="flex min-h-8 items-center gap-1 hover:text-foreground">{ok ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{ok ? "কপি হয়েছে" : "কপি"}</button>
      </div>
      <pre className="hljs-dark max-h-80 overflow-auto p-3 font-mono text-xs leading-relaxed"><code dangerouslySetInnerHTML={{ __html: html }} /></pre>
    </div>
  );
}

/** Plain text with ``` code fences rendered as highlighted blocks. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/```(\w*)\n?([\s\S]*?)(?:```|$)/g);
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 3) {
    if (parts[i]?.trim()) out.push(<span key={i} className="whitespace-pre-line">{parts[i].replace(/\n{3,}/g, "\n\n")}</span>);
    if (parts[i + 2] !== undefined) out.push(<CodeBlock key={i + "c"} lang={parts[i + 1] || "html"} code={parts[i + 2].trimEnd()} />);
  }
  return <>{out}</>;
}

const timeOf = (at?: string) => at ? new Date(at).toLocaleTimeString("bn-BD", { hour: "numeric", minute: "2-digit" }) : "";

export function MessageCard({ m, children, onMore, onBookmark, onPreview, plan }: { m: ChatMsg; children: ReactNode; onMore: () => void; onBookmark: () => void; onPreview?: () => void; plan?: ReactNode }) {
  const [open, setOpen] = useState(true);
  const title = m.title || (m.mode === "plan" ? "প্ল্যান" : m.content.split("\n")[0].slice(0, 50));
  return (
    <div id={m.id ? `msg-${m.id}` : undefined} className="min-w-0 rounded-2xl border border-border bg-card/60 p-3 text-[15px] leading-relaxed">
      <div className="mb-1.5 flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
        {m.at && <span className="shrink-0 text-[11px] text-muted-foreground">{timeOf(m.at)}</span>}
        <button onClick={onBookmark} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-accent" aria-label="বুকমার্ক">{m.bookmarked ? <BookmarkCheck className="size-4 text-cyan" /> : <Bookmark className="size-4" />}</button>
        <button onClick={onMore} className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-accent" aria-label="বিস্তারিত"><MoreHorizontal className="size-4" /></button>
      </div>
      {plan ? (
        <details open className="group rounded-xl border border-border bg-background/40 px-3 py-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-cyan"><FileText className="size-4" /> প্ল্যান<ChevronDown className="ml-auto size-4 transition group-open:rotate-180" /></summary>
          <div className="mt-2">{plan}</div>
        </details>
      ) : open && <div className="min-w-0 break-words">{children}</div>}
      <div className="mt-2 flex gap-1.5">
        {!plan && <button onClick={() => setOpen(!open)} className={`min-h-8 rounded-full border px-3 text-xs ${open ? "border-cyan/60 text-cyan" : "border-border"}`}>বিস্তারিত</button>}
        {onPreview && <button onClick={onPreview} className="flex min-h-8 items-center gap-1 rounded-full border border-border px-3 text-xs hover:border-cyan"><Eye className="size-3.5" />প্রিভিউ</button>}
      </div>
    </div>
  );
}

export function DetailsSheet({ m, onClose, onRetry }: { m: ChatMsg | null; onClose: () => void; onRetry: () => void }) {
  const copy = (t: string, ok: string) => { navigator.clipboard.writeText(t).then(() => toast.success(ok)).catch(() => toast.error("কপি করা যায়নি")); };
  const row = "flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm hover:bg-accent";
  return (
    <Sheet open={!!m} onOpenChange={(v) => !v && onClose()} title="মেসেজের বিস্তারিত">
      {m && (
        <div className="space-y-1">
          <div className={row}><Clock className="size-4 text-cyan" />কাজ করেছে<span className="ml-auto font-medium">{m.ms ? fmtDuration(m.ms) : "—"}</span></div>
          <div className={row}><CoinIcon className="size-4" />কয়েন খরচ<span className="ml-auto font-medium">{typeof m.coins === "number" ? `${fmtCoins(m.coins)} কয়েন` : "—"}</span></div>
          <button className={row} onClick={() => { const u = new URL(window.location.href); u.hash = m.id ? `msg-${m.id}` : ""; copy(u.toString(), "লিংক কপি হয়েছে"); onClose(); }}><Link2 className="size-4" />লিংক কপি করুন</button>
          <button className={row} onClick={() => { copy(m.content, "লেখা কপি হয়েছে"); onClose(); }}><Copy className="size-4" />লেখা কপি করুন</button>
          <button className={row} onClick={() => { onClose(); onRetry(); }}><RefreshCw className="size-4" />আবার চেষ্টা করুন</button>
        </div>
      )}
    </Sheet>
  );
}

export function LiveStatusRow({ step, onClick, open }: { step: string; onClick: () => void; open: boolean }) {
  return (
    <button onClick={onClick} className="flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-border bg-card/50 px-3 text-left text-sm">
      <Loader2 className="size-4 shrink-0 animate-spin text-cyan" />
      <span className="min-w-0 flex-1 truncate">{step}</span>
      <ChevronRight className={`size-4 shrink-0 transition ${open ? "rotate-90" : ""}`} />
    </button>
  );
}

export type Question = { q: string; options: string[] };
export function QuestionDialog({ questions, onDone, onCancel }: { questions: Question[] | null; onDone: (answers: string[]) => void; onCancel: () => void }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState<string[]>([]);
  const [pick, setPick] = useState("");
  const [custom, setCustom] = useState("");
  useEffect(() => { setI(0); setAns([]); setPick(""); setCustom(""); }, [questions]);
  if (!questions) return null;
  const q = questions[i];
  const next = (val: string) => {
    const a = [...ans, val];
    setPick(""); setCustom("");
    if (i + 1 >= questions.length) { onDone(a); return; }
    setAns(a); setI(i + 1);
  };
  const canNext = custom.trim() || pick;
  return (
    <Sheet open onOpenChange={(v) => !v && onCancel()} title={<span className="flex items-center gap-2"><span className="rounded-full bg-cyan/15 px-3 py-1 text-xs font-semibold text-cyan">প্রশ্ন {bn(i + 1)} / {bn(questions.length)}</span></span>}>
      {q && (
        <div className="px-1">
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-cyan to-blue-500 transition-all duration-500" style={{ width: `${((i + 1) / questions.length) * 100}%` }} /></div>
          <p className="mb-4 text-lg font-bold leading-relaxed">{q.q}</p>
          <div className="flex flex-col gap-2.5">
            {q.options.map((o) => {
              const selected = pick === o && !custom;
              return (
                <button key={o} onClick={() => { setPick(o); setCustom(""); }} className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-[15px] transition-all duration-200 ${selected ? "border-cyan bg-cyan/10 shadow-[0_0_20px_rgba(34,211,238,0.15)]" : "border-border/60 bg-card/50 hover:border-cyan/50 hover:bg-card"}`}>
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all ${selected ? "border-cyan" : "border-muted-foreground/40"}`}>
                    {selected && <span className="size-2.5 rounded-full bg-cyan" />}
                  </span>
                  <span className={selected ? "font-semibold text-foreground" : "text-foreground/90"}>{o}</span>
                </button>
              );
            })}
          </div>
          <div className="relative mt-3">
            <input value={custom} onChange={(e) => { setCustom(e.target.value); setPick(""); }} placeholder="নিজের মতো লিখুন..." className="min-h-13 w-full rounded-2xl border-2 border-border/60 bg-card/50 px-4 py-3 text-[15px] outline-none transition-all placeholder:text-muted-foreground/60 focus:border-cyan" />
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={() => next("")} className="min-h-13 flex-1 rounded-2xl border border-border/60 text-sm font-medium text-muted-foreground transition-all hover:border-border hover:text-foreground">এড়িয়ে যান</button>
            <button onClick={() => next(custom.trim() || pick)} disabled={!canNext} className="min-h-13 flex-[2] rounded-2xl bg-gradient-to-r from-cyan to-blue-500 text-sm font-bold text-white shadow-lg transition-all hover:shadow-cyan/25 disabled:opacity-40 disabled:shadow-none">পরবর্তী →</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function EstimateDialog({ est, balance, onStart, onCancel }: { est: number | null; balance: number; onStart: () => void; onCancel: () => void }) {
  const low = est !== null && balance < est;
  return (
    <Sheet open={est !== null} onOpenChange={(v) => !v && onCancel()} title="কাজ শুরু করবেন?">
      {est !== null && (
        <div>
          <p className="flex items-center gap-2 text-base"><CoinIcon className="size-5" />এই কাজে <b>~{fmtCoins(est)} কয়েন</b> লাগবে</p>
          <p className="mt-1 text-sm text-muted-foreground">আপনার আছে {fmtCoins(balance)} কয়েন</p>
          {low && <p className="mt-3 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm">⚠️ কয়েন কম আছে। কাজ মাঝপথে থেমে গেলে চেকপয়েন্ট সেভ থাকবে — কয়েন পেলে সেখান থেকেই চালিয়ে যেতে পারবেন।</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={onCancel} className="min-h-12 flex-1 rounded-xl border border-border text-sm">বাতিল</button>
            <button onClick={onStart} className="min-h-12 flex-1 rounded-xl bg-brand text-sm font-semibold text-primary-foreground">শুরু করুন</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function PausedCard({ m, canResume, busy, onResume }: { m: ChatMsg; canResume: boolean; busy: boolean; onResume: () => void }) {
  return (
    <div className="rounded-2xl border border-cyan/40 bg-cyan/5 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold"><Pause className="size-4 text-cyan" />{m.content}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-cyan" style={{ width: `${m.percent ?? 0}%` }} /></div>
      {!!m.doneTitles?.length && <p className="mt-2 text-xs text-muted-foreground">✅ {m.doneTitles.join(" • ")}</p>}
      {!!m.leftTitles?.length && <p className="mt-1 text-xs text-muted-foreground">⏳ {m.leftTitles.join(" • ")}</p>}
      {m.resumed ? <p className="mt-3 text-xs text-success">▶️ চালিয়ে যাওয়া হয়েছে</p> : (
        <div className="mt-3 flex flex-wrap gap-2">
          {canResume ? (
            <button onClick={onResume} disabled={busy} className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand font-semibold text-primary-foreground disabled:opacity-50"><Play className="size-4" />চালিয়ে যান</button>
          ) : (
            <>
              <a href="/pricing" className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand font-semibold text-primary-foreground">আপগ্রেড করুন</a>
              <span className="flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border text-xs">কাল আসুন — নতুন কয়েন পাবেন</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

type Cp = { id: string; progress_percent: number; completed_steps: { title: string }[]; status: string; created_at: string; expires_at: string; partial_html: string };
export function CheckpointsDialog({ open, onOpenChange, projectId, onRollback }: { open: boolean; onOpenChange: (v: boolean) => void; projectId: string; onRollback: (html: string) => void }) {
  const [list, setList] = useState<Cp[] | null>(null);
  useEffect(() => {
    if (!open) return;
    setList(null);
    supabase.from("task_checkpoints" as any).select("id, progress_percent, completed_steps, status, created_at, expires_at, partial_html").eq("project_id", projectId).order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => setList((data as any) ?? []));
  }, [open, projectId]);
  const rollback = async (c: Cp) => {
    const html = c.partial_html.replace("<!--HEXA:NEXT-->", "");
    if (!html) return toast.error("এই চেকপয়েন্টে এখনো কোনো সাইট নেই");
    const { error } = await supabase.from("projects").update({ code_html: html }).eq("id", projectId);
    if (error) return toast.error("ফিরে যাওয়া যায়নি");
    onRollback(html); onOpenChange(false); toast.success(`${bn(c.progress_percent)}% চেকপয়েন্টে ফিরে গেছে`);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="চেকপয়েন্ট">
      <p className="mb-3 text-xs text-muted-foreground">প্রতিটি ধাপ শেষে নিজে থেকে সেভ হয়। ৭ দিন পর মুছে যায়।</p>
      {!list ? <Loader2 className="mx-auto size-5 animate-spin text-cyan" /> : !list.length ? <p className="py-6 text-center text-sm text-muted-foreground">এখনো কোনো চেকপয়েন্ট নেই</p> : (
        <div className="max-h-[60dvh] space-y-2 overflow-y-auto">
          {list.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{bn(c.progress_percent)}% • {c.status === "paused" ? "থেমে আছে" : c.status === "done" ? "সম্পূর্ণ" : "ধাপ সেভ"}</p>
                <p className="truncate text-xs text-muted-foreground">{(c.completed_steps ?? []).map((s) => s.title).join(", ") || "শুরু"}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(c.created_at).toLocaleString("bn-BD", { dateStyle: "short", timeStyle: "short" })}</p>
              </div>
              <button onClick={() => rollback(c)} className="flex min-h-10 shrink-0 items-center gap-1 rounded-full border border-border px-3 text-xs hover:border-cyan"><RotateCcw className="size-3.5" />ফিরে যান</button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}

/** Notice for checkpoints that will be deleted within a day. */
export function useExpiringCheckpoints(projectId: string) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const soon = new Date(Date.now() + 86400000).toISOString();
    supabase.from("task_checkpoints" as any).select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "paused").lt("expires_at", soon)
      .then(({ count }) => setN(count ?? 0));
  }, [projectId]);
  return n;
}

export { X };

export function CoinCheckpointDialog({ checkpoint, onContinue, onStop }: {
  checkpoint: { coinsSpent: number; checkpoint: number; balance: number } | null;
  onContinue: (dontAskAgain: boolean) => void;
  onStop: () => void;
}) {
  const [dontAsk, setDontAsk] = useState(false);
  useEffect(() => { setDontAsk(false); }, [checkpoint]);
  if (!checkpoint) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-amber-500/30 bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-amber-500/15 text-2xl">🪙</span>
          <div>
            <h3 className="text-lg font-bold">কয়েন খরচ হচ্ছে!</h3>
            <p className="text-sm text-muted-foreground">এই বিল্ডে {bn(Math.round(checkpoint.coinsSpent))} কয়েন খরচ হয়েছে</p>
          </div>
        </div>
        <p className="mb-4 text-sm leading-relaxed">চালিয়ে যাবেন? ব্যালেন্স: <b className="text-cyan">{bn(Math.round(checkpoint.balance))} কয়েন</b></p>
        <label className="mb-4 flex cursor-pointer items-center gap-2.5 rounded-xl border border-border/60 p-3 text-sm transition-all hover:border-cyan/50">
          <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} className="size-4 accent-cyan" />
          <span>এই প্রজেক্টে আর জিজ্ঞেস করবেন না</span>
        </label>
        <div className="flex gap-3">
          <button onClick={onStop} className="min-h-12 flex-1 rounded-2xl border border-red-500/40 text-sm font-semibold text-red-400 transition-all hover:bg-red-500/10">⏹️ থামান</button>
          <button onClick={() => onContinue(dontAsk)} className="min-h-12 flex-[2] rounded-2xl bg-gradient-to-r from-cyan to-blue-500 text-sm font-bold text-white shadow-lg transition-all hover:shadow-cyan/25">▶️ চালিয়ে যান</button>
        </div>
      </div>
    </div>
  );
}
