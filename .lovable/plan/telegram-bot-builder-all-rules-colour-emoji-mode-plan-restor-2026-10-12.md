# Telegram Bot Builder: all rules (colour, emoji mode, plan restore, brain, bulk emoji paste)

Already in place: app.py/ZIP for Hexa Boost Panel, secrets only from env, free Chat mode with the fix popup, nested inline admin, Emoji Settings inside each bot, and saving emoji mode per bot. This plan adds what is still missing.

## 1. Button colour always on
- Every important button gets a colour, even in Normal emoji mode. Nav/main buttons are blue, approve/add/confirm are green, reject/cancel/back/delete are red.
- A default colour map is built into the bot (`main.*` blue, `action.approve/add/confirm` green, `action.reject/cancel/back/delete` red, `admin.*` blue). A colour set in the library or in Emoji Settings overrides it.
- Normal mode now keeps `ik_btn`/`rk_btn` with colours and only drops the premium icon. Today, Normal mode drops the whole helper block.

## 2. Emoji mode chosen once and kept
- A small "Emoji: Premium / Normal" chip in the studio header. Tap it to change.
- The first Plan still asks if the mode isn't set yet. After that, every Plan, Build, Fix and Upgrade uses the saved mode.
- In Premium mode, an upgrade is never allowed to fall back to plain emoji. The rule is added to the upgrade instructions and checked after the build: if premium icons disappeared, a repair pass runs.

## 3. Plan survives closing the browser
- Plans are already saved in the bot's chat history. Now, the plan questions you're answering are saved too, along with your answers so far.
- On reopening the bot, if a plan isn't approved yet, a banner shows: "আগের প্ল্যান আছে — চালিয়ে যান / নতুন প্ল্যান". Continuing reopens the plan card, or the questions with your earlier answers filled in.
- Running jobs already resume after a refresh. That stays as is.

## 4. Bot Brain learns from successful bots
- After each successful Build, a short pattern is saved: bot type (shop/support/other), emoji mode, flows, menu keys, admin sections, colour map, emoji map, pitfalls and a quality score.
- For a new Plan or Build, the 2–3 best matching patterns of the same type are given to the AI, so plan defaults and key names start from proven bots. You can still edit the plan.
- Fix lessons keep working as now.
- Admin → Brain shows the patterns next to the fix lessons, with delete.

## 5. Bulk paste for the premium emoji library (Admin → Settings)
- A large box: "Premium emoji list পেস্ট করুন". One line per emoji, like `❤️‍🔥 - 6314409378971657327`.
- Tap **সেভ করুন**:
  - Spaces are trimmed and empty lines skipped.
  - If the same emoji appears twice, the last ID wins.
  - Bad lines are counted and reported.
  - A toast says "Xটা যোগ/আপডেট হয়েছে".
- Below the box: the saved list with a Delete button on each row. There's no pack picker. The existing code import stays as a second option.
- These emoji↔ID pairs are sent to the AI. In Premium mode, or when you say "নরমাল ইমোজি প্রিমিয়াম করো", the AI matches each button's emoji to its ID and adds the icon. Colours are kept, and only the needed parts are changed through the parallel upgrade.

## 6. Bot Emoji Settings (inside the generated bot)
- The bot's Emoji Settings also gets the bulk paste flow (paste list → Add). It applies to both inline and bottom-menu buttons on the next render. In Normal mode it shows the note: "প্রিমিয়াম আইকন চালু করতে Emoji mode = Premium করুন".

## Technical details
- `rules()` in `bot.functions.ts`: `DEFAULT_STYLES` prefix map and a `style_for(key)` fallback in `_btn_kwargs`. The Normal-mode replacement keeps the helpers and BUTTON_STYLES and strips only the icon/pe parts. Add an `EMOJI_LIBRARY = {unicode: id}` block and a unicode→id matching rule. Add bot-side bulk paste (`emoji - id` lines parsed from the admin's message) to the Emoji Settings spec.
- `preserve-check.ts`: new `premiumLost(old, new)`. If the old code had `icon_custom_emoji_id` and the new code has none while the mode is premium, it counts as a problem and the existing repair round runs.
- New `src/lib/emoji-bulk.ts`: `parseEmojiList(text)` returns `{ items: {emoji,id}[], invalid }`, with last-wins on duplicates. A server function `adminBulkEmojis` merges into `site_settings.button_emojis`/`button_emoji_meta` with key `u.<codepoints>`, kind `text`, and `fallback` = the emoji. A delete function removes one key.
- Migration (+ rerunnable copy in `supabase/migrations/`): `bots.pending_questions jsonb` and `bots.pending_answers jsonb` (nullable), plus `bot_brain.kind text default 'fix'`, `bot_type text`, `pattern jsonb`, `quality int`. No new tables.
- `bot-build.server.ts`: on a plan that returns questions, save them to `pending_questions`, and clear them when the plan or build succeeds. After a successful build, insert a pattern row (type from prompt keywords, keys and styles from the code, sections from `adm:` callbacks). `brainContext` adds the top 3 patterns of the same `bot_type` (kind='pattern') ordered by quality and recency.
- New `setEmojiMode` server function (owner-checked). Studio: header chip, restore banner, and `BotQuestionDialog` pre-filled from `pending_answers`, with answers saved as you go.
- Admin Settings: new `BulkEmojiPaste` component above `ImportEmojis`. Admin Brain: a "Patterns" tab.
- Tests: `parseEmojiList` (format, duplicates, invalid count), `style_for` defaults in `rules()`, Normal mode keeps `style`, and `premiumLost` detection.

## Verification
- tsgo + vitest.
- Paste the sample list in Admin → Settings. The toast count is correct, the rows show up, and delete works.
- Close and reopen the studio mid-questions. The banner appears and the answers are restored.
- Publish afterwards so the live site gets the changes.
