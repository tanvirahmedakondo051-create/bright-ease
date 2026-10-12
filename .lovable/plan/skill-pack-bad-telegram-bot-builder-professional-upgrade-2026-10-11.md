# Skill pack bad + Telegram Bot Builder + Professional upgrade

## 1. Skill pack system remove
- Admin menu theke "Skills" page o link sorano.
- Builder theke skill pack picker button/dialog sorano.
- AI prompt e skill pack text add kora bondho (GitHub import context thakbe).
- Database table/column delete hobe na (safe), shudhu "deprecated" mark kora hobe.

## 2. Telegram Bot Builder (notun mode)
Dashboard e "নতুন সাইট" er pashe "নতুন বট" button. Bot o ekta project, tai chat, coin, history, version sob site er motoi kaj korbe.

Flow:
```text
User prompt -> Plan (ki ki command/feature) -> Build (Node.js ba Python code)
   -> Test server e temporary chalu (5-30 min) -> Telegram e test
   -> Fix chat -> "লাইভ করুন" -> apnar VPS e 24/7 chalu
```

Builder screen (bot er jonno):
- Bam pashe chat (plan/build mode same).
- Dan pashe preview er bodole: Files, Live logs, Status (running/stopped), Test button, Bot token box.
- Language select: Node.js (telegraf) ba Python (python-telegram-bot / aiogram).
- Bot token encrypted kore save hobe, kokhono browser e ferot jabe na.
- Error hole log AI ke pathiye "auto-fix" button.

Test vs Live:
- **Test**: deploy agent er alada sandbox folder e, unprivileged user, time-limit o memory-limit soho chalu; time shesh hole nije bondho.
- **Live**: same VPS agent e permanent service hisebe (auto restart, log rotation). Stop / Restart / Delete control.
- Plan expiry hole bot o site er moto offline/delete hobe.
- Coin: site er moto protiti AI step e katbe.

Note: amader web server (Worker) Node/Python process chalate pare na, tai "test server" o apnar deploy agent er sandbox mode e cholbe. Pore chaile alada test VPS er address admin settings e dite parben.

Purano `bot-builder` page (jeta na-thaka API call kore) sorano hobe.

## 3. Lovable-er moto professional korar tips (plan e add kora)
1. **Streaming reply** - AI likhte likhte text dekhabe, step list (Thinking -> Planning -> Writing -> Checking) live.
2. **Version history timeline** - protiti build er pore snapshot, ek click e restore (already ache, UI sundor kora).
3. **Visual edit** - preview e element click kore text/color bodlano.
4. **Auto error fix** - preview/bot crash hole "Try to fix" button.
5. **Template gallery** - landing, shop, portfolio, bot template theke shuru.
6. **Onboarding** - prothom bar e 3-step guide o example prompt chip.
7. **Mobile-first builder** - chat/preview toggle tab mobile e.
8. **Share preview link** - publish chara preview link share.
9. **Usage meter** - coin koto lagbe build er age estimate.
10. **Landing page polish** - real showcase, pricing tulona, FAQ, testimonial.

Ei round e 1, 4 o bot builder kora hobe; baki gula porer dhape (apni bolle aage korbo).

## Technical details
- Migration: `projects.project_type` e `bot` value, `bot_language`, `bot_token_enc` (AES-GCM, server only), `bot_status`, `bot_mode (test|live)`; `bot_logs` table (RLS: owner read). Also saved in `supabase/migrations/`.
- `generate.ts`: bot type hole bot system prompt, `files` JSON return (React project er moto).
- `deploy-agent.js`: notun HMAC endpoints `/bot/start` (test|live), `/bot/stop`, `/bot/logs`; npm/pip install `--ignore-scripts`/venv, `hexabuild` user e run, test mode e timeout.
- `bot.functions.ts`: start/stop/logs/token save (requireSupabaseAuth + owner check).
- Skill pack: `admin.skills.tsx`, `src/lib/skills.ts` delete; builder o generate.ts theke reference sorano; `COMMENT ON TABLE skill_packs IS 'DEPRECATED'`.
- AGENTS/project knowledge rule update kora hobe (skill pack line bad, bot rule add).
