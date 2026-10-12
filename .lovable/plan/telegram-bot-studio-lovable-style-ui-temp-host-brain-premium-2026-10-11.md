# Telegram Bot Studio — Lovable-style UI + temp host + brain + premium emoji

Bot-only product. Flow stays: Plan → Approve → Build → ZIP. No website builder, no secrets in any file.

## What users will see
- **Desktop 3 columns:** Projects (left) · Chat (center) · Files (right). **Mobile:** chat full width, Projects and Files open as drawers.
- **Top bar:** logo, project name (click to rename), Plan | Build toggle, live timer "⏱ 1:42" while a job runs, settings.
- **Chat:** clean user/AI bubbles; plan shown as a card (summary, menus, features, files, acceptance) with "অনুমোদন করুন" and "প্ল্যান এডিট"; build progress steps (Planning → Writing bot.py → Ready); "জেনারেশন বন্ধ" stop button; after build a success message + "ZIP ডাউনলোড করুন" + optional coin usage line; "Scoped fix — পুরো ফাইল নয়" chip on fixes; Bangla example chips and "বট কী করবে বাংলায় লিখুন…".
- **Token gate:** before Build (or test), a small card asks for BOT_TOKEN (hidden) and ADMIN_ID (number). Saved encrypted, never shown again, never written into files.
- **Action row after build:** [ফাইল ডাউনলোড ZIP] [৫ মিনিট লাইভ টেস্ট] [পার্মানেন্ট হোস্ট — ভিজিট করুন ↗] with helper "২৪/৭ হোস্ট করতে HexaHoster এ যান" (opens https://hexahoster.xyz).
- **Status chip:** Offline | Starting… | Online (ends in 3:42) | Error — restored from the server on refresh. "আবার ৫ মিনিট টেস্ট" restarts. Test log panel shows crashes.
- **Files panel:** bot.py, requirements.txt, README.md; read-only highlighted code view; ZIP download (primary), copy bot.py, last build time.
- **Versions:** list of every successful build; restore any one.
- **Admin settings:** new "Premium emoji" section — map of button keys (main.shop, main.cart, main.orders, main.profile, admin.panel, action.back, action.approve, action.reject…) to custom emoji ids.
- **Look:** bg #0A0A0A, surface #111827, primary #FF0033, accent #00FF41, muted text #A1A1AA, Space Grotesk headings / Inter body (Hind Siliguri kept for Bangla), 12–16px radius.

## Generated bot rules (AI always follows)
- Files: bot.py, requirements.txt, README.md only. No .env, no .env.example.
- bot.py reads BOT_TOKEN and ADMIN_ID from `os.environ` only.
- README: one line — set BOT_TOKEN and ADMIN_ID in the environment, then run `python bot.py`.
- Follows current Telegram Bot API (python-telegram-bot v21+).
- Includes `BUTTON_EMOJIS` (filled from admin defaults), `button_emoji(key)`, buttons use `icon_custom_emoji_id` when set, normal emoji fallback when empty.
- In-bot admin menu "Emoji Settings": pick a button → send a premium emoji → id saved to `data.json` `settings.button_emojis`.

## Important limitation
The 5-minute test must run Python on **your VPS** via the existing deploy agent (the web app's server cannot run Python). The agent must be re-installed on your VPS with Python 3. Without it, the test button shows "Error: test server offline"; everything else works.

## Technical details

### DB changes (one migration, plus safe-to-rerun copy in supabase/migrations)
- `bots`: add `temp_status text default 'stopped'` (stopped|starting|running|error), `temp_started_at timestamptz`, `temp_expires_at timestamptz`, `test_log text`, `last_build_at timestamptz`. Existing `token_enc`, `admin_id` reused (token stays encrypted; select revoked).
- New `bot_versions`: id, bot_id, user_id, files jsonb, note, coins_used int, created_at. RLS owner read; writes via server.
- New `bot_brain`: id, source (user_fix|qa|system), error_signature, symptom, root_cause, fix_summary, code_snippet, use_count int, created_at. Platform-wide; no client access, server/service role only.
- `site_settings`: add `button_emojis jsonb default '{}'`.
- Deprecated old run columns (`run_mode`, `test_until`, `status`) marked by comment.

### Server functions (`bot.functions.ts`, all owner-authenticated)
- `botChat` (existing) — modes plan/build/fix; build blocked unless token+admin saved (returns `NEED_SECRETS`); injects top 5 brain rows (keyword match on prompt/error) as "Past fixes… avoid these mistakes"; injects emoji defaults; on build saves a `bot_versions` row + `last_build_at`; on successful fix writes one short brain entry.
- Cancel: client AbortController + server checks a `cancelled` flag stored on the bot row before saving results.
- `saveBotSecrets({botId, token, adminId})` — validate via Telegram getMe, encrypt, store.
- `renameBot({botId, name})`.
- `listVersions({botId})`, `restoreVersion({botId, versionId})`.
- `startTempHost({botId})` — needs secrets; stops any running instance; calls deploy agent with env BOT_TOKEN/ADMIN_ID, 5-min hard kill, low CPU/RAM (nice + ulimit); sets running + expiry.
- `tempHostStatus({botId})` — reads DB; if past expiry marks stopped; pulls agent logs into `test_log`.
- `stopTempHost({botId})`.
- Admin: `getButtonEmojis` / `saveButtonEmojis`.

### Deploy agent (`public/deploy-agent.js`)
- Python-only test runner: venv, `pip install -r requirements.txt`, `python bot.py`, one instance per bot, SIGKILL at 5 min, crash output kept for logs.

### UI files
- Rewrite `bot.$botId.tsx` into a studio shell; new components: `StudioTopBar`, `ProjectsPanel`, `PlanCard`, `BuildProgress`, `SecretsCard`, `HostActions` (chip + countdown), `FilesPanel` (highlight.js, already styled), `VersionsSheet`.
- Theme tokens updated in `src/styles.css`; fonts linked in `__root.tsx`.
- Admin settings page gets the emoji map editor.

### Build order
1. Token/Admin gate + encrypted save
2. Temp host 5 min + DB status + refresh-safe chip
3. HexaHoster button
4. Brain write on fix / read on build
5. Premium emoji defaults + generator template
6. Studio UI (3-column, plan card, timer, stop, versions, rename, files panel)
