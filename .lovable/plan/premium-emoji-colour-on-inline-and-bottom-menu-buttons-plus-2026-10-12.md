# Premium emoji + colour on inline AND bottom menu buttons, plus nested admin panel

## What you get
- Every new bot's **inline buttons** and **bottom Menu buttons** both show the premium emoji icon and colour (blue / green / red).
- When a premium icon is set, the button text has no extra normal emoji in front. When no ID is set, a normal emoji is shown instead.
- A fixed list of standard button names (main.shop, main.cart, main.orders, main.support, main.profile, main.help, admin.panel, admin.dashboard, admin.products, admin.orders, admin.users, admin.broadcast, admin.settings, admin.emoji, admin.hexa, action.back/approve/reject/cancel/next/add) is always in the bot, filled from your admin emoji library.
- Professional **nested admin panel** inside each bot: Admin Panel → Dashboard / Products / Orders / Users / Broadcast / Settings → Emoji Settings, each with a Back button, all using the same emoji + colour buttons.

## Technical details
- `rules()` in `bot.functions.ts`: replace the `kb_btn` rule with the required `button_emoji`, `ik_btn` (InlineKeyboardButton) and `rk_btn` (KeyboardButton for ReplyKeyboardMarkup) helpers exactly as given; Bot API 9.4+ fields `icon_custom_emoji_id` and `style`; python-telegram-bot>=22.7; app.py; secrets env only.
- BUTTON_EMOJIS default block always contains the standard keys above, merged with library IDs at build time (library wins, empty string otherwise).
- Rule: every inline button uses `ik_btn`, every reply-menu button uses `rk_btn`, always with a key; reply-menu taps are matched by text in a MessageHandler.
- Add the nested admin panel spec (admin-only via ADMIN_ID, callback prefix `adm:`) to build and upgrade prompts; Emoji Settings lets the admin change ID/colour per key, saved in data.json.
- `preserve-check` unchanged; update the emoji-mode "normal" rules to also use `ik_btn`/`rk_btn` without IDs.
