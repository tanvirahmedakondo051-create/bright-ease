import { CheckCircle2, PencilLine, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RichText } from "@/components/app/ChatParts";

/** Plan review popup (bottom sheet on mobile): approve → build, or go back to change it. */
export function PlanDialog({ plan, onClose, onApprove, onChange }: { plan: string | null; onClose: () => void; onApprove: () => void; onChange: () => void }) {
  return (
    <Dialog open={!!plan} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bottom-0 top-auto max-h-[88vh] translate-y-0 gap-0 rounded-b-none rounded-t-2xl p-0 sm:bottom-auto sm:top-1/2 sm:max-w-2xl sm:-translate-y-1/2 sm:rounded-2xl">
        <DialogHeader className="border-b border-border px-5 py-4 text-left">
          <DialogTitle>📄 ওয়েবসাইটের প্ল্যান</DialogTitle>
          <p className="text-xs text-muted-foreground">অংশ, ফিচার আর ডিজাইন দেখে নিন। পছন্দ হলে অনুমোদন করুন।</p>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto px-5 py-4 text-sm">
          {plan && <RichText text={plan.replace(/\[\[(.+?)\]\]/g, "").replace(/\n{3,}/g, "\n\n").trim()} />}
        </div>
        <div className="grid gap-2 border-t border-border p-4 sm:grid-cols-3">
          <button onClick={onApprove} className="flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-brand font-semibold text-primary-foreground sm:col-span-3">
            <CheckCircle2 className="size-4" /> অনুমোদন করুন ও বানান
          </button>
          <button onClick={onChange} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border text-sm sm:col-span-2">
            <PencilLine className="size-4" /> পরিবর্তন চাই
          </button>
          <button onClick={onClose} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm text-muted-foreground">
            <X className="size-4" /> বন্ধ করুন
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
