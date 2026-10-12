import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bnDate, useSession } from "@/lib/auth";

export function BotList({ onNew }: { onNew: () => void }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const { data: bots, isLoading } = useQuery({
    queryKey: ["bots", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("bots").select("id, name, files, updated_at").eq("user_id", user!.id).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });
  const remove = async (id: string) => {
    if (!confirm("বটটি ডিলিট করবেন?")) return;
    const { error } = await supabase.from("bots").delete().eq("id", id);
    if (error) return toast.error("ডিলিট করা যায়নি");
    qc.invalidateQueries({ queryKey: ["bots"] });
  };
  if (isLoading) return <div className="mt-6 grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <div key={i} className="glass h-20 animate-pulse rounded-2xl" />)}</div>;
  if (!bots?.length)
    return (
      <div className="glass mt-6 flex flex-col items-center rounded-2xl px-6 py-14 text-center">
        <div className="grid size-20 place-items-center rounded-3xl bg-brand shadow-glow"><Bot className="size-10" /></div>
        <h2 className="mt-6 text-xl font-semibold">এখনো কোনো বট নেই</h2>
        <p className="mt-1 text-muted-foreground">বাংলায় লিখুন কেমন বট চান — AI পুরো Python কোড বানিয়ে দেবে।</p>
        <button onClick={onNew} className="mt-6 min-h-12 rounded-xl bg-brand px-6 font-semibold">প্রথম বট বানান</button>
      </div>
    );
  return (
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {bots.map((b: any) => (
        <div key={b.id} className="glass flex items-center gap-3 rounded-2xl p-4 hover:border-cyan">
          <Link to="/bot/$botId" params={{ botId: b.id }} className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand"><Bot className="size-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{b.name}</p>
              <p className="truncate text-xs text-muted-foreground">Python · {(b.files ?? []).length ? "কোড তৈরি" : "খসড়া"} · {bnDate(b.updated_at)}</p>
            </div>
          </Link>
          <button onClick={() => remove(b.id)} aria-label="ডিলিট" className="grid size-10 place-items-center rounded-lg text-destructive hover:bg-destructive/10"><Trash2 className="size-4" /></button>
        </div>
      ))}
    </div>
  );
}
