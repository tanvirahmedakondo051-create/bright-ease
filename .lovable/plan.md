# Fix login and sign-up

## What is happening now
- One Google sign-in did work: your Gmail account was created and is already the admin.
- The "Authorization failed / State verification failed" screen shows when a Google sign-in is started twice, or started in one window and finished in another (common on mobile Chrome). The second try then breaks.
- Email sign-up currently waits for a confirmation email. Right now that email would come from a general sender, not your website's name, because no email domain is set up for your site.

## What will change
1. **Google login works the same everywhere** - on the preview, the published site and your own domain. The extra "self-hosted" path that could fail is removed.
2. **No double taps** - the Google button locks after the first tap, so a second sign-in can't start and break the first.
3. **Safe return after Google** - after Google sends you back, the app waits for the sign-in to finish, then opens your dashboard. No more getting stuck on the login page.
4. **Clear Bangla error and retry** - if Google is cancelled or fails, you get a clear message and can try again, not a dead error page.
5. **Email sign-up without confirmation (for now)** - your site has no email domain yet, so sign-up will log people in straight away, with no email link. Later, when you connect your own domain for email, email confirmation can be turned back on so the emails come with your site's name.
6. **Forgot password** keeps working through the reset page.
7. **Check it end to end** - test sign-up, logout, email login and the dashboard opening in a real browser.

## Technical details
- `AuthCard.tsx`: always call `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/login" })`; remove the raw `supabase.auth.signInWithOAuth` branch; keep a busy guard; map errors to Bangla toasts.
- `/login` and `/signup`: keep the session-aware redirect to `/dashboard`; after OAuth returns, wait for `getSession()` before navigating.
- Auth config: `auto_confirm_email: true`, keep sign-up enabled, keep anonymous users off, keep the leaked-password check on.
- Sign-up handler already goes to `/dashboard` when a session comes back.
- Root `onAuthStateChange` (SIGNED_IN/SIGNED_OUT only) calls `router.invalidate()` so the header and protected pages update without a reload.
