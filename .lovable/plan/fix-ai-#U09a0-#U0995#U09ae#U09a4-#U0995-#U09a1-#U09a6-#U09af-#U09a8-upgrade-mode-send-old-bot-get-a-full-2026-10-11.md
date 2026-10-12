# Fix "AI ঠিকমতো কোড দেয়নি" + Upgrade mode (send old bot, get a full new file back)

## Your idea: is it good?
Yes. Sending the whole old bot.py with the request and getting a complete new file back avoids the patch-matching problem. The risks are that the AI quietly drops old features, or stops halfway through a big file. So we use your idea and add a check before the new file replaces the old one.

## Why the error came again (from the screenshot and code)
The latest error is not the patch error anymore. This time the approved plan did a full build, but the AI's answer couldn't be read as code. Likely reasons (to be confirmed first):
- The AI writes the whole bot.py *inside* a JSON text. One wrong quote or line break in a big file breaks the JSON, and the whole answer is thrown away.
- Your AI service (Claude Opus via torveai) gets no "max length" from us, so it may stop at its own default length. A long bot.py gets cut off mid-file, and a cut-off answer can't be read.
- The real reason is not recorded today, so step 1 is to record it.

## What will be built
1. **Record the real reason.** Save why each build failed (cut off, unreadable, missing bot.py) and how long the answer was, and show the reason in Bangla.
2. **Code no longer inside JSON.** The AI returns each file as a plain block, e.g. `=== FILE: bot.py ===` … `=== END FILE ===`, plus a short summary. Quotes and line breaks can no longer break it. The old JSON format is still accepted as a backup.
3. **Long answers allowed + auto-continue.** We ask for a large maximum length. If the AI still stops before `=== END FILE ===`, the server asks it to "continue exactly where you stopped" (up to 3 times) and joins the parts. No extra coins for this.
4. **Upgrade mode (your idea).** For "fix this / add this" requests on an existing bot, the AI gets the full current bot.py + the request + Brain lessons and returns the full new bot.py. Instructions: keep every existing feature, handler, button and text, change only what was asked.
5. **Safety check before saving.**
   - Every old command, button callback and function must still exist. If something is missing, the AI is told exactly what it dropped and gets one more try.
   - Rejected if the file looks cut off (much shorter than before, unclosed code, no start-up at the end).
   - Python syntax check on your VPS test agent when it is online.
6. **If it still fails:** old file stays as it was, clear Bangla reason, no coins taken, the "আবার চেষ্টা করুন" button repeats the same request.
7. **After success:** version snapshot (restore any time) + a short "what changed" list in chat.
8. **Small fixes** may still use small patches; if a patch doesn't match, the system switches to upgrade mode automatically instead of showing an error.
9. The "Scoped fix — পুরো ফাইল নয়" chip changes to "Upgrade — পুরনো ফিচার রক্ষা করে".

## Technical details
- `src/lib/bot.functions.ts`: log `finish_reason`, reply length, parse failure type to `bot_brain`/console; send `max_tokens` (e.g. 32000, provider-safe); read `finish_reason` from stream; continuation loop (≤3) appending assistant partial + "continue" user message when `finish_reason === "length"` or an unclosed FILE block.
- New `src/lib/file-blocks.ts`: parse `=== FILE: path ===` blocks, detect unclosed block; fallback to `extractJson`.
- New `src/lib/preserve-check.ts`: compare old/new `def`/`async def` names, `CommandHandler`/`CallbackQueryHandler` patterns, `callback_data` values, BUTTON_EMOJIS keys; truncation heuristics (new < 60% old length, unbalanced brackets/triple quotes, missing `main()`/`run_polling`). One repair round naming missing items; all-or-nothing save; coins only on success.
- Patch path: on mismatch fall back to upgrade mode within the same request.
- Optional `py_compile` via deploy agent when reachable.
- `src/routes/_authenticated/bot.$botId.tsx`: chip text; retry resends the same payload.
- `AGENTS.md`: replace the scoped-patch-only rule with "full-file upgrade allowed only when the preservation check passes".
- Tests: `src/test/file-blocks.test.ts`, `src/test/preserve-check.test.ts`.
