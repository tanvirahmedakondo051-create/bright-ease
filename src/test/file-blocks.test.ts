import { describe, expect, it } from "vitest";
import { parseFileBlocks } from "@/lib/file-blocks";
import { missingFeatures, truncationProblems } from "@/lib/preserve-check";

describe("file blocks", () => {
  it("parses files and sections, code with quotes intact", () => {
    const t = `=== SUMMARY ===\nহয়েছে\n=== END SUMMARY ===\n=== FILE: bot.py ===\nprint("a \\"b\\"")\n=== END FILE ===\n=== FILE: README.md ===\nhi\n=== END FILE ===`;
    const r = parseFileBlocks(t);
    expect(r.unclosed).toBe(false);
    expect(r.sections.summary).toBe("হয়েছে");
    expect(r.files.map((f) => f.path)).toEqual(["bot.py", "README.md"]);
    expect(r.files[0].content).toBe('print("a \\"b\\"")\n');
  });
  it("detects a cut-off reply", () => {
    expect(parseFileBlocks("=== FILE: bot.py ===\nimport os\n").unclosed).toBe(true);
  });
  it("strips markdown fences inside a block", () => {
    expect(parseFileBlocks("=== FILE: bot.py ===\n```python\nx=1\n```\n=== END FILE ===").files[0].content).toBe("x=1\n");
  });
});

describe("preserve check", () => {
  const oldSrc = `async def start(u,c): pass\nasync def shop(u,c): pass\napp.add_handler(CommandHandler("start", start))\nInlineKeyboardButton("x", callback_data="shop")\napp.run_polling()`;
  it("reports dropped features", () => {
    const newSrc = `async def start(u,c): pass\napp.add_handler(CommandHandler("start", start))\napp.run_polling()`;
    expect(missingFeatures(oldSrc, newSrc)).toEqual(["function shop()", 'callback_data "shop"']);
  });
  it("accepts a superset", () => {
    expect(missingFeatures(oldSrc, oldSrc + "\nasync def withdraw(u,c): pass")).toEqual([]);
  });
  it("flags truncation and placeholders", () => {
    expect(truncationProblems("def a():\n    '''doc")).toContain("unclosed triple-quoted string");
    expect(truncationProblems("x=1\n# ... rest of the code\napp.run_polling()").length).toBe(1);
    expect(truncationProblems(oldSrc)).toEqual([]);
  });
});
