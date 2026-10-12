# File/image upload fix + complete premium emoji system

## What will be fixed

### 1. File and image attachment will actually work
- Fix the confirmed silent failure in the bot studio: the file input is currently cleared before its live `FileList` is read, so the selected list can become empty without showing an error.
- Copy the selected files first, then clear the input; use a safe state update so quickly selecting multiple batches cannot overwrite earlier attachments.
- Show an immediate loading state while images are resized, then show attachment chips with filename/type and remove controls.
- Keep clear Bengali errors for unsupported type, unreadable file, more than 3 images, image over 4 MB, and text file over 300 KB.
- Ensure attached files/images survive the Build background-job handoff and their names remain visible in chat history.

### 2. Premium emoji and colour on every button
- When Premium mode is selected or requested, require **every** user button and **every** admin button to use a stable key and the shared premium-emoji helper.
- Apply blue/green/red Telegram button styles to all buttons according to their purpose, not only a few examples; no direct `InlineKeyboardButton`/`KeyboardButton` creation may bypass the helpers.
- If a matching premium ID exists, use it and remove the extra Unicode emoji from that button label. If no ID exists, use the normal Unicode fallback.
- Add a completeness check to the AI instructions: before returning code, verify that no button was left without a key/helper/style path.

### 3. Admin panel will be inline-only
- Every admin menu, submenu, pagination row, confirmation, Back/Cancel action, and settings control will use `InlineKeyboardMarkup` only.
- Never use a bottom/reply keyboard inside admin flows.
- Keep professional nested navigation, edit the same message where appropriate, paginate long Products/Orders/Users lists, and require inline Yes/No confirmation for destructive actions.

### 4. Premium emoji in message text too
- In Premium mode, use the text emoji library for meaningful headings, statuses, alerts, confirmations and other emoji-bearing message text—not just buttons.
- Require the generated bot to render text premium emoji through the HTML `<tg-emoji>` helper with a normal fallback.
- Extend post-build library collection to capture both button IDs and text emoji IDs from successful generated code, so later builds can reuse them.
- Telegram supports colour styles on buttons only. Message text will get premium emoji, while blue/green/red colour applies to buttons.

### 5. Screenshot-guided emoji replacement
- Send attached screenshots to the vision-capable AI with explicit instructions to inspect every visible button and message emoji, layout and labels.
- Match visible emoji meanings against the Admin premium emoji library and apply the matched ID to the corresponding button or text location.
- If the user supplies numeric IDs beside the picture, use those exact IDs and save newly discovered IDs to the library after a successful build.
- As selected: when an emoji in the picture cannot be matched confidently to a library ID, stop before Build and ask a focused question for the missing ID/key instead of guessing or silently leaving some places unchanged.
- If the configured AI cannot read pictures, say so clearly and do not pretend the screenshot was applied.

## Technical details
- Update the studio attachment handler to snapshot `File[]` before resetting the hidden input; adapt the reader to consume that stable snapshot and use functional attachment state updates.
- Tighten attachment validation/error reporting on both Chat/Plan requests and queued Build jobs.
- Strengthen `rules()` and the image-reference prompt so Premium mode means complete button + eligible text coverage, with admin inline-only constraints.
- Extend emoji extraction/merge beyond `BUTTON_EMOJIS` to generated `TEXT_EMOJIS` entries.
- Add an intake question result for unresolved screenshot emoji mappings before code generation.

## Verification
- Browser test on mobile and desktop: attach PNG/JPG/WebP and `.py/.txt/.json/.md`, confirm chips appear, removal works, and attached names reach Chat and Build history.
- Test size/type/count errors and re-selecting the same file.
- Test screenshot with a known library emoji (auto-match) and an unknown emoji (asks for ID before Build).
- Inspect a generated bot to confirm all user/admin buttons use the helper and style, all admin navigation is inline-only, and eligible message text uses premium emoji with fallbacks.
- Run focused attachment/emoji tests, existing bot-generation tests, and confirm the preview build has no errors.