# Build error, settings save, login/signup, and AI upgrade

## 1. Build stopping with an error (investigate first)
The exact error text is not in the screenshot, so step one is reading the server logs and the bot's last chat messages to find the real cause. Likely suspects to check:
- The AI call timing out (current limit ~170s) on long bot.py builds.
- The AI reply getting cut off mid-file, so it can't be read.
- Coins/daily limit hit mid-build.

Fixes:
- Show the real reason in Bangla in chat (not a generic error), with a "আবার চেষ্টা করুন" button.
- Resume a stopped build from where it stopped instead of restarting.
- Split large builds into smaller steps so one slow reply can't kill everything.
- Refund coins when a build fails because of our side.

## 2. "সব সেটিংস সেভ করুন" stuck spinning (screenshot)
- Add a time limit and a clear success/error toast so the button never spins forever.
- Check the save request for the failing field and fix it.

## 3. Login / Signup pages
- Redesign in the dark Hexa style (red/green), mobile-first, Bot-builder copy (remove old "website" wording).
- Show/hide password, forgot-password link plus a new reset-password page.
- Clear Bangla errors, loading states, "check your email" screen after signup.
- Google sign-in kept and tested.

## 4. Ways to upgrade the AI (to add)
- Self-check: after building, the AI re-reads bot.py and runs a Python syntax check on the VPS agent, fixing errors automatically before showing "Ready".
- Telegram Bot API reference snippets (buttons, payments, premium emoji) given to the AI on every build.
- Brain: rank lessons by how often they helped; auto-save lessons from failed builds too.
- Model fallback: if one AI provider fails or times out, try the next one automatically.
- Reusable bot templates (shop, referral, support) as a starting point for faster, more reliable builds.

## Technical details
- Inspect `stack_modern--server-function-logs`, `bot.functions.ts` build path (`AbortSignal.timeout(170_000)`), and `admin.settings.tsx` save mutation.
- Add `/reset-password` public route; update `AuthCard.tsx`.
- Provider fallback in `plan.server.ts`; syntax check via deploy agent `python -m py_compile`.
