import type { ReactNode } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function PageTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon }: { label: string; value: ReactNode; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4 text-cyan" /> {label}</div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

export function Panel({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="glass rounded-2xl p-5">
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Confirm({ open, title, desc, onCancel, onConfirm, label = "হ্যাঁ, নিশ্চিত" }: { open: boolean; title: string; desc?: string; onCancel: () => void; onConfirm: () => void; label?: string }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {desc && <AlertDialogDescription>{desc}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="min-h-12">বাতিল</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} className="min-h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90">{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const btn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-semibold";

export function lastNDays(n: number) {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d));
  }
  return days;
}
export const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date(iso));
export const shortBn = (d: string) => new Date(d).toLocaleDateString("bn-BD", { day: "numeric", month: "short" });

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" }));
  a.download = name;
  a.click();
}
