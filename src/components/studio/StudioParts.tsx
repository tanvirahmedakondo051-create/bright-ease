import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import hljs from "highlight.js/lib/core";
import python from "highlight.js/lib/languages/python";
import markdown from "highlight.js/lib/languages/markdown";
import { Bot, Check, Copy, Download, ExternalLink, FileCode2, KeyRound, Loader2, Pencil, Play, Plus, RotateCcw, Square } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { BotPlan } from "@/lib/bot.functions";

hljs.registerLanguage("python", python);
hljs.registerLanguage("markdown", markdown);

export type BotFile = { path: string; content: string };
export const HEXAHOSTER_URL = "https://hexahoster.xyz";

export const fmtClock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

/* ---------------- Projects ---------------- */
export function ProjectsPanel({ currentId, onNew }: { currentId: string; onNew: () => void }) {
  const { user } = useSession();
  const { data: bots } = useQuery({
    queryKey: ["bots", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return [];
      return (await supabase.from("bots").select("id, name, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false })).data ?? [];
    },
  });
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="font-display text-sm font-semibold">প্রজেক্ট</p>
        <Button size="sm" onClick={onNew} className="h-8 rounded-lg"><Plus />নতুন বট</Button>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {bots?.map((b: any) => (
          <Link key={b.id} to="/bot/$botId" params={{ botId: b.id }} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm transition-colors ${b.id === currentId ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"}`}>
            <Bot className="size-4 shrink-0" /><span className="truncate">{b.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Plan card ---------------- */
export function PlanCard({ plan, fallback, actions }: { plan?: BotPlan; fallback: string; actions?: React.ReactNode }) {
  const section = (title: string, items: string[]) => items.length ? (
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1">{items.map((i, k) => <li key={k} className="flex gap-2 text-sm"><span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />{i}</li>)}</ul>
    </div>
  ) : null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className="mb-2 inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">প্ল্যান</span>
      <p className="text-sm leading-relaxed">{plan?.summary || fallback}</p>
      {plan && <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {section("মেনু", plan.menus)}
        {section("ফিচার", plan.features)}
        {section("ফাইল", plan.files)}
        {section("Acceptance", plan.acceptance)}
      </div>}
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------------- Build progress ---------------- */
const STEPS = ["Plan approved", "Writing app.py", "Ready"];
export function BuildProgress({ elapsed, mode, step, onStop }: { elapsed: number; mode: "plan" | "build"; step?: string; onStop: () => void }) {
  const stage = mode === "plan" ? 0 : elapsed < 3000 ? 0 : 1;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Loader2 className="size-4 animate-spin text-primary" />
        <div className="flex flex-1 flex-wrap items-center gap-2 text-xs">
          {(mode === "plan" ? ["Planning — no code"] : STEPS).map((s, i) => (
            <span key={s} className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${i < stage ? "text-success" : i === stage ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
              {i < stage && <Check className="size-3" />}{s}
            </span>
          ))}
          {step && <span className="rounded-full bg-accent px-2 py-0.5 text-foreground">{step}</span>}
        </div>
        <span className="font-en text-xs tabular-nums text-muted-foreground">⏱ {fmtClock(elapsed)}</span>
      </div>
      <Button variant="outline" size="sm" onClick={onStop} className="mt-3 rounded-lg"><Square className="size-3" />জেনারেশন বন্ধ</Button>
    </div>
  );
}

/* ---------------- Host actions ---------------- */
export type HostStatus = { status: string; expiresAt: string | null; log: string; hasToken: boolean; hasAdmin: boolean; botUsername: string | null };
export function StatusChip({ st, starting }: { st?: HostStatus; starting?: boolean }) {
  const running = st?.status === "running" && st.expiresAt;
  const now = useNow(!!running);
  const left = running && st?.expiresAt ? new Date(st.expiresAt).getTime() - now : 0;
  const state = starting || st?.status === "starting" ? "starting" : running && left > 0 ? "online" : st?.status === "error" ? "error" : "offline";
  const cls = { online: "bg-success/15 text-success", starting: "bg-warning/15 text-warning", error: "bg-destructive/15 text-destructive", offline: "bg-muted text-muted-foreground" }[state];
  const label = { online: `Online (ends in ${fmtClock(left)})`, starting: "Starting…", error: "Error", offline: "Offline" }[state];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-en text-xs font-medium tabular-nums ${cls}`}><span className={`size-1.5 rounded-full bg-current ${state === "online" ? "animate-pulse" : ""}`} />{label}</span>;
}

export function HostActions({ st, starting, onZip, onTest, onStop, hostUrl = HEXAHOSTER_URL }: { st?: HostStatus; starting: boolean; onZip: () => void; onTest: () => void; onStop: () => void; hostUrl?: string }) {
  const online = st?.status === "running" && st.expiresAt && new Date(st.expiresAt).getTime() > Date.now();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button onClick={onZip} className="rounded-xl"><Download />ফাইল ডাউনলোড ZIP</Button>
        {online
          ? <Button variant="secondary" onClick={onStop} className="rounded-xl"><Square className="size-3" />টেস্ট বন্ধ</Button>
          : <Button variant="secondary" disabled={starting} onClick={onTest} className="rounded-xl">{starting ? <Loader2 className="animate-spin" /> : st?.status === "stopped" || st?.status === "error" ? <RotateCcw /> : <Play />}{st && st.status !== "stopped" && st.status !== "starting" ? "আবার ৫ মিনিট টেস্ট" : "৫ মিনিট লাইভ টেস্ট"}</Button>}
        <Button asChild variant="outline" className="rounded-xl"><a href={hostUrl} target="_blank" rel="noopener noreferrer"><ExternalLink />পার্মানেন্ট হোস্ট — ভিজিট করুন</a></Button>
      </div>
      <div className="flex flex-wrap items-center gap-3"><StatusChip st={st} starting={starting} /><span className="text-xs text-muted-foreground">২৪/৭ হোস্ট করতে Hexa Boost Panel ব্যবহার করুন</span>{online && st?.botUsername && <a className="font-en text-xs text-success underline" href={`https://t.me/${st.botUsername}`} target="_blank" rel="noopener noreferrer">@{st.botUsername}</a>}</div>
    </div>
  );
}

/* ---------------- Secrets dialog ---------------- */
export function SecretsDialog({ open, hasToken, onClose, onSave }: { open: boolean; hasToken: boolean; onClose: () => void; onSave: (token: string, adminId: string) => Promise<boolean> }) {
  const [token, setToken] = useState("");
  const [admin, setAdmin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) setError(""); }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><KeyRound className="size-5 text-primary" />বট টোকেন ও Admin ID</DialogTitle>
          <DialogDescription>এনক্রিপ্ট করে সেভ হবে। কোনো ফাইল বা ZIP-এ লেখা হবে না।</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          if (!hasToken && !token.trim()) return toast.error("BOT_TOKEN দিন");
          setBusy(true);
          setError("");
          try {
            const ok = await Promise.race([onSave(token, admin), new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 20_000))]);
            if (ok) { setToken(""); setAdmin(""); }
            else setError("সেভ সম্পন্ন হয়নি। সংযোগ যাচাই করে আবার চেষ্টা করুন।");
          } finally { setBusy(false); }
        }}>
          <label className="block text-sm">BOT_TOKEN {hasToken && <span className="text-xs text-muted-foreground">(সেভ আছে — বদলাতে চাইলে দিন)</span>}
            <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="123456:ABC..." className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 font-en text-sm outline-none focus:border-primary" />
          </label>
          <label className="block text-sm">ADMIN_ID
            <input inputMode="numeric" value={admin} onChange={(e) => setAdmin(e.target.value.replace(/[^\d-]/g, ""))} placeholder="123456789" className="mt-1 h-11 w-full rounded-xl border border-input bg-background px-3 font-en text-sm outline-none focus:border-primary" />
          </label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">{busy && <Loader2 className="animate-spin" />}সেভ করে চালিয়ে যান</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Files ---------------- */
export function FilesPanel({ files, lastBuild, onZip, onVersions }: { files: BotFile[]; lastBuild?: string | null; onZip: () => void; onVersions: () => void }) {
  const [sel, setSel] = useState("app.py");
  const file = files.find((f) => f.path === sel) ?? files[0];
  const html = useMemo(() => {
    if (!file) return "";
    const lang = file.path.endsWith(".py") ? "python" : file.path.endsWith(".md") ? "markdown" : null;
    return lang ? hljs.highlight(file.content, { language: lang }).value : file.content.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] ?? c);
  }, [file]);
  const copy = async () => {
    const b = files.find((f) => f.path === "app.py");
    if (!b) return;
    await navigator.clipboard.writeText(b.content);
    toast.success("app.py কপি হয়েছে");
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <Button disabled={!files.length} onClick={onZip} className="h-11 w-full rounded-xl"><Download />ফাইল ডাউনলোড করুন (ZIP)</Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={!files.length} onClick={copy} className="flex-1 rounded-lg"><Copy />app.py কপি</Button>
          <Button variant="outline" size="sm" onClick={onVersions} className="flex-1 rounded-lg"><RotateCcw />ভার্সন</Button>
        </div>
        {lastBuild && <p className="text-xs text-muted-foreground">শেষ বিল্ড: {new Date(lastBuild).toLocaleString("bn-BD")}</p>}
      </div>
      {!files.length ? (
        <div className="grid flex-1 place-items-center p-8 text-center text-sm text-muted-foreground"><div><FileCode2 className="mx-auto mb-3 size-8 opacity-40" />প্ল্যান অনুমোদন করলে ফাইল এখানে দেখাবে</div></div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-border p-2">
            {files.map((f) => <button key={f.path} onClick={() => setSel(f.path)} className={`rounded-lg px-2.5 py-1.5 font-en text-xs ${f.path === file?.path ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{f.path}</button>)}
          </div>
          <pre className="hljs-dark min-h-0 flex-1 overflow-auto p-4 font-en text-xs leading-relaxed"><code dangerouslySetInnerHTML={{ __html: html }} /></pre>
        </>
      )}
    </div>
  );
}

/* ---------------- Rename ---------------- */
export function RenameInline({ name, onSave }: { name: string; onSave: (n: string) => void }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(name);
  useEffect(() => setV(name), [name]);
  if (!edit) return <button onClick={() => setEdit(true)} className="group flex min-w-0 items-center gap-1.5 font-display font-semibold"><span className="truncate">{name}</span><Pencil className="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-60" /></button>;
  return <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSave(v.trim()); setEdit(false); }}><input autoFocus value={v} onBlur={() => setEdit(false)} onChange={(e) => setV(e.target.value)} maxLength={60} className="h-8 w-40 rounded-lg border border-input bg-background px-2 text-sm outline-none focus:border-primary sm:w-56" /></form>;
}
