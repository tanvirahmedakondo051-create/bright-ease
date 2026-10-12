import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inputCls } from "@/components/admin/fields";
import { emojiKey, parseEmojiList } from "@/lib/emoji-bulk";

type Row = { key: string; id: string; fallback: string; style: ""; kind: "text" };

/** Paste "❤️‍🔥 - 6314409378971657327" lines → merged into the premium emoji library. */
export function BulkEmojiPaste({ onAdd }: { onAdd: (rows: Row[]) => void }) {
  const [text, setText] = useState("");
  const add = () => {
    const { items, invalid } = parseEmojiList(text);
    if (!items.length) return toast.error(invalid ? `${invalid}টা লাইন ঠিক নয় — ফরম্যাট: ❤️‍🔥 - 6314409378971657327` : "লিস্ট খালি");
    onAdd(items.map((i) => ({ key: emojiKey(i.emoji), id: i.id, fallback: i.emoji, style: "", kind: "text" })));
    toast.success(`${items.length}টা যোগ/আপডেট হয়েছে${invalid ? ` · ${invalid}টা লাইন বাদ` : ""}`);
    setText("");
  };
  return (
    <div className="mb-5 space-y-2 rounded-xl border border-border p-3">
      <p className="text-sm font-medium">Premium emoji list পেস্ট করুন</p>
      <p className="text-xs text-muted-foreground">প্রতি লাইনে একটা: <span className="font-en">❤️‍🔥 - 6314409378971657327</span>. একই emoji দুবার থাকলে শেষের ID থাকবে।</p>
      <textarea aria-label="Premium emoji list" className={`${inputCls} min-h-40 font-en`} value={text} onChange={(e) => setText(e.target.value)} placeholder={"❤️‍🔥 - 6314409378971657327\n👀 - 6314425974725288033"} />
      <Button type="button" onClick={add} disabled={!text.trim()}>সেভ করুন</Button>
    </div>
  );
}
