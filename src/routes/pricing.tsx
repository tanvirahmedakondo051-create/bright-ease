import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site/SiteHeader";
import { Orbs } from "@/components/site/Brand";
import { PricingCards, Faq } from "@/components/site/Pricing";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "দাম — Hexa AI" },
      { name: "description", content: "Hexa AI-এর ফ্রি ও প্রো প্ল্যানের তুলনা। AuraPay দিয়ে বিকাশ, নগদ সহ পেমেন্ট।" },
      { property: "og:title", content: "দাম — Hexa AI" },
      { property: "og:description", content: "ফ্রি দিয়ে শুরু করুন, দরকার হলে প্রো নিন।" },
    ],
  }),
  component: PricingPage,
});

const billingFaq = [
  { q: "কীভাবে পেমেন্ট করব?", a: "প্ল্যান বেছে নিলে AuraPay পেমেন্ট পেজ খুলবে, সেখানে বিকাশ, নগদ বা রকেট দিয়ে পেমেন্ট করুন।" },
  { q: "প্রো কখন চালু হবে?", a: "পেমেন্ট সফল হওয়ার সাথে সাথেই প্ল্যান স্বয়ংক্রিয়ভাবে চালু হয়ে যায়।" },
  { q: "কয়েন কী?", a: "১ কয়েন = AI-এর প্রায় ১০,০০০ টোকেন কাজ। প্রতিদিন রাত ১২টায় আপনার প্ল্যান অনুযায়ী কয়েন যোগ হয়, ক্যাপের বেশি জমে না। কেনা কয়েন আলাদা যোগ হয়।" },
  { q: "মেয়াদ কতদিন?", a: "প্রতিটি প্ল্যানের মেয়াদ প্ল্যান কার্ডে দেখানো আছে। মেয়াদ শেষে ফ্রি প্ল্যানে ফিরে যাবেন।" },
  { q: "টাকা ফেরত পাওয়া যাবে?", a: "প্রথম ৭ দিনের মধ্যে সমস্যা হলে সাপোর্টে যোগাযোগ করুন।" },
];

function PricingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <section className="relative isolate overflow-hidden px-4 py-16">
        <Orbs />
        <h1 className="text-center text-4xl font-bold md:text-5xl">
          আপনার জন্য <span className="text-brand">সঠিক প্ল্যান</span>
        </h1>
        <p className="mx-auto mb-12 mt-4 max-w-xl text-center text-muted-foreground">ফ্রি দিয়ে শুরু করুন। বেশি দরকার হলে যেকোনো সময় প্রো নিন।</p>
        <PricingCards />
      </section>
      <section className="px-4 pb-16">
        <h2 className="mb-8 text-center text-2xl font-bold">পেমেন্ট নিয়ে প্রশ্ন</h2>
        <Faq items={billingFaq} />
      </section>
      <SiteFooter />
    </div>
  );
}
