// Guards full-file bot.py upgrades: nothing existing may silently disappear, and cut-off files are rejected.
const uniq = (a: string[]) => [...new Set(a)];
const all = (src: string, re: RegExp) => uniq([...src.matchAll(re)].map((m) => m[1]));

export function botFeatures(src: string) {
  return {
    functions: all(src, /^[ \t]*(?:async\s+)?def\s+(\w+)\s*\(/gm),
    commands: all(src, /CommandHandler\(\s*\[?\s*["']([\w-]+)["']/g),
    callbacks: all(src, /callback_data\s*=\s*f?["']([^"'{}]+)["']/g),
    patterns: all(src, /pattern\s*=\s*r?["']([^"']+)["']/g),
  };
}

/** Items present in the old bot.py that the new one no longer contains. */
export function missingFeatures(oldSrc: string, newSrc: string): string[] {
  const o = botFeatures(oldSrc), n = botFeatures(newSrc);
  const out: string[] = [];
  for (const f of o.functions) if (!n.functions.includes(f)) out.push(`function ${f}()`);
  for (const c of o.commands) if (!n.commands.includes(c)) out.push(`command /${c}`);
  for (const c of o.callbacks) if (!n.callbacks.includes(c) && !newSrc.includes(c)) out.push(`callback_data "${c}"`);
  for (const p of o.patterns) if (!n.patterns.includes(p) && !newSrc.includes(p)) out.push(`handler pattern "${p}"`);
  return out;
}

/** Signs that a generated bot.py was cut off or left with placeholders. Empty array = looks complete. */
export function truncationProblems(newSrc: string, oldSrc?: string): string[] {
  const p: string[] = [];
  if (oldSrc && oldSrc.length > 2000 && newSrc.length < oldSrc.length * 0.6) p.push(`new app.py is much shorter than before (${newSrc.length} vs ${oldSrc.length} chars)`);
  if (((newSrc.match(/"""/g)?.length ?? 0) % 2) || ((newSrc.match(/'''/g)?.length ?? 0) % 2)) p.push("unclosed triple-quoted string");
  if (!/run_polling\s*\(|run_webhook\s*\(|__name__\s*==\s*["']__main__["']/.test(newSrc)) p.push("missing start-up code (run_polling / __main__) at the end");
  if (/#\s*\.\.\.|rest of (the )?(code|file)|unchanged\s*\.\.\.|\.\.\.\s*existing code/i.test(newSrc)) p.push("contains placeholder comments instead of real code");
  return p;
}
