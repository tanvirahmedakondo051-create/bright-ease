import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  return { session, user: session?.user ?? null, loading };
}

export function useIsAdmin(userId?: string | null) {
  return useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: userId!, _role: "admin" });
      return !!data;
    },
  });
}

export function useProfile(userId?: string | null) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*, plans(*)")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function dhakaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

/** Tokens used today, treating a stale reset date as zero. */
export function tokensToday(p?: { tokens_used_today: number; last_reset_date: string } | null) {
  if (!p) return 0;
  return p.last_reset_date < dhakaToday() ? 0 : p.tokens_used_today;
}

const bnDigits = "০১২৩৪৫৬৭৮৯";
export function bn(n: number | string) {
  const s = typeof n === "number" ? n.toLocaleString("en-IN") : n;
  return s.replace(/\d/g, (d) => bnDigits[Number(d)]);
}

export function bnDate(d: string | Date) {
  return new Date(d).toLocaleDateString("bn-BD", { day: "numeric", month: "short", year: "numeric" });
}
