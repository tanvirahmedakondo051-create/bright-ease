- Product is a Telegram Python bot studio only: bots live in `bots`; generation creates only app.py/requirements.txt/README.md (Hexa Boost Panel package; legacy bot.py is renamed via normalizeFiles); Chat mode is free and never writes files, uses Plan → Approve → Build → ZIP, and never writes secrets into files — this is the entire product boundary.
- BOT_TOKEN/ADMIN_ID are stored encrypted per bot and required before Build; the 5-minute test runs on the VPS deploy agent, with status/expiry persisted on `bots.temp_*` so a refresh restores the Online chip.
- Generated bots embed global `site_settings.button_emojis` defaults as BUTTON_EMOJIS/TEXT_EMOJIS with normal emoji fallback; Premium mode covers every user/admin button and meaningful emoji-bearing text, all admin controls are inline-only, and successful generated/fixed code merges new button/text custom IDs into that platform library.
- Changes to an existing bot.py send the full current files and receive a complete new bot.py in `=== FILE ===` blocks (never JSON-embedded code); it is saved only if `preserve-check` finds no dropped functions/commands/callbacks and no truncation, with one repair round and auto-continue on cut-off replies — avoids both patch-mismatch failures and silent regressions.
- Every Plan/Build/Fix receives relevant platform-wide Telegram bot lessons from `bot_brain`, and successful fixes save short error/fix entries — repeated mistakes are avoided across users.
<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- AuraPay requests follow the official plugin format (`API-KEY` header, `cus_name/cus_email/success_url`, verify by `transaction_id`, our row id in `metadata.payment_id`) — the only format AuraPay accepts.
- Coin balances change only through the security-definer `add_coins` SQL function (service role) which also writes `coin_transactions`; a trigger blocks user edits to `profiles.coins` and daily refill runs as a pg_cron SQL job — keeps the ledger and balance consistent and tamper-proof.
- Plan expiry runs via pg_cron → `/api/public/cron/expiry` and only returns expired accounts to the default plan; it never hosts, takes offline, or deletes bot projects.
- Bot AI calls go through admin-configured providers (`plan.server.ts` `allowedProviders`) and charge coins per call from `site_settings.tokens_per_coin` — admins control models and cost.
- Every database schema change must also be saved as a safe-to-rerun SQL file in supabase/migrations/ — self-hosted databases only run that folder.
- Never list `.env` in `.gitignore` — it holds only publishable connection values, and builds made from the saved project (preview link, published site) crash without them.
- Bot builds run as background jobs: `startBotBuild` inserts a `bot_jobs` row and runs `processBotJob` inline; the per-minute cron route `/api/public/cron/process-jobs` re-claims jobs whose heartbeat is stale (>3 min, <3 attempts). Client polls `botJobStatus` every 3s and resumes via `activeBotJob`. Build logic lives in `src/lib/bot-build.server.ts` (`runBotChat` shared by `botChat` plan mode and jobs); coins only on successful save so re-runs are safe.
