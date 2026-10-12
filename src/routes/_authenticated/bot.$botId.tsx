import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { normalizeFiles } from "@/lib/bot.functions";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ArrowUp, Bot, FileCode2, FolderOpen, Hammer, Image as ImageIcon, Loader2, Paperclip, Pencil, RefreshCw, Settings, Sparkles, Wrench, X } from "lucide-react";
import { readAttachments, type Attachment } from "@/lib/attachments";
import { zipSync, strToU8 } from "fflate";
import { supabase } from "@/integrations/supabase/client";
import { botStatus, createBot, listVersions, renameBot, restoreVersion, saveBotSecrets, startBotBuild, startTempHost, stopTempHost } from "@/lib/bot.functions";
import { activeBotJob, botJobStatus, cancelBotBuild } from "@/lib/jobs.functions";
import { RichText } from "@/components/app/ChatParts";
import { BotQuestionDialog, type BotQuestion, type BotQuestionAnswer } from "@/components/app/BotQuestionDialog";
import { BuildProgress, FilesPanel, HostActions, PlanCard, ProjectsPanel, RenameInline, SecretsDialog, StatusChip, fmtClock, useNow, type BotFile, type HostStatus } from "@/components/studio/StudioParts";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useSiteSettings } from "@/lib/site";

export const Route = createFileRoute("/_authenticated/bot/$botId")({
  head: () => ({ meta: [
    { title: "বট স্টুডিও — Hexa AI" },
    { name: "description", content: "বাংলায় লিখুন, AI Python টেলিগ্রাম বট বানাবে — প্ল্যান, বিল্ড, টেস্ট, ZIP ডাউনলোড।" },
    { property: "og:title", content: "বট স্টুডিও — Hexa AI" },
    { property: "og:description", content: "বাংলায় লিখুন, AI Python টেলিগ্রাম বট বানাবে — প্ল্যান, বিল্ড, টেস্ট, ZIP ডাউনলোড।" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Studio,
});

const EXAMPLES = ["অর্ডার নেওয়ার শপ বট", "কুইজ ও লিডারবোর্ড বট", "ফোর্স জয়েন + রেফারেল বট", "সাপোর্ট টিকিট বট"];

function Studio() {
  const { botId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const statusFn = useServerFn(botStatus);
  const startBuildFn = useServerFn(startBotBuild);
  const jobStatusFn = useServerFn(botJobStatus);
  const activeJobFn = useServerFn(activeBotJob);
  const cancelBuildFn = useServerFn(cancelBotBuild);
  const saveSecrets = useServerFn(saveBotSecrets);
  const startFn = useServerFn(startTempHost);
  const stopFn = useServerFn(stopTempHost);
  const renameFn = useServerFn(renameBot);
  const versionsFn = useServerFn(listVersions);
  const restoreFn = useServerFn(restoreVersion);
  const createFn = useServerFn(createBot);

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsBusy, setAttachmentsBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"chat" | "plan" | "build">("chat");
  const [busy, setBusy] = useState<null | { mode: "chat" | "plan" | "build"; at: number }>(null);
  const [fixOffer, setFixOffer] = useState<null | { brief: string; log: string }>(null);
  const [questions, setQuestions] = useState<BotQuestion[] | null>(null);
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionMode, setQuestionMode] = useState<"chat" | "plan" | "build">("plan");
  const [secretsOpen, setSecretsOpen] = useState(false);
  const [pending, setPending] = useState<null | (() => void)>(null);
  const [starting, setStarting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<null | "projects" | "files" | "versions" | "log">(null);
  const runId = useRef(0);
  const jobRef = useRef<string | null>(null);
  const [jobStep, setJobStep] = useState("");
  const [subtasks, setSubtasks] = useState<{ key: string; title: string; status: string; lines: number }[]>([]);
  const retryRef = useRef<null | (() => void)>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const now = useNow(!!busy);
  const { data: siteSettings } = useSiteSettings();

  const { data: bot } = useQuery({
    queryKey: ["bot", botId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bots").select("id, name, files, messages, last_build_at").eq("id", botId).single();
      if (error) throw error;
      return data as any;
    },
  });
  const { data: st, refetch: refetchStatus } = useQuery({
    queryKey: ["bot-status", botId],
    queryFn: () => statusFn({ data: { botId } }) as Promise<HostStatus>,
    refetchInterval: (q) => (q.state.data?.status === "running" ? 10_000 : false),
  });
  const { data: versions, refetch: refetchVersions } = useQuery({ queryKey: ["bot-versions", botId], queryFn: () => versionsFn({ data: { botId } }), enabled: drawer === "versions" });

  const refresh = () => qc.invalidateQueries({ queryKey: ["bot", botId] });
  const messages: any[] = bot?.messages ?? [];
  const files: BotFile[] = normalizeFiles(bot?.files ?? []);
  const hasSecrets = !!(st?.hasToken && st?.hasAdmin);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, busy]);

  const needSecrets = (then: () => void) => { setPending(() => then); setSecretsOpen(true); };

  // Builds run as server-side background jobs: the phone only watches progress, so turning
  // the screen off or switching apps never stops a build. Poll the job until it finishes.
  const watchJob = async (jobId: string, id: number) => {
    jobRef.current = jobId;
    let seen = 0;
    const startedAt = Date.now();
    while (id === runId.current) {
      await new Promise((r) => setTimeout(r, 3000));
      let j: any;
      try { j = await jobStatusFn({ data: { jobId, after: seen } }); } catch { setJobStep("সংযোগ ফিরছে…"); continue; }
      if (id !== runId.current) return;
      seen = j.total ?? seen;
      const lastEvent = j.events?.[j.events.length - 1];
      if (lastEvent?.step) setJobStep(lastEvent.step);
      setSubtasks(j.subtasks ?? []);
      if (j.status === "done") {
        if (j.result?.imageNotice) toast.info(j.result.imageNotice);
        if (j.result?.questions?.length) {
          setQuestionPrompt(j.result.prompt || "সংযুক্ত ছবির emoji অনুযায়ী কাজ করুন");
          setQuestionMode(j.result.mode ?? "build");
          setQuestions(j.result.questions);
        }
        await refresh();
        if (j.result?.needsBuildFix) setFixOffer({ brief: j.result.fixBrief || "", log: j.result.prompt || "" });
        return;
      }
      if (j.status === "failed") { setRequestError(j.error || "বিল্ড ব্যর্থ হয়েছে"); toast.error(j.error || "বিল্ড ব্যর্থ হয়েছে"); return; }
      if (j.status === "cancelled" || j.status === "missing") return;
      if (Date.now() - startedAt > 20 * 60_000) { setRequestError("বিল্ড অনেকক্ষণ ধরে চলছে — একটু পরে পেজ রিফ্রেশ করে দেখুন।"); return; }
    }
  };

  // Reopening the studio while a build is running resumes the progress view.
  useEffect(() => {
    (async () => {
      const j = await activeJobFn({ data: { botId } }).catch(() => null);
      if (j?.id && !runId.current) {
        const id = ++runId.current;
        setBusy({ mode: "build", at: new Date(j.createdAt ?? Date.now()).getTime() });
        await watchJob(j.id, id);
        if (id === runId.current) { setBusy(null); setJobStep(""); jobRef.current = null; }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const send = async (text: string, selectedMode = mode, answers?: BotQuestionAnswer[], att: Attachment[] = attachments) => {
    if (!text.trim() || busy) return;
    if (selectedMode === "build" && !hasSecrets) return needSecrets(() => send(text, "build", answers, att));
    const id = ++runId.current;
    setMode(selectedMode);
    setRequestError(null);
    setJobStep("");
    setSubtasks([]);
    retryRef.current = () => send(text, selectedMode, answers, att);
    setBusy({ mode: selectedMode, at: Date.now() });
    setInput("");
    setAttachments([]);
    const extra = att.length ? { attachments: att } : {};
    try {
      {
        // Every mode runs as a background job; the phone only watches it, so a dropped
        // connection or locked screen never loses the answer.
        const r: any = await startBuildFn({ data: { botId, prompt: text, mode: selectedMode, questionAnswers: answers, ...extra } });
        if (id !== runId.current) return;
        if (r?.error === "NEED_SECRETS") { needSecrets(() => send(text, "build", answers)); return; }
        if (r?.error === "COINS_OUT") { toast.error("কয়েন শেষ! কাল আবার পাবেন বা আপগ্রেড করুন"); return; }
        if (r?.error) { setRequestError(r.error); toast.error(r.error); return; }
        if (r?.jobId) await watchJob(r.jobId, id);
      }
    } catch (error) {
      if (id === runId.current) {
        const raw = error instanceof Error ? error.message : "";
        const message = !raw || /failed to fetch|network|load failed|fetch/i.test(raw) ? "সংযোগ বিচ্ছিন্ন হয়েছে — ইন্টারনেট চেক করে আবার চেষ্টা করুন। কোনো ফাইল বা কয়েন বদলায়নি।" : raw;
        setRequestError(message);
        toast.error(message);
      }
    } finally {
      if (id === runId.current) { setBusy(null); setJobStep(""); jobRef.current = null; setTimeout(() => inputRef.current?.focus(), 50); }
    }
  };
  const stop = async () => {
    const jobId = jobRef.current;
    runId.current++;
    setBusy(null);
    setJobStep("");
    jobRef.current = null;
    if (jobId) await cancelBuildFn({ data: { jobId } }).catch(() => {});
    toast("জেনারেশন বন্ধ করা হয়েছে");
  };

  const download = async () => {
    if (!files.length) return;
    const { data: profile } = await supabase.from("profiles").select("plans(zip_download_allowed)").single();
    if ((profile?.plans as any)?.zip_download_allowed === false) return toast.error("আপনার প্ল্যানে ZIP download চালু নেই");
    const zip = zipSync(Object.fromEntries(files.map((f) => [f.path, strToU8(f.content)])));
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(bot?.name || "telegram-bot").replace(/[^\w\u0980-\u09FF-]+/g, "-")}.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const startTest = async () => {
    if (!hasSecrets) return needSecrets(startTest);
    setStarting(true);
    try {
      const r: any = await startFn({ data: { botId } });
      if (r.error === "NEED_SECRETS") needSecrets(startTest);
      else if (r.error) toast.error(r.error);
      else toast.success("বট ৫ মিনিটের জন্য অনলাইন");
    } finally { setStarting(false); refetchStatus(); }
  };
  const stopTest = async () => { await stopFn({ data: { botId } }); refetchStatus(); };

  const onSaveSecrets = async (token: string, adminId: string) => {
    const r: any = await saveSecrets({ data: { botId, token, adminId } });
    if (r.error) { toast.error(r.error); return false; }
    toast.success(r.username ? `@${r.username} যুক্ত হয়েছে` : "সেভ হয়েছে");
    await refetchStatus();
    setSecretsOpen(false);
    const next = pending; setPending(null);
    setTimeout(() => next?.(), 50);
    return true;
  };

  const newBot = async () => { const r = await createFn({ data: {} }); qc.invalidateQueries({ queryKey: ["bots"] }); setDrawer(null); navigate({ to: "/bot/$botId", params: { botId: r.id } }); };
  const lastBuildIdx = messages.reduce((acc, m, i) => (m.role === "assistant" && (m.mode === "build" || m.mode === "fix") ? i : acc), -1);
  const isFixNext = files.some((f) => f.path === "app.py");

  const filesPanel = <FilesPanel files={files} lastBuild={bot?.last_build_at} onZip={download} onVersions={() => setDrawer("versions")} />;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-2 sm:px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawer("projects")} aria-label="প্রজেক্ট"><FolderOpen /></Button>
        <Link to="/dashboard" className="hidden items-center gap-2 lg:flex"><span className="grid size-8 place-items-center rounded-lg bg-primary"><Bot className="size-4 text-primary-foreground" /></span><span className="font-display font-bold">Hexa</span></Link>
        <span className="mx-1 hidden h-5 w-px bg-border lg:block" />
        <div className="min-w-0 flex-1"><RenameInline name={bot?.name ?? "বট"} onSave={async (name) => { await renameFn({ data: { botId, name } }); refresh(); qc.invalidateQueries({ queryKey: ["bots"] }); }} /></div>
        {busy && <span className="font-en text-xs tabular-nums text-primary">⏱ {fmtClock(now - busy.at)}</span>}
        <div className="flex shrink-0 rounded-xl border border-border p-0.5">
          {(["chat", "plan", "build"] as const).map((m) => <button key={m} onClick={() => setMode(m)} className={`rounded-lg px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{m === "chat" ? "Chat" : m === "plan" ? "Plan" : "Build"}</button>)}
        </div>
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setDrawer("files")} aria-label="ফাইল"><FileCode2 /></Button>
        <Button variant="ghost" size="icon" onClick={() => setSecretsOpen(true)} aria-label="সেটিংস"><Settings /></Button>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_1fr_420px]">
        <aside className="hidden min-h-0 border-r border-border bg-sidebar lg:block"><ProjectsPanel currentId={botId} onNew={newBot} /></aside>

        {/* Chat */}
        <section className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-2xl space-y-4 p-4">
              {!messages.length && (
                <div className="pt-12 text-center">
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary shadow-glow"><Sparkles className="size-7 text-primary-foreground" /></span>
                  <h2 className="mt-5 font-display text-2xl font-bold">কেমন বট বানাবেন?</h2>
                  {mode === "chat" && <p className="mt-2 text-sm text-success">লগ বা স্ক্রিনশট দিন — Chat মোড ফ্রি, এখানে কোড বদলাবে না</p>}
                  <p className="mt-1 text-sm text-muted-foreground">বট কী করবে বাংলায় লিখুন — আগে প্ল্যান, তারপর অনুমোদন করে বিল্ড।</p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    {EXAMPLES.map((s) => <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }} className="rounded-full border border-border bg-card px-3.5 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">{s}</button>)}
                  </div>
                </div>
              )}
              {messages.map((m, i) => {
                if (m.role === "user") return <div key={i} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5 text-sm">{m.mode === "fix" && <span className="mb-1 block text-[11px] font-medium text-success">Upgrade — পুরনো ফিচার রক্ষা করে</span>}{m.content}</div></div>;
                const last = i === messages.length - 1 && !busy;
                const usage = (m.coins || m.ms) ? <p className="mt-2 font-en text-[11px] text-muted-foreground">{m.ms ? `⏱ ${fmtClock(m.ms)}` : ""}{m.coins ? ` · ${m.coins} coin` : ""}</p> : null;
                if (m.mode === "chat") return (
                  <div key={i} className="rounded-2xl border border-border bg-card p-4 text-sm">
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold">Chat · Error Debug · ফ্রি</span>
                    <RichText text={m.content} />
                    {usage}
                  </div>
                );
                if (m.mode === "plan") return (
                  <div key={i}>
                    <PlanCard plan={m.plan} fallback={m.content} actions={last ? <>
                      <Button onClick={() => {
                        setMode("build");
                        const approved = m.plan ? JSON.stringify(m.plan) : m.content;
                        send(`এই অনুমোদিত প্ল্যান অনুযায়ী সরাসরি বটের ফাইল তৈরি করো। আবার প্ল্যান লিখবে না।\n\nAPPROVED PLAN:\n${approved}`, "build");
                      }} className="rounded-xl"><Hammer />অনুমোদন করুন</Button>
                      <Button variant="outline" onClick={() => { setMode("plan"); setInput("প্ল্যানে পরিবর্তন: "); inputRef.current?.focus(); }} className="rounded-xl"><Pencil />প্ল্যান এডিট</Button>
                    </> : undefined} />
                    {usage}
                  </div>
                );
                return (
                  <div key={i} className="rounded-2xl border border-border bg-card p-4 text-sm">
                    <span className="mb-2 inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success"><Wrench className="size-3" />{m.mode === "fix" ? "Scoped fix" : "বিল্ড সম্পন্ন"}</span>
                    <RichText text={m.content} />
                    {i === lastBuildIdx && files.length > 0 && <div className="mt-4"><HostActions st={st} starting={starting} onZip={download} onTest={startTest} onStop={stopTest} hostUrl={(siteSettings as any)?.hexahoster_url} /></div>}
                    {i === lastBuildIdx && st?.log && <button onClick={() => setDrawer("log")} className="mt-2 text-xs text-muted-foreground underline">টেস্ট লগ দেখুন</button>}
                    {usage}
                  </div>
                );
              })}
              {busy && <BuildProgress elapsed={now - busy.at} mode={busy.mode === "build" ? "build" : "plan"} step={jobStep} onStop={stop} />}
              {busy?.mode === "build" && subtasks.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-3 text-xs">
                  <p className="mb-2 font-semibold">সাব-এজেন্ট টাস্ক</p>
                  <ul className="space-y-1.5">
                    {subtasks.map((t) => (
                      <li key={t.key} className="flex items-center justify-between gap-2">
                        <span className="truncate">{t.title}</span>
                        <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                          {t.lines > 0 && <span className="font-en">{t.lines} লাইন</span>}
                          <span className={`rounded-full px-2 py-0.5 font-medium ${t.status === "done" ? "bg-success/15 text-success" : t.status === "failed" ? "bg-destructive/15 text-destructive" : t.status === "running" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{t.status === "done" ? "done" : t.status === "failed" ? "failed" : t.status === "running" ? "running" : t.status}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {busy?.mode === "build" && <p className="text-center text-xs text-muted-foreground">বিল্ড সার্ভারে চলছে — স্ক্রিন বন্ধ বা অ্যাপ বদলালেও থামবে না</p>}
              {!busy && requestError && (
                <div role="alert" className="rounded-2xl border border-destructive/35 bg-destructive/10 p-4">
                  <div className="flex gap-3"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" /><div><p className="text-sm font-semibold">জেনারেশন সম্পূর্ণ হয়নি</p><p className="mt-1 text-sm text-muted-foreground">{requestError}</p></div></div>
                  <Button variant="outline" size="sm" className="mt-3 rounded-lg" onClick={() => retryRef.current?.()}><RefreshCw />আবার চেষ্টা করুন</Button>
                </div>
              )}
              <div ref={endRef} />
            </div>
          </div>
          <div className="border-t border-border p-3">
            <div className="mx-auto max-w-2xl">
              <div className="mb-2 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{mode === "chat" ? "Chat মোড — ফ্রি, কোড বদলাবে না" : mode === "plan" ? "প্ল্যান মোড — কোড লিখবে না" : isFixNext ? "" : "বিল্ড শুরু — কোড লিখবে"}</span>
                {mode === "build" && isFixNext && <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">Upgrade — পুরনো ফিচার রক্ষা করে</span>}
                <span className="ml-auto"><StatusChip st={st} starting={starting} /></span>
              </div>
              {!!attachments.length && <div className="mb-2 flex flex-wrap gap-1.5">{attachments.map((a, i) => <span key={i} className="flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 text-xs">{a.kind === "image" ? <ImageIcon className="size-3" /> : <FileCode2 className="size-3" />}<span className="max-w-[140px] truncate">{a.name}</span><button aria-label="সরান" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}><X className="size-3" /></button></span>)}</div>}
              <input ref={fileRef} type="file" multiple hidden accept=".py,.txt,.json,.md,image/png,image/jpeg,image/webp" onChange={async (e) => {
                const picked = Array.from(e.currentTarget.files ?? []);
                e.currentTarget.value = "";
                if (!picked.length) return;
                setAttachmentsBusy(true);
                try {
                  const current = attachments;
                  const added = await readAttachments(picked, current);
                  setAttachments((latest) => [...latest, ...added]);
                  if (added.length) toast.success(`${added.length}টি ফাইল/ছবি যোগ হয়েছে`);
                } finally { setAttachmentsBusy(false); }
              }} />
              <div className="flex items-end gap-2 rounded-2xl border border-input bg-card p-2 focus-within:border-primary">
                <Button variant="ghost" size="icon" className="size-10 shrink-0 rounded-xl" aria-label="ফাইল বা ছবি যোগ করুন" disabled={!!busy || attachmentsBusy} onClick={() => fileRef.current?.click()}>{attachmentsBusy ? <Loader2 className="animate-spin" /> : <Paperclip />}</Button>
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }} rows={2} placeholder={mode === "chat" ? "লগ বা স্ক্রিনশট দিন — Chat মোড ফ্রি" : "বট কী করবে বাংলায় লিখুন…"} className="min-h-12 flex-1 resize-none bg-transparent p-2 text-sm outline-none" />
                <Button disabled={!!busy || attachmentsBusy || (!input.trim() && !attachments.length)} onClick={() => send(input || "সংযুক্ত ফাইল/ছবি দেখে কাজ করুন")} size="icon" className="size-10 rounded-xl" aria-label="পাঠান"><ArrowUp /></Button>
              </div>
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 border-l border-border lg:block">{filesPanel}</aside>
      </main>

      <Dialog open={!!fixOffer} onOpenChange={(o) => !o && setFixOffer(null)}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">কোড ফিক্স করতে Build মোডে যেতে হবে</DialogTitle>
            <DialogDescription>Chat মোড ফ্রি। ফিক্স করলে Build মোড চালু হবে এবং কয়েন কাটতে পারে।</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1 rounded-xl" onClick={() => { const f = fixOffer; setFixOffer(null); if (f) send(`Scoped fix only — keep every existing feature.\n${f.brief}\n\nOriginal error / log:\n${f.log}`.slice(0, 6000), "build", undefined, []); }}><Wrench />অনুমতি দিয়ে Build-এ ফিক্স করুন</Button>
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setFixOffer(null)}>বাতিল</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={drawer === "projects"} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent side="left" className="w-72 p-0"><SheetHeader className="sr-only"><SheetTitle>প্রজেক্ট</SheetTitle></SheetHeader><ProjectsPanel currentId={botId} onNew={newBot} /></SheetContent>
      </Sheet>
      <Sheet open={drawer === "files"} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent side="right" className="w-full p-0 pt-10 sm:max-w-lg"><SheetHeader className="sr-only"><SheetTitle>ফাইল</SheetTitle></SheetHeader>{filesPanel}</SheetContent>
      </Sheet>
      <Sheet open={drawer === "versions"} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader><SheetTitle className="font-display">ভার্সন হিস্টোরি</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-2 overflow-y-auto">
            {!versions?.length && <p className="text-sm text-muted-foreground">এখনো কোনো বিল্ড নেই</p>}
            {versions?.map((v: any, k: number) => (
              <div key={v.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                <p className="line-clamp-2">{v.note || "বিল্ড"}</p>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><span>{new Date(v.created_at).toLocaleString("bn-BD")}</span>{k === 0 ? <span className="ml-auto text-success">বর্তমান</span> : <Button size="sm" variant="outline" className="ml-auto h-7 rounded-lg" onClick={async () => { await restoreFn({ data: { botId, versionId: v.id } }); await refresh(); refetchVersions(); toast.success("ভার্সন রিস্টোর হয়েছে"); }}>রিস্টোর</Button>}</div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
      <Sheet open={drawer === "log"} onOpenChange={(o) => !o && setDrawer(null)}>
        <SheetContent side="bottom" className="max-h-[70dvh]">
          <SheetHeader><SheetTitle className="font-display">টেস্ট লগ</SheetTitle></SheetHeader>
          <pre className="mt-3 max-h-[50dvh] overflow-auto rounded-xl bg-card p-3 font-en text-xs">{st?.log || "কোনো লগ নেই"}</pre>
          {st?.log && /Traceback|Error/.test(st.log) && <Button className="mt-3 rounded-xl" onClick={() => { setDrawer(null); setMode("build"); send("টেস্ট লগের এই error টা ঠিক করো:\n" + st.log.slice(-1500), "build"); }}><Wrench />এই error ঠিক করুন</Button>}
        </SheetContent>
      </Sheet>

      <SecretsDialog open={secretsOpen} hasToken={!!st?.hasToken} onClose={() => { setSecretsOpen(false); setPending(null); }} onSave={onSaveSecrets} />
      <BotQuestionDialog questions={questions} onCancel={() => setQuestions(null)} onDone={(a) => { const p = questionPrompt; const m = questionMode; setQuestions(null); send(p, m, a); }} />
    </div>
  );
}
