import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/admin/fields";
import { extractPremiumEmojis, type FoundEmoji } from "@/lib/emoji-extract";

export function ImportEmojis({ rows, onAdd }: { rows: FoundEmoji[]; onAdd: (r: FoundEmoji[]) => void }) {
  const [text, setText] = useState("");
  const [found, setFound] = useState<(FoundEmoji & { pick: boolean })[]>([]);
  function scan(src: string) {
    const ids = new Set(rows.map((r) => r.id)); const keys = new Set(rows.map((r) => r.key));
    const list = extractPremiumEmojis(src).filter((e) => !ids.has(e.id)).map((e) => ({ ...e, key: keys.has(e.key) ? `${e.key}_new` : e.key, pick: true }));
    setFound(list);
    if (list.length) toast.success(`${list.length}টি নতুন premium emoji ID পাওয়া গেছে`); else toast.error("নতুন কোনো premium emoji ID পাওয়া যায়নি");
  }
  return (
    <div className="mb-5 space-y-2 rounded-xl border border-border p-3">
      <p className="text-sm font-medium">ফাইল থেকে ইমপোর্ট (.py / .txt / .json) বা কোড পেস্ট করুন</p>
      <input type="file" accept=".py,.txt,.json,.md" aria-label="Emoji file" className="text-sm" onChange={async (e) => { const f = e.target.files?.[0]; if (f) scan(await f.text()); e.target.value = ""; }} />
      <textarea aria-label="Paste code" className={`${inputCls} min-h-24 font-en`} value={text} onChange={(e) => setText(e.target.value)} placeholder="bot.py কোড এখানে পেস্ট করুন…" />
      <Button type="button" variant="outline" onClick={() => scan(text)} disabled={!text.trim()}>ID খুঁজুন</Button>
      {found.length > 0 && <div className="space-y-1">
        {found.map((f, i) => <label key={f.id} className="flex items-center gap-2 font-en text-sm"><input type="checkbox" checked={f.pick} onChange={() => setFound(found.map((x, j) => j === i ? { ...x, pick: !x.pick } : x))} /><input className={`${inputCls} h-9`} value={f.key} onChange={(e) => setFound(found.map((x, j) => j === i ? { ...x, key: e.target.value.toLowerCase() } : x))} /><span className="shrink-0">{f.id}</span></label>)}
        <Button type="button" onClick={() => { onAdd(found.filter((f) => f.pick).map(({ pick: _p, ...r }) => ({ ...r, kind: r.key.startsWith("text.") ? "text" : "button" }))); setFound([]); setText(""); }}>লাইব্রেরিতে যোগ করুন</Button>
      </div>}
    </div>
  );
}
