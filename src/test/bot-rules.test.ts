import { describe, it, expect } from "vitest";
import { parseEmojiList, emojiKey } from "@/lib/emoji-bulk";
import { rules, NORMAL_MODE_RULE, botType } from "@/lib/bot.functions";
import { premiumLost } from "@/lib/preserve-check";

describe("bulk emoji paste", () => {
  it("parses lines, last id wins, counts invalid", () => {
    const r = parseEmojiList("❤️‍🔥 - 6314409378971657327\n\n👀 -6314425974725288033\nbad line\n👀 - 6314425974725288099");
    expect(r.items).toEqual([{ emoji: "❤️‍🔥", id: "6314409378971657327" }, { emoji: "👀", id: "6314425974725288099" }]);
    expect(r.invalid).toBe(1);
    expect(emojiKey("👀")).toBe("u.1f440");
  });
});

describe("button colour + emoji mode", () => {
  it("defaults back to red and main to blue", () => {
    const p = rules({}, {});
    expect(p).toContain('"action.back":"danger"');
    expect(p).toContain('"main.":"primary"');
    expect(p).toContain('"action.approve":"success"');
  });
  it("puts library emoji into EMOJI_LIBRARY", () => {
    expect(rules({ "u.1f440": "6314425974725288033" }, { "u.1f440": { fallback: "👀", kind: "text" } })).toContain('"👀":"6314425974725288033"');
  });
  it("normal mode keeps colours", () => {
    expect(NORMAL_MODE_RULE).toContain("colours stay ON");
  });
  it("detects premium icons being dropped", () => {
    expect(premiumLost('kw["icon_custom_emoji_id"]=x', "plain")).toBe(true);
    expect(premiumLost("plain", "plain")).toBe(false);
  });
  it("classifies shop bots", () => {
    expect(botType("আমার একটা দোকান বট বানাও")).toBe("shop");
  });
});
