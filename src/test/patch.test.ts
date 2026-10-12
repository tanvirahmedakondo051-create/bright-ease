import { describe, expect, it } from "vitest";
import { applyEdits, extractJson } from "@/lib/patch";

const code = "def a():\n    x = 1\n    return x\n\ndef b():\n    return 2\n";

describe("patch engine", () => {
  it("applies exact match", () => {
    const r = applyEdits([{ path: "bot.py", content: code }], [{ path: "bot.py", find: "return 2", replace: "return 3" }]);
    expect(r.failed).toHaveLength(0);
    expect(r.files[0].content).toContain("return 3");
  });
  it("tolerates indentation/whitespace differences", () => {
    const r = applyEdits([{ path: "bot.py", content: code }], [{ path: "bot.py", find: "x = 1  \r\nreturn x", replace: "x = 5\nreturn x" }]);
    expect(r.failed).toHaveLength(0);
    expect(r.files[0].content).toContain("    x = 5\n    return x");
  });
  it("rejects ambiguous matches but keeps other edits", () => {
    const r = applyEdits([{ path: "bot.py", content: code }], [
      { path: "bot.py", find: "return", replace: "yield" },
      { path: "bot.py", find: "return 2", replace: "return 9" },
    ]);
    expect(r.failed).toHaveLength(1);
    expect(r.files[0].content).toContain("return 9");
  });
  it("extracts fenced json", () => {
    expect(extractJson('ok\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
});
