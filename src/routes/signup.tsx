import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard } from "@/components/site/AuthCard";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "সাইন আপ — Hexa AI" },
      { name: "description", content: "ফ্রিতে Hexa AI অ্যাকাউন্ট খুলুন এবং বাংলায় টেলিগ্রাম বট বানান।" },
      { property: "og:title", content: "সাইন আপ — Hexa AI" },
      { property: "og:description", content: "ফ্রিতে শুরু করুন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Signup,
});

function Signup() {
  const { user } = useSession();
  const nav = useNavigate();
  useEffect(() => {
    if (user) nav({ to: "/dashboard" });
  }, [user, nav]);
  return <AuthCard mode="signup" />;
}
