import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePlans } from "@/lib/site";
import { bn } from "@/lib/auth";
import { PageTitle, Confirm, btn } from "@/components/admin/ui";

export const Route = createFileRoute("/_authenticated/admin/plans/")({
  head: () => ({ meta: [{ title: "প্ল্যান — অ্যাডমিন" }] }),
  component: Plans,
});

function Plans() {
  const { data } = usePlans();
  const qc = useQueryClient();
  const [delId, setDelId] = useState<string | null>(null);
  return (
    <div>
      <PageTitle title="প্ল্যান">
        <Link to="/admin/plans/$id" params={{ id: "new" }} className={`${btn} bg-brand`}><Plus className="size-4" /> নতুন প্ল্যান</Link>
      </PageTitle>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((p: any) => (
          <div key={p.id} className="glass rounded-2xl p-5">
            <div className="flex items-center gap-2"><h3 className="text-lg font-semibold">{p.name_bn}</h3>{p.is_default && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs text-cyan">ডিফল্ট</span>}</div>
            <p className="mt-1 text-2xl font-bold">৳{bn(p.price_bdt)}<span className="text-sm font-normal text-muted-foreground"> / {p.duration_days > 0 ? `${bn(p.duration_days)} দিন` : "আজীবন"}</span></p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>কয়েন: {bn((p as any).bonus_coins)} + {bn((p as any).daily_coins)}/দিন (ক্যাপ {bn((p as any).coin_cap)})</li>
              <li>বট: {(p as any).max_bot_projects < 0 ? "সীমাহীন" : bn((p as any).max_bot_projects)} · AI মেসেজ: {(p as any).daily_ai_messages < 0 ? "সীমাহীন" : `${bn((p as any).daily_ai_messages)}/দিন`}</li>
              <li>টেস্ট: {bn((p as any).temp_host_minutes_per_day)} মিনিট/দিন · ZIP: {(p as any).zip_download_allowed ? "হ্যাঁ" : "না"}</li>
            </ul>
            <div className="mt-4 flex gap-2">
              <Link to="/admin/plans/$id" params={{ id: p.id }} className={`${btn} glass`}><Pencil className="size-4" /> সেটিংস</Link>
              <button className={`${btn} text-destructive`} onClick={() => setDelId(p.id)}><Trash2 className="size-4" /> মুছুন</button>
            </div>
          </div>
        ))}
      </div>
      <Confirm open={!!delId} title="প্ল্যান মুছবেন?" desc="এই প্ল্যানে থাকা ইউজার থাকলে মুছা যাবে না।" onCancel={() => setDelId(null)} onConfirm={async () => {
        const { error } = await supabase.from("plans").delete().eq("id", delId!);
        setDelId(null);
        if (error) return toast.error("মুছা যায়নি — প্ল্যানটি ব্যবহার হচ্ছে");
        toast.success("মুছে ফেলা হয়েছে");
        qc.invalidateQueries({ queryKey: ["plans"] });
      }} />
    </div>
  );
}
