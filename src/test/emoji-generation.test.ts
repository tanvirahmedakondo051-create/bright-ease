import { describe, expect, it } from "vitest";
import { extractGeneratedEmojis, rules } from "@/lib/bot.functions";

describe("generated premium emoji collection", () => {
  it("collects button and message emoji IDs", () => {
    const source = `
BUTTON_EMOJIS = {"main.shop": "5282843764451195532"}
TEXT_EMOJIS = {"ok": ["6111726981760423576", "✅"], "text.warn": ("6314510813214284503", "⚠️")}
`;
    expect(extractGeneratedEmojis(source)).toEqual({
      "main.shop": "5282843764451195532",
      "text.ok": "6111726981760423576",
      "text.warn": "6314510813214284503",
    });
  });

  it("requires complete premium coverage and inline-only admin controls", () => {
    const prompt = rules({}, {});
    expect(prompt).toContain("EVERY meaningful emoji-bearing heading");
    expect(prompt).toContain("ALL admin screens");
    expect(prompt).toContain("NEVER ReplyKeyboardMarkup");
    expect(prompt).toContain("Require inline Yes/No confirmation");
  });
});