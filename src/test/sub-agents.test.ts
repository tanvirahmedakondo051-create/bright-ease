import { describe, it, expect } from "vitest";
import { shouldSplit, parseSection, mergeSections, duplicateDefs } from "@/lib/sub-agents";

const plan = (n: number, admin = true) => `x\n\nAPPROVED PLAN:\n${JSON.stringify({ summary: "s", menus: [], features: Array.from({ length: n }, (_, i) => (admin && i === 0 ? "admin panel" : `f${i}`)) })}`;

describe("sub-agents", () => {
  it("splits big approved plans with an admin panel", () => expect(shouldSplit(plan(8), false)).toBe(true));
  it("does not split small plans", () => expect(shouldSplit(plan(3), false)).toBe(false));
  it("does not split without an admin panel", () => expect(shouldSplit(plan(10, false), false)).toBe(false));
  it("never splits fixes", () => expect(shouldSplit(plan(10), true)).toBe(false));
  it("merges admin handlers before user handlers and adds main", () => {
    const a = parseSection("=== CODE ===\nasync def admin_home(u, c): pass\n=== END CODE ===\n=== HANDLERS ===\napp.add_handler(CommandHandler(\"admin\", admin_home))\n=== END HANDLERS ===")!;
    const u = parseSection("=== CODE ===\nasync def user_start(u, c): pass\n=== END CODE ===\n=== HANDLERS ===\napp.add_handler(CommandHandler(\"start\", user_start))\n=== END HANDLERS ===")!;
    const out = mergeSections("BOT_TOKEN = 1", a, u);
    expect(out.indexOf("admin_home))")).toBeLessThan(out.indexOf("user_start))"));
    expect(out).toContain("run_polling");
    expect(out).toContain('if __name__ == "__main__"');
  });
  it("detects duplicate function names", () => expect(duplicateDefs("def a():\n  pass\nasync def a():\n  pass\ndef b(): pass")).toEqual(["a"]));
});
