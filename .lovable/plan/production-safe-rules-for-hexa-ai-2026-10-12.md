# Production-safe rules for Hexa AI

Much of the file already exists (Chat free, plan saved, background jobs with retries, coin ledger, data.json, python-telegram-bot>=22.7, colours, emoji mode, emoji paste, Hexa Boost Panel naming). This plan fills only the gaps.

## 1. Stronger bot-writing rules (what the AI is told)
- Storage: data.json with atomic save (write temp file, then replace). MongoDB/Postgres only if the user clearly asks.
- Console prints exactly `Bot started successfully` on start.
- Menu routing: one text handler for the bottom menu, matched by part of the label (works with Bangla like দোকান, কার্ট), registered so an admin catch-all can't block it; logs `RAW_TEXT` and `MENU_ACTION` to the console.
- Admin panel uses nested menus (Home → section → Back), not one wall of buttons.
- One bot token = one running copy (README warns: stop the 5-minute test before starting on the panel).

## 2. Check before "success"
After every Build/Fix/Upgrade, an automatic check of app.py and requirements.txt:
- /start handler exists and sends a keyboard
- every bottom-menu label has a matching route
- admin actions check ADMIN_ID
- no bot token / secrets written in the files
- requirements has python-telegram-bot>=22.7

If any fail: one automatic repair round. If still failing, the bot is saved but the chat shows "⚠ যাচাই সম্পূর্ণ হয়নি" with the failed items — never "ঠিক হয়েছে/verified". The result shows as a small checklist in the chat.

## 3. Upload safety
- ZIP: reject if more than 200 files or over 20 MB once unpacked; skip paths with `..` or absolute paths.
- Attachment text is always sent as "user file content", wrapped and labelled, never as instructions/system text.

## 4. Brain safety
- Saved patterns keep only structure (flows, menu keys, pitfalls); strip anything looking like a token, ID or long code before saving.

## Technical details
- Rules: `rules()` in `src/lib/bot.functions.ts`.
- New `src/lib/bot-validate.ts` (pure, regex-based) + tests in `src/test/bot-validate.test.ts`; called in `bot-build.server.ts` after preserve-check, result stored in the job events and assistant message.
- ZIP limits in `src/lib/attachments.ts` `readZip`; wrapping in `bot-build.server.ts` message building.
- `savePattern` sanitiser in `bot.functions.ts`.
- No database changes.
