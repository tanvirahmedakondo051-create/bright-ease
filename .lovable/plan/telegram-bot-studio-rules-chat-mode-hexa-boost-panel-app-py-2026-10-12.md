# Telegram Bot Studio rules: Chat mode, Hexa Boost Panel, app.py

## What users will see
- **Three mode buttons in the studio:** Chat (selected first, free) · Plan · Build. Chat is also labelled "Error Debug".
- **Chat mode:** free. No coins are taken, no files change, and no full code is sent. Empty box text: "লগ বা স্ক্রিনশট দিন — Chat মোড ফ্রি, এখানে কোড বদলাবে না". You can attach error logs or screenshots.
  - If the problem isn't in the code (wrong BOT_TOKEN/ADMIN_ID, panel not started, wrong main file, requirements not installed, Telegram flood or network, warning lines mistaken for errors), the AI says "এটা কোড বাগ নয়" and gives exact steps.
  - If it's a real code bug, the AI gives a short explanation and a confirm box appears: "কোড ফিক্স করতে Build মোডে যেতে হবে". It has two buttons: [অনুমতি দিয়ে Build-এ ফিক্স করুন] [বাতিল]. Allow switches to Build and runs a careful fix that keeps every existing feature. Cancel changes nothing and costs nothing.
- **Hosting wording:** every hosting mention says **Hexa Boost Panel**. The underlying panel software is never named.
- **Files:** each new bot has **app.py**, requirements.txt and README.md, ready to upload to the panel. The README has 4 Bangla steps: upload the ZIP, set the main file to app.py, add BOT_TOKEN and ADMIN_ID, then Start and check the Console. When it starts, the bot prints a clear "started" line.
- Existing bots that have bot.py are renamed to app.py on their next build. The old version stays in version history.
- The "পার্মানেন্ট হোস্ট" button stays and opens https://hexahoster.xyz.

## Generated bot rules (added to the AI instructions)
- Use only the official Telegram Bot API (core.telegram.org/bots/api plus its changelog). Features up to Bot API 10.3 are allowed. Use `python-telegram-bot>=22.7`.
- Buttons use the required `BUTTON_EMOJIS`, `button_emoji(key)` and `kb_btn(text, callback_data, key, style)` helpers, which return a real `InlineKeyboardButton`:
  - When a premium icon is set, the button text gets no Unicode emoji in front.
  - Colour is set only for primary, success or danger.
- Saved IDs in data.json win over the defaults. Default IDs come from the admin emoji library. This replaces the earlier `btn()` raw-dict rule.

## Technical details
- `bot.functions.ts` / `bot-build.server.ts`: add `mode: "chat"`. Chat skips the coin charge, file saves, version snapshot and the background job. Its prompt is advise-only and returns a `VERDICT: code_bug | not_code` line. `code_bug` returns `needsBuildFix: true` plus a short fix brief.
- Daily AI message limits do not count Chat (free). A soft per-day cap (e.g. 50) stops abuse. Admins can change it later.
- Studio (`bot.$botId.tsx`): a 3-way mode toggle, Chat as the default, and a confirm dialog. Allow starts `startBotBuild` with the brief plus the original log in fix mode.
- `ALLOWED_FILES` becomes app.py/requirements.txt/README.md (bot.py is still accepted as input). On upgrade, bot.py is mapped to app.py. preserve-check, the files panel, copy, ZIP, and the VPS 5-minute test (it runs app.py, with a bot.py fallback) all switch to the new name.
- `rules()` prompt rewritten for app.py, the panel README, the kb_btn helper, PTB 22.7 and the API source rule. The "never name the panel software" rule is added to all modes.
- Copy changes: "HexaHoster" wording becomes "Hexa Boost Panel" in the studio, home and README template.
- AGENTS.md: the product-boundary rule is updated (app.py, free Chat mode).
