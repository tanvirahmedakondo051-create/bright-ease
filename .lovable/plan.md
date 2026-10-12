# Parallel sub-agent Build (faster large bots)

## What users will see
- Plan and Chat mode stay the same. Chat stays free, never writes code, and never uses sub-agents.
- When Build starts on a big bot, a **task list** appears in the studio:
  - `Core` — shared helpers, emoji, data, start-up
  - `User shop` — categories, products, cart, checkout, my orders
  - `Admin panel` — dashboard, orders, products, coupons, users, broadcast, emoji settings
  - `Packaging` — requirements.txt, README for Hexa Boost Panel
  - `Merge & check` — one final app.py

  Each task has a chip (queued / running / done / failed), a line count, and a total timer.
- The user and admin parts are written **at the same time**. A 2–3 thousand line bot should take about half the time.
- If one part fails, only that part has a **retry** button. Finished parts are kept.
- Stop cancels every part at once. Coins are charged only once, after the final app.py is saved.
- Small bots and small fixes stay on the current single-pass path. A fix only splits when the request touches clearly separate sections.

## How it works
```text
Build -> Planner (small, fast call): split approved plan into 2-4 sections
      -> Core sub-agent: helpers, BUTTON_EMOJIS/TEXT_EMOJIS, ik_btn/rk_btn,
         data.json store, admin guard, callback prefixes contract
      -> in parallel (each its own server run, max 3 at once):
           User section | Admin section | Packaging
      -> Merge (code, not AI): one app.py in fixed order
           core -> user handlers -> admin handlers -> register_handlers -> main
      -> Checks: preserve-check, duplicate function/callback names,
         every callback prefix has a handler, BOT_TOKEN/ADMIN_ID only from env
      -> If a check fails: one AI repair pass on the merged file only
      -> Save + version snapshot + coins + ZIP ready
```
- Each sub-agent gets only the plan, the Core "contract" (helper names, data keys, callback prefixes, emoji keys) and its own section rules. It never gets the whole chat history, so the requests are smaller and faster.
- Bot standards stay the same in every part: app.py, premium emoji and colour on inline and reply buttons, nested inline admin (Admin Home -> submenus -> Back), Hexa Boost Panel wording, and secrets only from env.

## Technical details
- New table `bot_subtasks` (job_id, key, title, status, attempts, output, lines, error, heartbeat_at), with owner-read RLS through bot_jobs, server-only writes, and a rerunnable copy in `supabase/migrations/`.
- `bot-build.server.ts`:
  - `planSections()`: a short JSON planner call. It decides split vs single pass (split when the plan has 6 or more features or an admin panel plus a user flow).
  - `runSubtask(id)`: one section per call, streams with progress, and stores its output in `output`.
  - `mergeSections()`: a deterministic concatenation, plus a generated `register_handlers` from each section's declared handler list (in a `=== HANDLERS ===` block).
  - The existing preserve-check and repair round run on the merged file.
- Each subtask runs in its own server request via `kick_bot_job`-style pg_net calls to `/api/public/bot-job-run?sub=<id>`, HMAC-verified. This avoids the per-request connection and time limits. The parent job moves to merge when all subtasks are done. The existing sweeper re-kicks stale subtasks (max 3 attempts each).
- Concurrency cap: 3 running subtasks per job, so providers don't rate-limit.
- Coins: each subtask's tokens add up, and the charge happens once at the final save. Nothing is charged on failure.
- `jobs.functions.ts`: `botJobStatus` returns the subtasks. Add `retrySubtask` (owner-checked). Cancelling marks all subtasks cancelled.
- Studio (`bot.$botId.tsx` / `StudioParts.tsx`): task list with chips, per-part line count, retry on failed parts, and an optional per-part "দেখুন" output preview.
- `AGENTS.md`: "Prefer sub-agents for independent Build sections; always merge and check before delivery; Chat never uses sub-agents."
- Tests: merge order, handler registration, duplicate-name detection, and skipping the split for small plans.

## Notes
- This only helps once builds run in the background on the published site, so publish after the previous fix.
- Running parts in parallel uses roughly the same total AI tokens, plus a small planner and contract cost (about 5–10% more).
