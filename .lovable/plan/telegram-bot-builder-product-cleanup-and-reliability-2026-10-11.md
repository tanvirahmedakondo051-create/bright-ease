# Telegram Bot Builder product cleanup and reliability

The product remains Telegram Python bot creation only: Plan → Approve → Build → ZIP, with optional five-minute testing and HexaHoster as the permanent-host link.

## 1. Fix BOT_TOKEN and ADMIN_ID saving first

- `src/lib/bot.functions.ts`
  - Put a short timeout around Telegram `getMe`, so a slow Telegram connection cannot leave the form spinning for minutes.
  - Return separate results for invalid credentials, Telegram unavailable, encryption/configuration failure, and database save failure.
  - Confirm the database update succeeded before reporting success; never log or return token content.
- `src/components/studio/StudioParts.tsx`
  - Add a visible timeout/error state and re-enable the save button reliably.
  - Preserve the already-saved token when only ADMIN_ID is changed.
- `src/routes/_authenticated/bot.$botId.tsx`
  - Refresh the saved-status immediately after success and resume the pending Build/Test action only after the save is confirmed.

## 2. Simple global Premium emoji IDs

- `src/routes/_authenticated/admin.settings.tsx`
  - Replace the mixed website settings screen with bot-product settings only.
  - Show a simple editable list of `key` + `emoji id`, with **Add row** and **Save**.
  - Keep empty IDs as normal-emoji fallback and deduplicate identical key/ID rows.
  - Keep support details, HexaHoster URL, and the VPS test-agent controls; remove website database, OAuth callback, domain, nameserver, nginx, Pexels, and site-expiry blocks.
- `src/lib/admin.functions.ts`
  - Add admin-only load/save functions for the global emoji map and bot settings, with server validation.
- `src/lib/bot.functions.ts`
  - Continue injecting the saved map as `BUTTON_EMOJIS` into every new build.
  - Extract custom emoji IDs and associated keys from successful generated/fixed `bot.py`, merge unseen entries into the global map, and deduplicate them. The same extractor will be reusable if bot-code upload is added later.

## 3. Bot-centric plans and enforceable limits

- Database migration plus safe-to-rerun migration copy:
  - Add plan fields: `daily_ai_messages`, `max_bot_projects`, `temp_host_minutes_per_day`, `max_fix_requests_per_day`, and `zip_download_allowed` with safe defaults.
  - Add a per-user/day bot usage table for AI requests, fixes, and temp-host minutes, with authenticated owner-read access and server-only writes.
  - Mark old site-only plan fields deprecated rather than breaking the live database by deleting them.
- `src/routes/_authenticated/admin.plans.$id.tsx`, `admin.plans.index.tsx`, `admin.limits.tsx`
  - Replace published-site, HTML, custom-domain, badge, site QA, and site publish controls with the bot limits above, coin settings, AI-provider selection, and ZIP permission.
- `src/lib/bot.functions.ts`, `src/lib/plan.server.ts`, `src/components/site/Pricing.tsx`, `src/routes/_authenticated/dashboard.tsx`
  - Enforce project, daily AI/fix, temp-test-minute, and ZIP permissions where actions occur.
  - Display bot-focused plan benefits and usage; no permanent hosting promise.

## 4. Bot-only admin and analytics

- `src/routes/_authenticated/admin.tsx`
  - Keep Users, Payments/Coins, AI Providers, Plans, Limits, Analytics, and Settings.
- `src/routes/_authenticated/admin.index.tsx`, `admin.analytics.tsx`, `admin.users.tsx`
  - Replace legacy website/project metrics with bot counts, successful builds/fixes, token/coin usage, and temporary-test usage.
  - Count user projects from `bots`, not legacy website rows.
- Add an admin Brain view with search over Telegram-bot error signatures, symptoms, and fixes; link it from the admin navigation.

## 5. Professional motion home page

- `src/routes/index.tsx`, `src/components/site/Brand.tsx`, `src/styles.css`, `src/components/site/SiteHeader.tsx`
  - Build a mobile-first premium hero using the existing black/red/green tokens.
  - Use a subtle animated grid/particle field and slowly floating bot/chat/code symbols, with reduced-motion support and no heavy video.
  - Use the literal CTA **“বট বানানো শুরু করুন”** and a compact **Plan → Build → ZIP → ৫ মিনিট টেস্ট** flow.
  - Remove website wording from shared metadata, footer fallback copy, and pricing text.

## 6. Platform-wide bot Brain and strict scoped fixes

- `src/lib/bot.functions.ts`
  - Keep relevant Brain retrieval on every Plan/Build/Fix.
  - Save a short Brain row after each successful scoped fix, including test-log failures; include optional safe snippets.
  - Record failed build signatures when available, then attach the resolved fix after a later successful repair.
  - Treat an existing `bot.py` as scoped-fix mode unless the user explicitly says **“পুরো বট আবার বানাও”**.
  - Reject a fix response that attempts full-file replacement; require exact search/replace patches and report touched sections.
- `AGENTS.md`
  - Make bot-only generation, no secrets in files, platform Brain use, and strict scoped-fix behavior permanent project rules; remove the legacy site-expiry rule.
- `src/routes/api/public/cron/expiry.ts`
  - Reduce expiry handling to plan downgrade only; remove legacy website notice/offline/deletion work.

## Verification

- Test token save success, invalid token, Telegram timeout, and retry behavior without exposing credentials.
- Verify Plan → secret gate → Build → ZIP, scoped Fix, version snapshot, and five-minute status restoration.
- Verify emoji add/save/load/injection/automatic merge and normal fallback.
- Verify each plan limit at its boundary and bot-only admin analytics.
- Check the animated home and studio on mobile and desktop, with reduced motion, then confirm the build and relevant tests are clean.

## Important runtime note

The five-minute test continues to run through the existing VPS agent. The product will not claim permanent hosting; its permanent-host action only opens `https://hexahoster.xyz` (or the admin-configured HexaHoster URL).
