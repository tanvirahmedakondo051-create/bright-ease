import type { ReactNode } from "react";

export const inputCls = "min-h-11 w-full rounded-xl border border-input bg-background/50 px-3 text-sm outline-none focus:border-primary";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-border px-3">
      <span className="text-sm">{label}</span>
      <input type="checkbox" className="size-5 accent-[var(--color-primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
