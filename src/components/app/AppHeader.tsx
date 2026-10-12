import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Shield } from "lucide-react";
import { Logo } from "@/components/site/Brand";
import { AnnouncementBar } from "@/components/site/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/auth";
import { CoinChip } from "@/components/app/Coins";

export function AppHeader() {
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const nav = useNavigate();
  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4">
          <Logo />
          <div className="flex items-center gap-1">
            <CoinChip />
            {isAdmin && (
              <Link to="/admin" className="flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-sm text-muted-foreground hover:bg-accent">
                <Shield className="size-4" /> <span className="hidden sm:inline">অ্যাডমিন</span>
              </Link>
            )}
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                nav({ to: "/" });
              }}
              className="flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-sm text-muted-foreground hover:bg-accent"
            >
              <LogOut className="size-4" /> <span className="hidden sm:inline">লগআউট</span>
            </button>
          </div>
        </div>
      </header>
    </>
  );
}

export function SitePreviewThumb({ html }: { html: string }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-background/60">
      {html ? (
        <iframe
          title="প্রিভিউ"
          srcDoc={html}
          sandbox=""
          tabIndex={-1}
          className="pointer-events-none absolute left-0 top-0 h-[400%] w-[400%] origin-top-left scale-25 border-0 bg-white"
        />
      ) : (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">এখনো খালি</div>
      )}
    </div>
  );
}
