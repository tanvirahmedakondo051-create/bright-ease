import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AuthCard } from "@/components/site/AuthCard";
import { useSession } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "লগইন — Hexa AI" },
      { name: "description", content: "Hexa AI অ্যাকাউন্টে লগইন করুন।" },
      { property: "og:title", content: "লগইন — Hexa AI" },
      { property: "og:description", content: "আপনার টেলিগ্রাম বটগুলোতে ফিরে যান।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Login,
});

function Login() {
  const { user } = useSession();
  const nav = useNavigate();
  useEffect(() => {
    if (user) nav({ to: "/dashboard" });
  }, [user, nav]);
  return <AuthCard mode="login" />;
}
