# Bot Builder flow, reliability, auth colours, and animated home

## 1. Plan approval সত্যিকারের Build mode করবে
- `src/routes/_authenticated/bot.$botId.tsx`
  - **অনুমোদন করুন** চাপলেই আগে selected mode `Build` হবে, তারপর approved plan দিয়ে build শুরু হবে।
  - Build চলাকালে header toggle, composer label, progress card—সব জায়গায় একই mode দেখাবে।
  - সফল build-এর পরে Build mode থাকবে; plan edit চাপলে তবেই Plan mode-এ ফিরবে।
  - request ব্যর্থ হলে পরিষ্কার error card ও **আবার চেষ্টা করুন** action থাকবে; পুরোনো plan/code হারাবে না।
- `src/components/studio/StudioParts.tsx`
  - Plan progress-এ “Writing bot.py” আর দেখাবে না; Build progress-এ Planning → Writing bot.py → Ready দেখাবে।
  - stopped/failed state-কে spinning progress হিসেবে আটকে রাখা হবে না।

## 2. হঠাৎ AI error-এ build বন্ধ হওয়া নির্ভরযোগ্যভাবে সামলানো
- `src/lib/bot.functions.ts`
  - নিশ্চিত হওয়া `502/504/524` provider failure-কে transient error হিসেবে ধরে সীমিত retry/backoff এবং configured next-provider fallback করা হবে।
  - provider-এর streaming/non-streaming response নিরাপদে parse করা হবে; অসম্পূর্ণ JSON কখনো bot files overwrite করবে না।
  - ব্যর্থ build-এর নির্দিষ্ট, বাংলা, retryযোগ্য message ফেরত দেবে এবং Brain-এ ছোট failure lesson রাখবে।
  - Plan অনুমোদনের content build prompt-এ স্পষ্টভাবে যাবে, যাতে AI আবার plan না লিখে সরাসরি bot files তৈরি করে।
  - সফল response ছাড়া coin/build usage charge হবে না; cancellation check retryগুলোর মাঝেও মানা হবে।

## 3. Login / signup colour ও visual consistency
- `src/components/site/AuthCard.tsx`, `src/components/site/Brand.tsx`, `src/styles.css`
  - বর্তমান অসামঞ্জস্যপূর্ণ cyan/orb treatment সরিয়ে product palette-এর near-black, red primary, green success/accent ব্যবহার করা হবে।
  - Google, password visibility, forgot password এবং submit controls existing design-system buttons/colours-এ আনা হবে।
  - mobile-এ contrast, field focus, error/success message এবং disabled/loading state পরিষ্কার করা হবে।
- `src/routes/login.tsx`, `src/routes/signup.tsx`
  - প্রয়োজনীয় social metadata পূর্ণ রাখা হবে; auth behavior বদলানো হবে না।

## 4. Front page-এ animated PNG-style visual layer
- নতুন transparent bot/chat/code artwork তৈরি করে project asset হিসেবে যোগ করা হবে।
- `src/routes/index.tsx`, `src/styles.css`
  - hero-তে floating bot, chat bubble ও Python/code visual থাকবে; subtle parallax/float motion, grid ও particles-এর সঙ্গে balance করা হবে।
  - mobile-এ artwork headline/CTA ঢাকবে না এবং পরের section-এর hint visible থাকবে।
  - `prefers-reduced-motion` হলে animation বন্ধ থাকবে।

## 5. যাচাই
- Approved Plan → visible Build mode → successful files/ZIP flow চালিয়ে দেখা হবে।
- একটি simulated/transient provider failure-এ retry/error state এবং unchanged files যাচাই করা হবে।
- login, signup ও home desktop/mobile screenshots দেখে colour, overlap ও readability যাচাই করা হবে।
- relevant tests এবং final build/runtime logs clean করা হবে।

## Technical note
কোড generation এখন এক request-এ AI provider-এ যায়; server log-এ সর্বশেষ failure `502`, আগে `504/524`-ও আছে। তাই শুধু spinner সময় বাড়ানো নয়—mode state synchronization, transient retry/fallback, safe response parsing এবং recoverable UI একসাথে ঠিক করা হবে।
