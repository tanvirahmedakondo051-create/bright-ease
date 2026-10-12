# Fix "টোকেন সেভ করার সেটআপ সম্পূর্ণ নয়"

## Cause
Before saving, the bot token is encrypted with a private key. That key existed in your old project but was never added to this new one, so every save is blocked. The 5-minute test uses the same key, so it fails too.

## Fix
1. Create a new random private encryption key on the server. You don't have to type anything, and the value never appears in chat.
2. Nothing else changes. After this, "সেভ করে চালিয়ে যান" saves the token and Admin ID, and Build and the 5-minute test continue as normal.
3. Check that saving works with a test token.

## Technical details
- `bot.functions.ts` reads `process.env.APP_USER_CONNECTION_KEY_SECRET` (lines 246 and 312). It is missing from the project secrets.
- Generate it with `secrets--generate_secret`. No code change is needed.
- No tokens were saved before, so there is nothing old to re-encrypt.
