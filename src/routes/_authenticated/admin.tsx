import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { LayoutDashboard, Users, Wallet, Loader2, ArrowRight, Cpu, Package, Gauge, Settings, BarChart3, Brain } from "lucide-react";
import { useIsAdmin, useSession } from "@/lib/auth";
import { Logo } from "@/components/site/Brand";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "অ্যাডমিন প্যানেল — Hexa AI" }, { name: "robots", content: "noindex" }] }),
  component: AdminLayout,
});

const nav = [
  { to: "/admin", label: "ড্যাশবোর্ড", icon: LayoutDashboard, exact: true },
  { to: "/admin/users", label: "ইউজার", icon: Users },
  { to: "/admin/payments", label: "পেমেন্ট", icon: Wallet },
  { to: "/admin/providers", label: "AI প্রোভাইডার", icon: Cpu },
  { to: "/admin/plans", label: "প্ল্যান", icon: Package },
  { to: "/admin/limits", label: "লিমিট", icon: Gauge },
  { to: "/admin/analytics", label: "অ্যানালিটিক্স", icon: BarChart3 },
  { to: "/admin/brain", label: "Bot Brain", icon: Brain },
  { to: "/admin/settings", label: "সেটিংস", icon: Settings },
] as const;

function AdminLayout() {
  const { user } = useSession();
  const { data: isAdmin, isLoading } = useIsAdmin(user?.id);
  if (isLoading || !user) return <div className="grid min-h-screen place-items-center"><Loader2 className="size-8 animate-spin text-cyan" /></div>;
  if (!isAdmin)
    return (
      <div className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="text-2xl font-bold">প্রবেশাধিকার নেই</h1>
          <p className="mt-2 text-muted-foreground">এই পেজটি শুধু অ্যাডমিনদের জন্য।</p>
          <Link to="/dashboard" className="mt-4 inline-block text-cyan">ড্যাশবোর্ডে ফিরুন</Link>
        </div>
      </div>
    );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 z-30 border-b border-border bg-sidebar lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />
          <Link to="/dashboard" className="flex min-h-11 items-center gap-1 text-xs text-muted-foreground"><ArrowRight className="size-4 rotate-180" />অ্যাপ</Link>
        </div>
        <nav className="flex flex-wrap gap-1 px-2 pb-2 lg:flex-col lg:flex-nowrap">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: "exact" in n }}
              className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-sidebar-accent"
              activeProps={{ className: "bg-sidebar-accent text-foreground" }}
            >
              <n.icon className="size-4" /> {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

