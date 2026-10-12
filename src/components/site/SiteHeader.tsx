import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "./Brand";
import { useSession } from "@/lib/auth";
import { CoinChip } from "@/components/app/Coins";
import { useSiteSettings } from "@/lib/site";

export function AnnouncementBar() {
  const { data: s } = useSiteSettings();
  if (!s?.announcement_active || !s.announcement_text) return null;
  return (
    <div className="px-4 py-2 text-center text-sm font-medium text-primary-foreground" style={{ background: s.announcement_color }}>
      {s.announcement_text}
    </div>
  );
}

export function SiteHeader() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const links = [
    { to: "/", hash: "features", label: "ফিচার" },
    { to: "/pricing", label: "দাম" },
  ] as const;
  return (
    <>
      <AnnouncementBar />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="hidden items-center gap-6 md:flex">
            {links.map((l) => (
              <Link key={l.label} to={l.to} hash={"hash" in l ? l.hash : undefined} className="text-sm text-muted-foreground hover:text-foreground">
                {l.label}
              </Link>
            ))}
            {user ? (
              <><CoinChip /><Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">ড্যাশবোর্ড</Link></>
            ) : (
              <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">লগইন</Link>
            )}
            <Link to={user ? "/dashboard" : "/signup"} className="inline-flex h-11 items-center rounded-xl bg-brand px-5 text-sm font-semibold text-primary-foreground shadow-glow">
              {user ? "আমার বট" : "বট বানানো শুরু করুন"}
            </Link>
          </nav>
          <button className="grid size-12 place-items-center md:hidden" onClick={() => setOpen(!open)} aria-label="মেনু">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <div className="flex flex-col gap-1 border-t border-border px-4 pb-4 md:hidden">
            {links.map((l) => (
              <Link key={l.label} to={l.to} hash={"hash" in l ? l.hash : undefined} onClick={() => setOpen(false)} className="flex min-h-12 items-center">
                {l.label}
              </Link>
            ))}
            <Link to={user ? "/dashboard" : "/login"} onClick={() => setOpen(false)} className="flex min-h-12 items-center">
              {user ? "ড্যাশবোর্ড" : "লগইন"}
            </Link>
            <Link to={user ? "/dashboard" : "/signup"} className="mt-2 flex min-h-12 items-center justify-center rounded-xl bg-brand font-semibold text-primary-foreground">
              {user ? "আমার বট" : "বট বানানো শুরু করুন"}
            </Link>
          </div>
        )}
      </header>
    </>
  );
}

export function SiteFooter() {
  const { data: s } = useSiteSettings();
  return (
    <footer className="border-t border-border/60 py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between">
        <div>
          <Logo />
          <p className="mt-2 text-sm text-muted-foreground">{s?.tagline ?? "বাংলায় বলুন, Telegram bot বানিয়ে নিন"}</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/pricing">দাম</Link>
          <Link to="/login">লগইন</Link>
          <Link to="/signup">সাইন আপ</Link>
          {s?.support_email && <a href={`mailto:${s.support_email}`}>সাপোর্ট</a>}
          {s?.telegram_link && <a href={s.telegram_link} target="_blank" rel="noreferrer">টেলিগ্রাম</a>}
        </div>
      </div>
      <p className="mt-8 text-center text-xs text-muted-foreground">© ২০২৬ Hexa AI। সর্বস্বত্ব সংরক্ষিত।</p>
    </footer>
  );
}
