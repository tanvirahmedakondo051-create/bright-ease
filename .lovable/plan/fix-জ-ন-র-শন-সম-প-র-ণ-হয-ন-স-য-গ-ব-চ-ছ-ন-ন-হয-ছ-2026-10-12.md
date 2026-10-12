# Fix "জেনারেশন সম্পূর্ণ হয়নি — সংযোগ বিচ্ছিন্ন হয়েছে"

## What the data shows
- The last build (10:46) finished and saved: 5:02, 7 coin. That is the green card above the error.
- After it, no new job was created and no new message was saved. So the next request broke on the way, before the server could save it. No files or coins changed.
- The red message only appears when the phone's request to the server drops ("Failed to fetch"). Chat and Plan still run inside one long live request. On a 2,500-line bot, the AI can take several minutes. A mobile network switch, a locked screen or a server time limit cuts it off.
- Builds don't have this problem, because they already run in the background.

Diagnosis is partly unconfirmed. Exactly which request dropped (Chat or Plan) isn't logged, so step 1 adds that log.

## What changes
1. **Chat and Plan run in the background too**, the same way as Build. Tapping send creates a job and the screen watches it. A dropped connection, locked screen or refresh no longer loses the answer. When the screen comes back, it picks up the running job and shows the reply.
2. **A connection drop isn't treated as failure.** If one status check fails, the screen quietly retries for up to 2 minutes ("সংযোগ ফিরছে…"). The red error shows only if the job itself failed.
3. **Clear error wording.** The red card says what actually happened: the internet dropped, the AI didn't respond, or the server had a problem. The real reason is saved with the job so it can be checked later.
4. **Chat stays free and never writes files.** Plan questions and the plan card work exactly as now.

## Technical details
- `bot_jobs.input.mode` already exists. `processBotJob` will also run `chat` and `plan` jobs through `runBotChat`, storing the result (reply, questions, plan, needsBuildFix, fixBrief) in `bot_jobs.result`. Chat doesn't charge coins, as today.
- New server function `startBotChatJob` (same checks as `startBotBuild` minus the secrets check), kicked via the existing `kick_bot_job` RPC with inline fallback.
- `bot.$botId.tsx`: `send()` uses jobs for every mode, and `watchJob` handles chat/plan results (questions dialog, fix offer). Poll errors are retried with backoff for up to 120s before an error shows. `activeBotJob` resume covers all modes.
- The error message is chosen from `job.error` first. The generic network text is used only when no job id was ever returned.
- Log the mode and the failure stage server-side (`console.error("bot job", mode, stage)`).
- Tests: a job result maps to the right UI outcome (chat reply, questions, plan), and a transient poll error does not end the watch.

## Verification
- tsgo + vitest.
- Playwright on mobile size: send a Chat message, block the network for 20s mid-answer, restore it, and the reply still appears with no red card.
- Then publish, because the live site needs the change.
