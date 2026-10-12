# Premium emoji: file থেকে ID সংগ্রহ + Premium/Normal প্রশ্ন

## যা হবে
1. **Admin → Premium emoji library-তে "ফাইল থেকে ইমপোর্ট"**
   - .py / .txt / .json / .zip ফাইল আপলোড বা কোড পেস্ট করা যাবে।
   - ফাইলের ভিতর থেকে সব premium emoji ID খুঁজে বের করবে: `icon_custom_emoji_id`, `custom_emoji_id`, `<tg-emoji emoji-id="...">`, `BUTTON_EMOJIS = {...}` ধরনের key→ID, এবং ১৫–২০ সংখ্যার ID।
   - পাশের নাম/বাটন লেখা থেকে key আন্দাজ করবে (না পেলে `emoji.1`, `emoji.2`…), fallback emoji ও রং ধরবে।
   - প্রিভিউ লিস্ট দেখাবে (নতুন / আগে থেকেই আছে), টিক দিয়ে "লাইব্রেরিতে যোগ করুন"। আগের ID মুছবে না, ডুপ্লিকেট বাদ।
   - হাতে একটা একটা করে যোগ করার ফর্ম আগের মতো থাকবে।
2. **ইউজারও ফাইল দিলে সংগ্রহ** — বট স্টুডিওতে ইউজার যে পুরনো bot.py দেয়/আপলোড করে, তার ভিতরের premium ID-ও নিজে থেকে লাইব্রেরিতে যোগ হবে (এখন শুধু AI-র লেখা কোড থেকে হয়)।
3. **পরের সব বিল্ডে এই লাইব্রেরি ব্যবহার** — Build-এর সময় AI-কে লাইব্রেরির key→ID লিস্ট দেওয়া হবে এবং বলা হবে বাটনের অর্থ মিলিয়ে (shop, back, profile, admin…) সঠিক ID বসাতে।
4. **Premium না Normal — AI জিজ্ঞেস করবে**
   - প্রম্পটে premium/normal emoji উল্লেখ না থাকলে Plan ধাপে একটা প্রশ্ন পপআপ আসবে: "বাটনে কোন emoji চান?" → "Premium emoji (লাইব্রেরি থেকে)" / "সাধারণ emoji"।
   - Premium বাছলে: BUTTON_EMOJIS/TEXT_EMOJIS লাইব্রেরি থেকে ভরা + বটের ভিতরে Emoji Settings।
   - Normal বাছলে: কোনো premium ID বসবে না, শুধু সাধারণ emoji।
   - পছন্দটা বটে সেভ থাকবে, পরের আপগ্রেডে আবার জিজ্ঞেস করবে না।

## Technical details
- New `src/lib/emoji-extract.ts` (pure parser + tests): regexes for the patterns above, key inference from nearby `"key":` / button text, returns `{key,id,fallback,style,kind}[]`.
- `admin.functions.ts`: `importEmojiFromText({text})` admin-only → returns preview; save reuses existing library save (merge into `button_emojis` + `button_emoji_meta`). ZIP read client-side with JSZip (already used for download).
- `admin.settings.tsx`: import panel (file input + textarea + preview checklist).
- `bot.functions.ts`: run extractor on user-supplied files/messages and merge; plan prompt rule — if prompt lacks premium/normal emoji mention and no saved choice, include the emoji-style question; store choice in `bots` (new column `emoji_mode text default ''`, migration + rerunnable copy in `supabase/migrations/`); build prompt injects the library only when `emoji_mode='premium'`.
