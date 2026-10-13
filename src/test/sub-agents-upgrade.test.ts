import { describe, it, expect } from "vitest";
import { mergeSections, splitExistingApp, parseUpgrade, mergeUpgrade, shouldSplitUpgrade } from "@/lib/sub-agents";

const app = mergeSections("import os\ndef core_x():\n    pass",
  { code: "async def admin_home(u, c):\n    pass", handlers: ['app.add_handler(CommandHandler("admin", admin_home))'] },
  { code: "async def user_start(u, c):\n    pass", handlers: ['app.add_handler(CommandHandler("start", user_start))'] });

describe("parallel upgrade", () => {
  it("splits a merged app back into sections", () => {
    const s = splitExistingApp(app)!;
    expect(s.core).toContain("core_x");
    expect(s.admin).toContain("admin_home");
    expect(s.user).toContain("user_start");
    expect(s.tail).toContain("run_polling");
  });
  it("keeps unchanged sections and adds new handlers", () => {
    const s = splitExistingApp(app)!;
    const user = parseUpgrade("=== CODE ===\nasync def user_start(u, c):\n    return 1\nasync def user_shop(u, c):\n    pass\n=== END CODE ===\n=== HANDLERS ===\napp.add_handler(CallbackQueryHandler(user_shop, pattern=r\"^u:shop\"))\n=== END HANDLERS ===")!;
    const out = mergeUpgrade(s, { core: { unchanged: true }, admin: { unchanged: true }, user });
    expect(out).toContain("admin_home");
    expect(out).toContain("user_shop");
    expect(out).toContain('pattern=r"^u:shop"');
    expect(out).toContain("run_polling");
  });
  it("only splits big sectioned bots without a crash log", () => {
    const big = app.replace("pass", "pass\n" + "x = 1\n".repeat(900));
    expect(shouldSplitUpgrade(big, false)).toBe(true);
    expect(shouldSplitUpgrade(big, true)).toBe(false);
    expect(shouldSplitUpgrade(app, false)).toBe(false);
  });
});

import { upgradeCutOff, flowToText } from "@/lib/sub-agents";
describe("upgradeCutOff", () => {
  it("detects missing END CODE", () => { expect(upgradeCutOff("=== CODE ===\ndef a():")).toBe(true); });
  it("complete reply is not cut", () => { expect(upgradeCutOff("=== CODE ===\nx\n=== END CODE ===")).toBe(false); });
  it("flow text lists buttons in order", () => {
    expect(flowToText({ screens: [{ id: "start", buttons: [[{ label: "দোকান", emoji: "🛍", goes_to: "shop" }, { label: "কার্ট" }]] }] })).toContain("সারি 1: 🛍 দোকান → shop | কার্ট");
  });
});
