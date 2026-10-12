# Premium emoji library + per-button colour + in-bot emoji control

## What you get
1. **Admin → Premium emoji library** (new section in Bot platform settings)
   - Rows: key, emoji ID, fallback normal emoji (e.g. ✅), label, button colour (none / primary-blue / success-green / danger-red).
   - "এক এক করে add" — single "Add emoji" form at top (paste ID, pick fallback + colour, Save) and the list below with edit/delete/search.
   - Pre-filled with all IDs from your uploaded bot (main.*, task.*, action.*, admin.*, language.* keys plus the text emojis like ok/no/warn/money/gift/rocket/crown/gear etc. — about 48 unique IDs).
2. **Every generated bot.py** gets:
   - `BUTTON_EMOJIS` (key → id), `BUTTON_STYLES` (key → primary/success/danger), `PEM` text emojis (`<tg-emoji emoji-id="…">✅</tg-emoji>` with fallback), filled from the admin library at build time.
   - Helper `btn(text, key, callback_data|url)` that adds `icon_custom_emoji_id` and `style` exactly like your bot, falling back to normal emoji when ID is empty.
   - **Admin panel inside the Telegram bot → "Emoji Settings"**: lists every button key used by that bot (like your `BUTTON_EMOJI_LABELS`), admin taps one, sends a premium emoji (bot reads `custom_emoji_id` from the message entity) or types an ID, and picks colour. Saved to `data.json` → `settings.button_emojis` / `button_styles`. Reset to default option. No re-download needed.
3. AI prompt rules follow Telegram Bot API: `icon_custom_emoji_id` + `style` on InlineKeyboardButton/KeyboardButton (raw dict/JSON keyboard so it works even if python-telegram-bot lags), `parse_mode=HTML` with `<tg-emoji>` in messages; note that custom emoji on buttons needs the bot owner to have Telegram Premium / Fragment username.
4. New IDs found in generated/fixed code keep merging into the library (dedupe) — existing behaviour kept.

## Technical details
- DB: keep `site_settings.button_emojis` (key→id) for compatibility; add `site_settings.button_emoji_meta jsonb default '{}'` (key → {fallback, label, style, kind: button|text}). Migration also seeds the uploaded bot's IDs (merge, not overwrite) and mirrored as rerunnable SQL in `supabase/migrations/`.
- `admin.functions.ts`: extend get/save emoji map to include meta; validate style enum, ID digits.
- `admin.settings.tsx`: replace simple rows with add-form + searchable list (key, ID, fallback, colour chip).
- `bot.functions.ts`: inject BUTTON_EMOJIS/BUTTON_STYLES/PEM block + mandatory Emoji Settings admin menu spec into build prompt; merge extraction also captures `"style"` per key when present.
