# Hexa AI → Telegram Python Bot Builder only

The app stops being a website builder. Users chat, approve a plan, and download a ready Python Telegram bot.

## What users will see
- Landing page rewritten for bots: "বাংলায় বলুন, Telegram বট বানিয়ে নিন", bot examples, pricing, FAQ.
- Dashboard: only bot projects. "নতুন বট" opens a short name dialog (no website/Node choice).
- Bot page: chat (plan → popup questions → approve → build), file viewer, and a big **"ফাইল ডাউনলোড করুন (ZIP)"** button.
- Fix chat edits only the parts of `bot.py` that need changing, not a full rewrite.
- Admin panel stays (users, payments, AI providers, plans, limits, settings, analytics); site-only admin pages (assets, moderation of sites) hidden.

## Bot output standard (AI always follows)
- Files: `bot.py` (single file by default), `requirements.txt`, `.env.example`, `README.md` (run locally, VPS, Railway, Render).
- Python 3.10+, `python-telegram-bot` v20+ by default; `requests` long-polling only if asked.
- Storage `data.json` by default; MongoDB (`MONGODB_URI`) only if asked.
- Secrets only from env: `BOT_TOKEN`, `ADMIN_ID`, `LOG_CHAT_ID`, `FORCE_CHANNEL` — never hardcoded.
- "Pages" become bot menus/handlers.

## Removed / hidden
- Website generation, React/Vite builds, site preview, publishing, custom domains, site hosting routes, site backend (hexaDB), GitHub export, site assets.
- Node.js bot option and VPS test/live running (users host bots themselves). Token / Admin ID panel removed — they go in `.env`.
- Database tables are kept (marked deprecated), nothing deleted.

## Technical details
- Delete routes: `builder.$projectId`, `s.$subdomain`, `api/public/site`, `api/public/db.*`, `site-oauth`, `uploads.*`, `oauth.github.return`, site admin pages; remove site components (DomainDialog, GithubDialog, BackendDialog, AssetPanel, VersionsDialog, NewProjectDialog website path).
- `generate.ts` / job runner: drop site pipeline; bot generation stays in `bot.functions.ts` (plan JSON questions/plan, build returns files JSON).
- New "fix" mode: AI returns search/replace edits for `bot.py`, applied server-side; falls back to full file if a patch fails.
- ZIP download built in the browser (add `fflate`).
- Cron expiry: only plan downgrade; site hosting cleanup removed. Deploy agent bot endpoints left unused.
- Migration comments: mark site columns/tables DEPRECATED; `bots.language` default `python`.
- AGENTS.md and project knowledge rewritten for the bot-only product.

Note: the uploaded instructions file ends after the env list; if more rules were intended (force-join, logging format, etc.), send them and they'll be added.
