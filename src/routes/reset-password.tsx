import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo, Orbs } from "@/components/site/Brand";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "নতুন পাসওয়ার্ড — Hexa AI" },
      { name: "description", content: "Hexa AI অ্যাকাউন্টের নতুন পাসওয়ার্ড সেট করুন।" },
      { property: "og:title", content: "নতুন পাসওয়ার্ড — Hexa AI" },
      { property: "og:description", content: "পাসওয়ার্ড রিসেট করুন।" },
    ],
  }),
  component: Reset,
});

function Reset() {
  const nav = useNavigate();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error("পাসওয়ার্ড বদলানো যায়নি। লিংকটি আবার চেয়ে নিন।");
    toast.success("পাসওয়ার্ড বদলানো হয়েছে");
    nav({ to: "/dashboard" });
  };
  return (
    <div className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <Orbs />
      <form onSubmit={submit} className="glass w-full max-w-md space-y-4 rounded-2xl p-6 sm:p-8">
        <Logo className="justify-center" />
        <h1 className="text-center text-2xl font-bold">নতুন পাসওয়ার্ড দিন</h1>
        <div className="space-y-2"><Label>নতুন পাসওয়ার্ড</Label><Input className="h-12" type="password" minLength={6} value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
        <button disabled={busy} className="min-h-12 w-full rounded-xl bg-brand font-semibold disabled:opacity-60">{busy ? "অপেক্ষা করুন..." : "পাসওয়ার্ড সেভ করুন"}</button>
      </form>
    </div>
  );
}
