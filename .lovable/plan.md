# বিল্ড আসলে চলছে না — কারণ ও প্রফেশনাল সমাধান

## যা দেখা গেল (ডাটাবেস থেকে নিশ্চিত)
- আপনার শেষ বিল্ড শুরু হয়েছে 08:13:10-এ। 08:13:13-এ শেষ ধাপ লেখা হয়েছে: "AI কোড লিখছে…"। তারপর থেকে সার্ভার থেকে আর কোনো সাড়া (heartbeat) আসেনি।
- মানে AI কোড লেখা শুরুর ৩ সেকেন্ডের মধ্যেই সার্ভারের কাজটা বন্ধ হয়ে গেছে। স্ক্রিনের টাইমারটা শুধু সময় গুনছে, ভিতরে কোনো কাজ হচ্ছে না। এটা আপনার AI মডেলের ধীরগতির কারণে নয়।
- কাজ মরে গেলে প্রতি মিনিটে আবার চালু করার যে "সার্ভার-ঘড়ি" থাকার কথা, সেটা এই নতুন প্রজেক্টে সেট করাই হয়নি। তাই বিল্ড আর কখনো আবার শুরু হয় না।
- প্ল্যান মেয়াদ চেক করার ঘড়িটা এখনো আপনার পুরনো প্রজেক্টের ঠিকানায় যাচ্ছে।
- কেন মরে: বিল্ডটা চলে "বিল্ড শুরু" অনুরোধের ভেতরেই। সেই অনুরোধের উত্তর চলে যাওয়ার পর সার্ভার বাকি কাজটা কেটে দেয়। ওয়েবসাইট বানানোর পুরনো সিস্টেম আলাদা পথে চলত, তাই সেখানে এই সমস্যা হতো না।

## সমাধান
1. **বিল্ড সবসময় নিজের আলাদা সার্ভার-অনুরোধে চলবে।** "বিল্ড শুরু" চাপলে শুধু একটা কাজ তৈরি হবে, আর ডাটাবেস নিজে একটা আলাদা অনুরোধে সেটা চালু করবে। আগের ওয়েবসাইট বিল্ডারও এভাবেই চলত। এতে আপনার ফোন বা অনুরোধ বন্ধ হলেও বিল্ড থামবে না।
2. **প্রতি মিনিটের সার্ভার-ঘড়ি চালু করা।** ঘড়িটা এই প্রজেক্টের ঠিকানায় সেট হবে। কোনো বিল্ড ৩ মিনিট সাড়া না দিলে সেটা আবার শুরু হবে (সর্বোচ্চ ৩ বার)। পুরনো প্রজেক্টে যাওয়া মেয়াদ-ঘড়িটাও ঠিক করা হবে।
3. **আসল অগ্রগতি দেখানো, ভুয়া টাইমার নয়।** AI লেখার সময় প্রতি ~১৫ সেকেন্ডে দেখাবে কত লাইন বা কত অক্ষর লেখা হলো (যেমন "app.py — 840 লাইন লেখা হয়েছে")। ৯০ সেকেন্ড কোনো নতুন লেখা না এলে বাংলায় দেখাবে "সার্ভারের সাড়া নেই — আবার চালু করা হচ্ছে"।
4. **আটকে থাকা এখনকার বিল্ডটা** "ব্যর্থ" দেখাবে, সাথে "আবার চেষ্টা করুন" বাটন। কোনো কয়েন কাটা হয়নি।
5. **লম্বা বটের জন্য** (২–৩ হাজার লাইন): উত্তর মাঝপথে কেটে গেলে বাকিটা লেখানোর ব্যবস্থা (auto-continue) আগের মতোই থাকবে। প্রতিটা অংশ লেখার সাথে সাথে সেভ হবে, তাই বিল্ড আবার শুরু হলে একদম গোড়া থেকে শুরু করতে হবে না।

## সময় নিয়ে প্রত্যাশা
ঠিক হওয়ার পর ২–৩ হাজার লাইনের app.py-তে সাধারণত ৫–১৫ মিনিট লাগবে, আপনার AI মডেলের গতির ওপর নির্ভর করে। পুরো সময় স্ক্রিনে লাইন সংখ্যা বাড়তে দেখবেন।

## Technical details
- Data: mark job `10284b97…` failed.
- New server route `/api/public/bot-job-run`, verified with an HMAC over the job id using `app_secrets.job_token` (the same pattern as `kick_job`). `startBotBuild` inserts the row, then calls a new SQL function `kick_bot_job(id)` that uses `net.http_post` to that route with a long timeout. No inline run anymore.
- pg_cron: `hexa-bot-jobs` runs every minute and calls `/api/public/cron/process-jobs` on the published origin. Fix `hexa-expiry-hourly` so it points at the published URL. Both are saved as rerunnable SQL in `supabase/migrations/`.
- `bot-build.server.ts`: inside the stream loop, write progress events (chars/lines) and the heartbeat at most every 15s. Keep the partial text in the job `result` so a re-claimed run resumes through the continuation prompt. Add an idle-stream watchdog (90s without bytes → abort → retry). Keep the existing 10-minute cap per call and per continuation chunk.
- Studio: render the latest progress event and show a "stalled" state when the heartbeat is older than 2 min.
- Check `job_token` exists in `app_secrets`; insert it if missing.
- Verify by running a real build and watching events grow in `bot_jobs`.
