# Fix the recurring "পেজটি লোড হয়নি" error

## What's happening
The error comes back from time to time because some copies of the app get built **without the database connection settings**. When that copy opens, the app cannot reach the database, so the whole page fails with "Missing Supabase environment variable(s)".

The cause is in the uploaded project: it came with an ignore rule that keeps the connection settings file out of the saved project. The live editor preview has the file, so it often works. The separately built preview link and the published site never get it, so every time one of those builds is used, the page breaks.

These settings are only the public connection address and public key. They are safe to keep in the project. Private keys stay hidden on the server.

## Fix
1. Remove the `.env` line from the project's ignore list so the connection settings are saved with the project and included in every build.
2. Check the build logs and open the home page, dashboard and a bot page to confirm none of them show the error.
3. Ask you to press Publish once so the published site is rebuilt with the settings.
4. Add a rule to AGENTS.md: the `.env` file must never be ignored, because builds need its public settings.

## Technical details
- `.gitignore` line 33 (`.env`) causes `git check-ignore` to match `.env`, so `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` are absent from builds made from the repo (the `id-preview--…lovable.app` bundle `index-m6TFSJVN.js` and the published build both throw from the generated client during root render).
- `.env` holds only publishable values and is auto-managed; the generated client is not edited.
