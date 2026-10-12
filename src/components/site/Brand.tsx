import { Link } from "@tanstack/react-router";
import { Hexagon } from "lucide-react";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link to="/" className={`flex items-center gap-2 font-en font-bold ${className}`}>
      <span className="grid size-9 place-items-center rounded-xl bg-brand shadow-glow">
        <Hexagon className="size-5 text-primary-foreground" strokeWidth={2.5} />
      </span>
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
