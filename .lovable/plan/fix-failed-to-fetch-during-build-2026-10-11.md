# Fix "Failed to fetch" during Build

## Root cause (confirmed from server logs)
The build request at 17:57:09 and 17:59:03 ended with status **0** — the connection was cut before the server answered. It was not an AI or code error.

Why: the whole Build (AI writing bot.py, auto-continue, preserve check, repair round) runs inside **one silent request**. The server sends nothing back to the phone until everything is finished (often 2–5 minutes). Connections that stay silent that long get dropped by the network edge, and mobile Chrome also drops them when the screen dims or the tab goes to background. When the connection drops, the server work is cancelled too, so nothing is saved and the browser shows "Failed to fetch".

## Fix
1. **Live streaming build** — Build switches from the silent request to a streaming endpoint that sends a small "still working" signal every ~8 seconds plus real progress steps (writing code, checking features, repairing, saving). The connection never sits idle, so it is not dropped.
2. **Result is saved on the server first** — the final bot files, version and coins are written before the "done" message is sent (same as now), and each build gets a status row (running / done / failed + reason).
3. **Recovery if the connection still drops** — instead of "Failed to fetch", the studio checks the saved build status for up to ~2 minutes: if the build finished, it loads the new files automatically; if it failed, it shows the real Bangla reason. Refreshing the page also restores the result.
4. **Keep the phone awake** — while building, the studio asks the phone to keep the screen on, and shows a short note: "বিল্ড চলাকালীন অ্যাপ খোলা রাখুন".
5. **Clear error text** — any network drop shows "সংযোগ বিচ্ছিন্ন হয়েছে — বিল্ড স্ট্যাটাস চেক করা হচ্ছে..." instead of the English "Failed to fetch". No coins are taken unless the build is saved.

Plan mode (short replies) stays as it is.

## Technical details
- New server route `src/routes/api/public/bot-build.ts` (POST, verifies bearer token via `supabaseAdmin.auth.getUser`, checks bot ownership). Reuses the existing build logic from `botChat` by extracting it into a shared `runBotBuild(db, userId, data, emit)` in a `*.server.ts` module; `botChat` keeps working for plan mode.
- Response: `application/x-ndjson`, events `{t:"ping"}` every 8s, `{t:"step", step}`, `{t:"done", ...result}`, `{t:"error", msg}`.
- Status tracking uses the existing `generation_jobs` table (status, events, heartbeat_at) keyed to the bot; client polls the existing `getJob` server function after a disconnect.
- Client (`bot.$botId.tsx`): fetch + stream reader with session token, Screen Wake Lock API (released in `finally`), fallback polling, Bangla network-error message.
- Workers runtime: work stays tied to the open stream (no `waitUntil` for multi-minute jobs).
- Verify: Playwright build on the Shop bot with a throttled/aborted connection; `bunx vitest run src/test`.
