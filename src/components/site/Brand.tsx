import { Link } from "@tanstack/react-router";
import logo from "@/assets/logo.jpg";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-en font-bold ${className}`}>
      <img src={logo} alt="Hexa AI" width={36} height={36} className="size-9 rounded-full shadow-glow" />
      <span className="text-lg tracking-tight">
        Hexa <span className="text-brand">AI</span>
      </span>
    </Link>
  );
}

export function Orbs() {
  return (
    <div className="auth-backdrop pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      <div className="auth-signal auth-signal-primary" />
      <div className="auth-signal auth-signal-success" />
      <div className="auth-scanline" />
    </div>
  );
}
