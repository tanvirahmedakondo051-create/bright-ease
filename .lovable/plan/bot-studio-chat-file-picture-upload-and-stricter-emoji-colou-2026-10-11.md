# Bot studio chat: file + picture upload, and stricter emoji/colour rules

## What you get
1. **Attach button (📎) in the chat box**
   - **Files** (.py / .txt / .json / .md, max 300 KB): the file is read and sent to the AI together with your message. Premium emoji IDs inside the file are saved to the library automatically (this already happens when code is pasted).
   - **Pictures** (jpg/png/webp, max 4 MB, up to 3): sent to the AI as a reference, e.g. a screenshot of another bot's menu, so it can copy the layout and buttons. If the chosen AI model can't read pictures, you see a Bangla message and only the text is sent.
   - The attachments show as small chips (name, ✕ to remove) above the box, and in the chat history after sending.
   - Note: a picture can't give premium emoji IDs, because the IDs are not visible in an image. To collect IDs, send a file or the code.
2. **Your emoji rules become mandatory in the AI instructions**
   - `settings.button_emojis` stored in data.json, with stable keys (main.*, action.*, admin.*) and number-only IDs.
   - The exact `button_emoji(key)` and `btn(text, callback_data, key, style)` helpers from your rules: they add `icon_custom_emoji_id` only when the ID is a number, and `style` only for primary/success/danger. When there is no ID, the bot uses a normal emoji in the button text.
   - Default IDs are filled from the admin library at build time. Normal-emoji bots still skip all of this.

## Technical details
- `ChatComposer.tsx`: hidden file input + paperclip button; text files read via `File.text()`; images resized client-side to max 1280px and turned into JPEG data URLs.
- `botChat` input: add `attachments: [{name, kind: "text"|"image", content}]` (zod: max 3 images, text ≤300 KB). Text is appended to the user prompt as `ATTACHED FILE name:` blocks (and run through `extractPremiumEmojis`). Images are sent as OpenAI-style `image_url` content parts in the last user message; if the provider returns 400 for image parts, retry once without them and add a notice.
- `/api/public/bot-build` passes the field through unchanged. Messages store only the attachment names (not the image data) to keep `bots.messages` small.
- `rules()` in `bot.functions.ts`: replace the emoji section with the user-supplied helper spec, word for word.
