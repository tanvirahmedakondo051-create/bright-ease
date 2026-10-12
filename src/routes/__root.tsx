import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Wrench } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin, useSession } from "@/lib/auth";
import { useSiteSettings } from "@/lib/site";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-brand">৪০৪</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">পেজটি পাওয়া যায়নি</h2>
        <p className="mt-2 text-sm text-muted-foreground">আপনি যে পেজটি খুঁজছেন সেটি নেই বা সরানো হয়েছে।</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-medium text-primary-foreground">
            হোমে ফিরুন
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-foreground">দুঃখিত, পেজটি লোড হয়নি</h1>
        <p className="mt-2 text-sm text-muted-foreground">একটু সমস্যা হয়েছে। আবার চেষ্টা করুন বা হোমে ফিরে যান।</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 font-medium text-primary-foreground"
          >
            আবার চেষ্টা করুন
          </button>
          <a href="/" className="inline-flex min-h-12 items-center rounded-xl border border-input px-5 font-medium">
            হোমে ফিরুন
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Hexa AI — বাংলায় Telegram bot বানান" },
      { name: "description", content: "বাংলায় বলুন, AI আপনার Python Telegram bot বানিয়ে ZIP দেবে।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#0a0a0a" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      else queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <MaintenanceGate>
        <Outlet />
      </MaintenanceGate>
      <Toaster position="top-center" richColors />
    </QueryClientProvider>
  );
}

function MaintenanceGate({ children }: { children: ReactNode }) {
  const { data: settings } = useSiteSettings();
  const { user } = useSession();
  const { data: isAdmin } = useIsAdmin(user?.id);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const exempt = path.startsWith("/login") || path.startsWith("/s/");
  if (settings?.maintenance_mode && !isAdmin && !exempt) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="glass max-w-sm rounded-2xl p-8">
          <Wrench className="mx-auto size-10 text-cyan" />
          <h1 className="mt-4 text-2xl font-bold">রক্ষণাবেক্ষণ চলছে</h1>
          <p className="mt-2 text-muted-foreground">আমরা সাইটটি আরও ভালো করছি। কিছুক্ষণ পর আবার আসুন।</p>
          <Link to="/login" className="mt-4 inline-block text-sm text-cyan">অ্যাডমিন লগইন</Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
