# Long replies + copy a bot's flow from pictures/videos

## Why long replies break (your question)
- 1–2k lines is not too big for the bot itself. The limit is the AI: each reply can only be about 8–30 thousand "words-pieces" (tokens), depending on your model. A 2000-line app.py is roughly 25–35 thousand, so the AI **must** stop halfway and be asked "continue". That is normal and the main build already handles it (up to 3 continues).
- The real bug in your screenshot: for an **upgrade** of a big bot, the parallel helpers (Core / User / Admin) do **not** ask the AI to continue. Your Core part got cut off, its closing marker never arrived, so it was marked "failed — উত্তর পড়া যায়নি" and the whole upgrade fell back to the slow full rewrite (the "উত্তর লম্বা — বাকি অংশ আনা হচ্ছে…" you see).

## Fix 1 — long replies always finish
- The parallel helpers use the same "continue where you stopped" step as the main build (up to 4 rounds), and detect a missing `END CODE` marker as "cut off", not "failed".
- If a helper still fails, only that part is retried once before the full-rewrite fallback.
- The progress line shows "অংশ ২/৩ আনা হচ্ছে…" so you can see it's continuing, not stuck.
- Admin → Settings shows the model's reply size so you know how many rounds to expect.

## Fix 2 — copy a flow from pictures or a video
When you attach screenshots or a screen-recording of another bot:
1. **Flow reading step** (before Plan): the AI looks at every picture (video → 8 frames in order instead of 3) and writes a flow map: each screen, its text, its buttons in order (row by row), which button leads to which screen, colours and emojis.
2. The flow map is shown in chat as a clear list ("স্ক্রিন ১: /start → বাটন: 🛍 দোকান, 🛒 কার্ট…") so you can correct it.
3. The Plan and Build use this map as a strict blueprint: same screens, same button order and text, same navigation. Colours/emojis are matched to your library.
4. Works in Chat (free, just shows the map) and Plan/Build.
- Original content only for text the pictures don't show; nothing is guessed silently — unclear parts become a question.

## Technical details
- `bot-build.server.ts` `runSplitUpgrade` and `runSplit`: wrap `callAI` in a continuation loop (`hasUnclosedSection` for `=== CODE ===` without `=== END CODE ===`, or finish_reason length), max 4; one per-section retry.
- `attachments.ts`: video frames 3 → 8, each labelled with its timestamp.
- New `flowSpec` step in `bot-build.server.ts`: when images/video exist, one vision call returns JSON `{screens:[{id,title,text,buttons:[[{label,emoji,style,goes_to}]]}]}`; stored on the job/plan message and injected as `REFERENCE FLOW (follow exactly)` into Plan/Build prompts. Rendered as a list in `ChatParts.tsx`.
- Test for the continuation detector and flow-spec prompt injection.
