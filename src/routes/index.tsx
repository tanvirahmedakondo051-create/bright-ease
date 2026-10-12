import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bot, Box, Code2, MessageCircle, Play, Send, Sparkles } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/site/SiteHeader";
import { PricingCards } from "@/components/site/Pricing";
import botStudioIcons from "@/assets/bot-studio-icons.png";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Hexa AI — বাংলায় Telegram bot বানান" },
    { name: "description", content: "বাংলায় বর্ণনা দিন, AI plan করে production-ready Python Telegram bot বানিয়ে ZIP দেবে।" },
    { property: "og:title", content: "Hexa AI — বাংলায় Telegram bot বানান" },
    { property: "og:description", content: "Plan, Build, ZIP এবং ৫ মিনিট live test — বাংলাভাষীদের professional Telegram bot studio।" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Landing,
});

const flow = [
  { icon: MessageCircle, title: "Plan", text: "বাংলায় লিখুন, structured plan অনুমোদন করুন" },
  { icon: Code2, title: "Build", text: "AI শুধু app.py, requirements.txt ও README বানাবে" },
  { icon: Box, title: "ZIP", text: "কোড ও secrets আলাদা রেখে ZIP ডাউনলোড করুন" },
  { icon: Play, title: "৫ মিনিট টেস্ট", text: "নিজের token দিয়ে অস্থায়ী live test চালান" },
];

function Landing() {
  return <div className="min-h-screen bg-background">
    <SiteHeader />
    <main>
      <section className="hero-grid relative isolate min-h-[min(760px,calc(100dvh-64px))] overflow-hidden px-4 pb-14 pt-16 md:pt-24">
        <div className="hero-particles pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="hero-scan pointer-events-none absolute inset-x-0 top-0 -z-10 h-px" aria-hidden />
        <div className="hero-art hero-art-left" aria-hidden><img src={botStudioIcons} alt="" width={1536} height={1024} /></div>
        <div className="hero-art hero-art-right" aria-hidden><img src={botStudioIcons} alt="" width={1536} height={1024} /></div>

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <div className="motion-enter inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-2 text-sm text-muted-foreground backdrop-blur">
            <Sparkles className="size-4 text-success" /> Telegram Python Bot Studio
          </div>
          <h1 className="motion-enter motion-delay-1 mx-auto mt-7 max-w-4xl text-4xl font-bold leading-[1.12] sm:text-5xl md:text-7xl">
            বাংলায় বলুন। <span className="text-brand">Professional Telegram bot</span> বানিয়ে নিন।
          </h1>
          <p className="motion-enter motion-delay-2 mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">Plan অনুমোদনের পর AI production-ready Python bot তৈরি করবে। ZIP নামান, নিজের server-এ চালান, অথবা ৫ মিনিট live test করুন।</p>
          <div className="motion-enter motion-delay-3 mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/signup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-7 font-semibold text-primary-foreground shadow-glow">বট বানানো শুরু করুন <ArrowLeft className="size-4 rotate-180" /></Link>
            <Link to="/pricing" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-border bg-card/70 px-7 font-semibold backdrop-blur">প্ল্যান দেখুন</Link>
          </div>
        </div>

        <div className="motion-enter motion-delay-3 relative z-10 mx-auto mt-14 max-w-4xl rounded-2xl border border-border bg-card p-3 shadow-2xl sm:p-5">
          <div className="flex items-center gap-2 border-b border-border pb-3 text-xs text-muted-foreground"><span className="size-2 rounded-full bg-primary" /><span className="size-2 rounded-full bg-warning" /><span className="size-2 rounded-full bg-success" /><span className="ml-2 font-en">Hexa Bot Studio</span></div>
          <div className="grid gap-3 pt-4 md:grid-cols-[1fr_1.15fr]">
            <div className="rounded-xl border border-border bg-background p-4"><p className="text-xs text-muted-foreground">আপনি</p><p className="mt-3 text-sm">আমার দোকানের জন্য order, payment আর admin notification সহ bot বানাও</p><div className="mt-4 flex items-center gap-2 rounded-xl border border-input bg-card p-2 text-sm text-muted-foreground"><span className="flex-1">বট কী করবে বাংলায় লিখুন…</span><span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground"><Send className="size-4" /></span></div></div>
            <div className="rounded-xl border border-success/25 bg-success/5 p-4"><div className="flex items-center gap-2 text-sm font-semibold text-success"><Bot className="size-4" /> Build ready</div><div className="mt-4 grid grid-cols-3 gap-2 font-en text-xs">{["app.py", "requirements.txt", "README.md"].map((file) => <span key={file} className="rounded-lg border border-border bg-card px-2 py-2 text-center">{file}</span>)}</div><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full w-full bg-success" /></div><p className="mt-2 text-xs text-muted-foreground">Plan → Writing app.py → Ready</p></div>
          </div>
        </div>
      </section>

      <section id="features" className="border-y border-border bg-card/30 px-4 py-16">
        <div className="mx-auto max-w-6xl"><div className="mb-10 max-w-2xl"><p className="text-sm font-semibold text-success">একটি পরিষ্কার workflow</p><h2 className="mt-2 text-3xl font-bold">Idea থেকে downloadable bot</h2></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{flow.map((step, index) => <article key={step.title} className="reveal-card rounded-xl border border-border bg-card p-5"><span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary"><step.icon className="size-5" /></span><p className="mt-5 font-en text-xs text-muted-foreground">0{index + 1}</p><h3 className="mt-1 text-lg font-semibold">{step.title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p></article>)}</div></div>
      </section>

      <section className="px-4 py-20"><h2 className="mb-10 text-center text-3xl font-bold">Bot builder plans</h2><PricingCards /></section>
    </main>
    <SiteFooter />
  </div>;
}