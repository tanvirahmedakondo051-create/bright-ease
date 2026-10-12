import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Trash2 } from "lucide-react";
import { adminDeleteBrain, adminListBotBrain } from "@/lib/admin.functions";
import { PageTitle } from "@/components/admin/ui";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/admin/brain")({
  head: () => ({ meta: [{ title: "Bot Brain — Hexa AI" }, { name: "robots", content: "noindex" }] }),
  component: Brain,
});

function Brain() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"fix" | "pattern">("fix");
  const del = useServerFn(adminDeleteBrain);
  const qc = useQueryClient();
  const listBrain = useServerFn(adminListBotBrain);
  const { data = [] } = useQuery({
    queryKey: ["admin-bot-brain"],
    queryFn: () => listBrain(),
  });
  const rows = useMemo(() => data.filter((row: any) => (tab === "pattern") === (row.kind === "pattern")).filter((row) => `${row.error_signature} ${row.symptom} ${row.fix_summary}`.toLowerCase().includes(query.toLowerCase())), [data, query, tab]);
  return (
    <div className="space-y-4">
      <PageTitle title="Bot Brain" />
      <div className="flex gap-2">{(["fix", "pattern"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === t ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{t === "fix" ? "Fix lessons" : "Patterns"}</button>)}</div>
      <div className="relative max-w-xl"><Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-12 pl-9" placeholder="Error, symptom বা fix খুঁজুন" /></div>
      <div className="space-y-3">
        {rows.map((row) => <article key={row.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-primary/15 px-2 py-0.5 text-primary">{row.source}</span><span>ব্যবহার {row.use_count} বার</span>{(row as any).bot_type && <span>{(row as any).bot_type} · quality {(row as any).quality ?? "-"}</span>}<span className="ml-auto">{new Date(row.created_at).toLocaleString("bn-BD")}</span><button aria-label="মুছুন" onClick={async () => { await del({ data: { id: row.id } }); qc.invalidateQueries({ queryKey: ["admin-bot-brain"] }); }}><Trash2 className="size-4" /></button></div>
          <h2 className="mt-2 font-en text-sm font-semibold">{row.error_signature || "General fix"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{row.symptom}</p>
          <p className="mt-2 text-sm">{row.fix_summary}</p>
          {row.code_snippet && <pre className="mt-3 overflow-auto rounded-lg bg-background p-3 font-en text-xs">{row.code_snippet}</pre>}
        </article>)}
        {!rows.length && <p className="py-12 text-center text-sm text-muted-foreground">কোনো Brain entry পাওয়া যায়নি</p>}
      </div>
    </div>
  );
}