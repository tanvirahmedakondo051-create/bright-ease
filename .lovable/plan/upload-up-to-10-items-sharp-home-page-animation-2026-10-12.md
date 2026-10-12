# Upload up to 10 items + sharp home page animation

## What you get
1. **Bot chat attachments: up to 10 at once** (was 3 pictures)
   - **Pictures** (jpg, png, webp, gif): the AI sees them.
   - **Documents**: PDF (the AI reads it), plus .py, .txt, .json, .md, .csv, .html, .js, .env.example, .yaml and similar text files (the content is sent to the AI).
   - **Video** (mp4, webm, mov, up to 20 MB): the AI can't watch video directly, so a few still frames are taken from the video and sent as pictures, along with its name and length.
   - **Other files / ZIP**: a .zip is opened and its text/code files are sent; anything unreadable is attached by name only, with a Bangla note.
   - Chips above the box show each item with an icon (picture / document / video) and ✕ to remove; a "১০টির মধ্যে X" counter.
   - Limits: 10 items total, 20 MB each, clear Bangla message if one is too big or the wrong type.
2. **Home page picture animation sharp, not blurry**
   - The floating code/bot picture behind the demo card is shown faded and soft. It will be shown at full clarity: remove the fade and shadow filter that makes it soft, move it with a smooth sharp slide (no blur), and keep it behind the card edges so it doesn't sit under the text.
   - The demo card ("Hexa Bot Studio" / "Build ready") will no longer look washed out — its content appears fully once its entry animation finishes.

## Technical details
- `src/lib/attachments.ts`: limit 10 total, 20 MB per file; kinds `text | image | pdf | video`. Images resized to 1280px JPEG; video → 3 frames via `<video>` + canvas seek (as images, named `video.mp4 #1..3`); PDF → base64 data URL; ZIP → unzip in browser (fflate) and keep text files (cap 300 KB total text per file).
- `bot.functions.ts` zod: `.max(10)` items, kinds incl. `pdf`, image regex adds gif, per-item content ≤ 8 MB; total payload cap.
- `bot-build.server.ts`: PDFs sent as `input_file`/`file` content parts per the multimodal reference for the configured provider; if a provider rejects images/files, retry once text-only with a notice (existing behaviour extended). Messages store names only.
- `bot.$botId.tsx` file input `accept` widened, `multiple`; chip icons per kind and counter.
- `styles.css` `.hero-art`: drop `opacity` and `filter: drop-shadow/saturate`, animate with `translate3d` only, add `will-change: transform` and `backface-visibility: hidden`; tighten clip so it stays outside the card. Check `.motion-enter`/`glass` on the demo card so final state is fully opaque.
