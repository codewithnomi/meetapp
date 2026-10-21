---
feature: F03
title: In-meeting chat
status: approved
updated: 2026-10-20
---

# F03 In-meeting chat: Design (HOW)

## Summary (plain English)
- **One chat per meeting:** every message belongs to the meeting, not to one call. So a link meeting joined again next week still shows its earlier chat, as in Teams.
- **The backend decides everything:** the app sends a message to our backend, which checks that the sender is really in the meeting, that chat is on, and that the message is safe. The backend saves it in the database and then asks the call server (LiveKit, already running for F02) to deliver it to everyone in the call at once. Apps only trust chat news that comes from the server, never from another participant.
- **Formatting is not HTML:** a message is stored as a small, strict list of "blocks" (paragraph, list, quote, code) with allowed styles (bold, italic…). Our own code draws it on screen, so a message can never carry a script or hidden page code.
- **Files:** a file goes to our backend, which checks its real content (not its name), removes location and camera details from pictures, and keeps it in private file storage (RustFS on the Mac). Downloads use links that expire after 5 minutes.
- **GIFs:** come from KLIPY's free service. As KLIPY's rules require, each person's app searches KLIPY directly and loads the GIFs from KLIPY's image server, so nothing about GIFs is stored or passed through our server except which GIF was sent (D059, owner's choice). Stickers are our own small set, built into the app.
- **Spelling:** the desktop app's built-in spell checker (part of Electron), working on the computer only.
- **Polls, reactions, pins, replies, edits and deletes** follow the same path: app → backend (checks) → database → call server → everyone.
- **After the meeting:** people who took part read the chat through the normal signed-in connection.
- **Cost:** nothing while everything runs on the Mac. KLIPY is free (no ads are asked for).

Screens follow the approved designs (D029): canvas https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ, section "In-meeting chat (F03)" (4 screens, approved 2026-10-20).

## 1. What gets created
```
packages/contracts/src/chat.ts            Zod shapes: message document, events, requests, errors
packages/db/src/schema/chat.ts            tables (section 4), migration 0005_chat
apps/api/src/modules/chat/                routes, service, repository, document checks, file checks,
                                          poll logic, GIF settings, broadcaster, clean-up jobs
apps/web/src/features/meetings/chat/      chat panel, composer, message list, pickers, polls, hooks
packages/ui/src/…                         new components (section 2.3)
apps/desktop/src/main/chat-desktop.ts     spell-check menu and file-saving rules (chat-bridge.ts wires them)
packages/ui/src/assets/stickers/          our own sticker set (SVG)
```

## 2. Screens and user flow
### 2.1 In the meeting
- **Chat** button in the control bar (side group) opens the panel to the right of the videos (F03Chat). A badge shows unread messages, counted in the app (AC-07).
- **Panel parts, top to bottom:** pinned bar (up to 3, "1 of 2", AC-19), message list (`role="log"`), "New messages" button (AC-08), composer.
- **Message list:**
  - loads the newest 50, then 50 more when scrolled to the top (AC-02);
  - each group shows the name, avatar or initials, time, "(External)" or "(Guest)" (AC-01); a person's messages in the same minute join that group as connected bubbles without repeating them (AC-48, D061);
  - a message of only 1–3 emoji shows at 32 px without a bubble (AC-47);
  - the list never scrolls sideways: long words wrap, code blocks scroll inside themselves;
  - shows system notes ("Aisha Khan pinned a message", "… turned chat off") centred and small;
  - while scrolled up, new messages don't move the view; the button appears (AC-08);
  - empty: "No messages yet" (AC-09).
- **Panel frame (owner, 2026-10-21):** side panels (chat, participants, info, devices) run the window's full height on the right, beside the stage and the control bar, as in Teams.
- **Reactions (owner, 2026-10-21):** chips overlap the bubble's lower edge, the count shows only above 1, and an "Add reaction" button beside them opens the full emoji list under the message (also "More reactions" in the toolbar). New messages and the toolbar fade in (not with reduced motion). A poll keeps its last result on screen while a new one loads, so it never blinks.
- **Pointing at the bubble (not the row), or Tab into the message:** a small toolbar, above the message and kept inside the panel (on the right for own messages, on the left for others), with 4 quick reactions, More reactions, Reply and More (Edit, Copy text, Pin for everyone, Delete). Only allowed actions are shown (F03Pickers).
- **Composer:**
  - a rich text box (section 5.1) with the Format toolbar (shown or hidden by the Format button);
  - buttons: Format, Emoji, Attach (not for guests), Create a poll (organizer, co-organizers, presenters), Send;
  - **Emoji opens one popup above the box, as in Teams (owner, 2026-10-21):** tabs All, Emoji, GIFs (only when the workspace allows GIFs), Stickers. "All" has the GIF notice (once), a "Find something fun" search (it searches GIFs), a row of 6 emoji (recently used first), 3 GIFs (trending at KLIPY until something is typed; nothing is asked of KLIPY before the notice is accepted) and 4 stickers, each with "See all", which opens its tab. An emoji goes into the text; a GIF or sticker is sent at once (with the reply, if replying) and closes the popup. Escape or a press outside closes it. The `ExpressionPicker` organism holds it; the separate GIF and Sticker buttons are gone.
  - Enter sends, Shift+Enter makes a new line, Esc cancels a reply or an edit;
  - a counter appears near the limit, and over it shows "212 characters too many" and disables Send (AC-03);
  - dropped or pasted files show as chips with progress before sending (AC-29).
- **Drop area:** dragging files anywhere over the meeting window opens the panel and shows the drop area (F03States, AC-29). It hides when the drag leaves the window or is dropped. Guests see nothing.
- **Chat off:** the composer is replaced by the note "Chat is turned off for this meeting" (AC-35).

### 2.2 After the meeting
- **Meetings list:** F02 has no list of past meetings, so T16 adds **Recent meetings** to the Meetings screen: up to 20 past meetings the person took part in and may still read, newest first, each with **Open chat** (AC-42). It comes from `GET /me/meeting-chats`, which applies the after-meeting reading rules (3.1) to each meeting. F06 later moves this into the meetings library.
- The chat opens read-only beside the list: no composer, no reactions, reply or edit; Copy text stays; the organizer and co-organizers keep Delete (AC-11); files still download, and polls show their final result (`GET /meetings/:meetingId/chat/polls/:pollId`). Pinning is only during the call (8: "after the meeting, only delete").
- **In the call, chat Off:** the room's shared settings carry `chatMode`, so every app swaps the composer for the note at once; reactions, reply, edit and pin are hidden, and the organizers keep Delete.
- **Leaving:** when the call screen closes (left, removed, ended), the app drops the chat, its file links, previews and polls from memory.

### 2.3 New UI components (Atomic Design, `packages/ui`)
- **Atoms:** `ReactionChip`, `FileChip`.
- **Molecules:** `MessageBody` (our renderer, with code blocks and Copy), `MessageActions`, `ReplyQuote`, `AttachmentCard` (file card or picture preview), `PollOption`, `SystemNote`, `PinnedBar`, `DropArea`. (T11: `ChatMessage` is an organism, because it uses these molecules.)
- **Organisms:** `ChatComposer`, `FormatToolbar`, `EmojiPicker`, `GifPicker`, `StickerPicker`, `PollCard`, `PollCreator`, `DropArea`, `ChatPanel`.
- The design system canvas gets the new components after the look check, as in F02.

## 3. How chat works
### 3.1 Who may do what (one table in `chat/permissions.ts`, unit tested)
| Action | Who |
|---|---|
| read during the call | anyone admitted or in the call (status `admitted`/`in_call`), any group |
| send text, emoji, GIF, sticker, react, reply, vote | same, while chat mode is `on` or `in_meeting` |
| attach files | same, but not guests (AC-33) |
| edit own message | the sender, only while the call the message was sent in (`chat_messages.call_id`) is running; otherwise `CHAT_EDIT_ENDED` |
| delete own message | same as edit |
| delete anyone's message | organizer, co-organizers (during or after) |
| pin, unpin | organizer, co-organizers (during the call) |
| create a poll | organizer, co-organizers, presenters (during a call) |
| close a poll | its creator, organizer, co-organizers |
| change chat mode | organizer, co-organizers (Meeting options, before or during) |
| read after the meeting | a signed-in user (member or external) with a non-removed attendance in a call of this meeting, when the most recent ended call's `chat_mode_at_end` is `on`/`off`; when it is `in_meeting`, organizer and co-organizers only (AC-36, 42) |

- **Lobby** (`waiting`) gets nothing (AC-39). **Removed** people lose everything for this meeting (AC-40). **Guests** lose access when their ticket ends; a rejoin gives a new ticket and the history again (AC-41).
- **Roles come from F02**, re-read on every request (as F02's second verification required), never from the app.

### 3.2 Sending a message (AC-01, 03, 05, 06)
1. The app gives each message a `clientId` (random UUID) and shows it at once as "sending".
2. `POST /calls/:callId/chat/messages` with the meeting ticket: `{ clientId, body | gif | sticker, replyToId?, attachmentIds? }`.
3. The backend checks: rights (3.1), chat mode, rate limit, the document (5.2), that attachments are this sender's, unsent and from this meeting, that `replyToId` is a message of this meeting.
4. It saves the message (one transaction with the attachments), then broadcasts `message_created` (3.4).
5. **Twice-sent protection:** `(sender_attendance_id, client_id)` is unique; a repeat returns the saved message, so retry and reconnect never make a copy.
6. **Timing out:** no answer within 10 seconds → "Not sent" with **Retry**, which resends the same `clientId`.
7. **Rate limits (Redis, per sender):** 10 messages per 10 seconds; the 11th is refused for 10 seconds with `CHAT_TOO_FAST` and the wait time (AC-06). Reactions and votes count separately (30 a minute), so a quick reaction doesn't block typing.

### 3.3 Reading (AC-02, 42)
- During the call: `GET /calls/:callId/chat/messages?before=<cursor>&limit=50` (ticket).
- After: `GET /meetings/:meetingId/chat/messages?before=…` (signed in, 3.1).
- Order: by `created_at`, then `id`. The cursor is the last message's `created_at` and `id` together (Postgres 17 has no built-in time-ordered ids; changed in T2).
- Each answer includes reactions (counts, and whether "you" reacted), reply quotes (sender and first line), attachments, poll states, and the pinned list on the first page.
- Live news received while a page is loading is merged by `id`, so nothing is lost or shown twice.

### 3.4 Delivering news to everyone (AC-01, 13, 19–23, 37)
- **How:** after saving, the backend calls LiveKit's `sendData` (reliable) on topic `meetapp.chat`, to everyone in the room, exactly as F02 sends `meetapp.control`.
- **Trust:** apps accept `meetapp.chat` only when LiveKit marks it as sent by the server (no participant identity). Participants can still publish data (F02's reactions need it), and LiveKit has no per-topic limit (checked in T1, 2026-10-20: `canPublishData` is one yes/no), so apps ignore every `meetapp.chat` packet that comes from a participant.
- **Events:** `message_created`, `message_edited`, `message_deleted`, `reactions_changed` (message id + new counts), `pins_changed`, `poll_created`, `poll_changed` (counts; see 3.7), `poll_closed`, `chat_mode_changed`.
- **Size:** LiveKit's reliable packets should stay under about 15 KB. Any event larger than 14 KB (long code, edits included) is sent as `{ type, id, seq }` only; apps then fetch that message (`GET …/chat/messages/:id`).
- **Missed news:** every chat event gets a per-meeting sequence number (`chat_events` table, kept 1 day). After a reconnect the app asks `GET …/chat/events?after=<last seq>` and applies them in order; if the gap is older than what is kept, it reloads the pinned list and the visible pages. Tested with more than 50 messages plus an edit during a drop.
- **Speed (AC-01):** one database write plus one LiveKit call; measured in the 100-person load test (95% under 1 second).

### 3.5 Editing and deleting (AC-10, 11, 20)
- `PATCH …/chat/messages/:id` (`{ body }`, own text messages only, during a call): `edited_at` is set; `message_edited` is broadcast.
- `DELETE …/chat/messages/:id` (after the app's confirmation): the body, GIF, sticker and attachments are removed at once (attachments' files deleted by a job within a minute), `deleted_at` and `deleted_by` stay. If pinned, it's unpinned. Replies quoting it show "This message was deleted".
- After the meeting, only organizer and co-organizer delete exists, on the `/meetings/:meetingId/…` route.

### 3.6 Reactions, replies, pins (AC-12–14, 19, 20)
- **Reactions:** `POST …/messages/:id/reactions` adds and `DELETE …/messages/:id/reactions/:emoji` (URL-encoded) removes; the emoji is normalised (NFC). `emoji` must be one of the standard emoji in our emoji list (the same data the picker uses), so any other text is refused. One per person per message, as in Teams: adding a different emoji replaces the person's earlier one in the same step, with one `reactions_changed` (D061). Who reacted is shown when pointing at a chip (names only; a guest's typed name).
- **Replies:** `replyToId` is stored; the quote is built on reading, so edits and deletes show up in it.
- **Pins:** `POST …/pins` (`{ messageId }`) and `DELETE …/pins/:messageId`; at most 3, checked inside one transaction; the app asks which to unpin when full.

### 3.7 Polls (AC-21–23)
- `POST …/polls` (`{ question ≤200, options 2–10 × ≤100, multiple, anonymous }`) makes a poll and its message (the poll appears in the chat like a message).
- `PUT …/polls/:id/vote` (`{ optionIds }`, one unless `multiple`), replacing the person's earlier vote; refused once closed.
- `POST …/polls/:id/close`; when the last call of the meeting ends, open polls close automatically (the F02 end handling calls `closeOpenPolls`).
- **Who sees results (owner, 2026-10-20, as in Teams):** a person sees counts only after voting; the creator, organizer and co-organizers always. So `poll_changed` carries only the poll id and a version number; apps that may see results fetch `GET …/polls/:id`, which answers with counts only to those allowed.
- **Anonymous polls:** a vote row stores `voter_key` = HMAC(server secret, poll id + the voter's user id, or guest device fingerprint), never the attendance or the user, and no time. Names are never returned for an anonymous poll. "Nobody" (AC-22) means nobody in the product; someone running the servers with both the secret and the database could work it out, as with any such system. Non-anonymous polls also store `attendance_id`, and the result lists names.

### 3.8 Chat mode (AC-35–38)
- New column `meetings.chat_mode` (`on` default, `in_meeting`, `off`), set through F02's `PATCH /meetings/:id/options` (organizer and co-organizers; others get 403, AC-38).
- During a call: the backend puts it in the room metadata (as F02 does for options), saves a system note and broadcasts `chat_mode_changed` (AC-37, within 2 seconds).
- **Off** blocks every writing route with `CHAT_OFF` (messages, files, reactions, votes, polls).
- **Each call keeps its own end value:** when a call ends, `calls.chat_mode_at_end` saves the mode. After-meeting reading uses the most recent ended call's value (3.1). The organizer can change `meetings.chat_mode` at any time; between calls it applies to the next call only and never changes who can read already-ended calls' chat after the fact beyond that rule.

## 4. Data stored (migration `0005_chat`)
| Table / column | What it holds |
|---|---|
| `meetings.chat_mode` | `on` / `in_meeting` / `off`, default `on` |
| `calls.chat_mode_at_end` | the mode when that call ended (3.8) |
| `workspaces.allow_gifs` | boolean, default true (AC-27) |
| `chat_messages` | `id`, `workspace_id`, `meeting_id`, `call_id` (the call it was sent in), `sender_attendance_id`, `sender_user_id` (empty for guests and after account deletion), `sender_name` (as shown at the time), `sender_group`, `kind` (text / gif / sticker / poll / system), `body` (JSON document, section 5.2; empty when deleted), `plain_text` (the visible text, for counting, Copy text and later search; empty when deleted), `gif` (JSON: service id, size, description, the service's image addresses), `sticker` (our sticker name), `system` (JSON: event and name), `reply_to_id`, `client_id`, `created_at`, `edited_at`, `deleted_at`, `deleted_by_attendance_id` |
| `chat_attachments` | `id`, `workspace_id`, `meeting_id`, `message_id` (empty until sent), `uploader_attendance_id`, `file_name` (cleaned), `media_type` (from the content check), `size_bytes`, `storage_key`, `preview_key` (pictures), `width`, `height`, `status` (uploading / ready / deleted), `created_at` |
| `chat_reactions` | `message_id`, `attendance_id`, `emoji`, `reactor_name`, `created_at`; primary key on the first three |
| `chat_events` | `meeting_id`, `seq`, `type`, `payload`, `created_at`: recent news for catching up after a reconnect, kept 1 day |
| `chat_pins` | `meeting_id`, `message_id`, `pinned_by_attendance_id`, `created_at`; at most 3 per meeting (a trigger in migration 0005 locks the meeting row first) |
| `chat_polls` | `id`, `message_id`, `meeting_id`, `question`, `multiple`, `anonymous`, `creator_attendance_id`, `closed_at`, `version` |
| `chat_poll_options` | `id`, `poll_id`, `position`, `text` |
| `chat_poll_votes` | `poll_id`, `option_id`, `voter_key`, `attendance_id` (empty when anonymous; for anonymous polls the row times are set to the poll's start, so votes can't be matched with join times); unique on `(poll_id, option_id, voter_key)` |

- **Indexes:** `chat_messages (meeting_id, id)`, unique `(sender_attendance_id, client_id)`, `sender_user_id`, `reply_to_id`; `chat_attachments (meeting_id)`, `(message_id)`, `(status, created_at)` for clean-up.
- **Deleting a meeting** (F06/F10) deletes its chat rows (cascade) and a job deletes its files (AC-43).
- **Account deletion (AC-44):** F01's deletion job gains a step: the person's messages get empty `body`/`plain_text`, their attachments are deleted, `sender_user_id` becomes empty and `sender_name` becomes "Deleted user"; their reactions and non-anonymous votes are removed.
- **Data export** (privacy-legal, until built into the app it's done on request): a query by `sender_user_id` returns their messages and files.
- **Workspace separation (S2):** every chat row carries `workspace_id`; every query filters by the meeting reached through the caller's ticket or membership.

## 5. Message content
### 5.1 The editor
- **TipTap** (open source, MIT, built on ProseMirror) for the composer: bold, italic, underline, strikethrough, bullet and numbered lists, quote, link, inline code, code block; Markdown-style typing (three backticks, `**`, `-`), Cmd/Ctrl+B/I/U. Pasted content keeps only these (AC-17). Vetted in T1 (D058).
- **Links:** the Link button and pasted addresses accept only `http`/`https`; plain addresses typed in text become links on display (AC-04).
- **Emoji picker:** **Frimousse** (MIT, small, unstyled, with search and skin tones), styled with our tokens. "Recently used" kept in the app's local settings. Frimousse normally downloads its emoji list from a public CDN (jsDelivr); we set `emojibaseUrl` to a copy bundled with the app (**emojibase-data**, MIT), so nothing is fetched. The backend checks reactions against the same list. Vetted in T1 (D058).
- **Spell check (AC-18):** Electron's built-in spell checker. On Mac it uses macOS's own. On Windows it uses Hunspell dictionaries that Electron would normally download from Google; `setSpellCheckerDictionaryDownloadURL` points to `app://meetapp/dictionaries/` instead, so nothing is fetched from outside (T10). The Windows dictionary files are added when the Windows installer is built (F04); until then Windows has no spell check rather than an outside download. The right-click menu (built in `chat-bridge.ts` from Electron's `context-menu` event, rules in `chat-desktop.ts`) shows suggestions, "Add to dictionary", and Cut/Copy/Paste.
- **Saving files (T10):** the page asks `window.meetapp.files.save(url)`; main accepts only our backend's `/api/v1/chat-files/…` links and saves them with Electron's "Save as" dialog; every other download stays refused.

### 5.2 The stored document (checked by Zod in `packages/contracts/src/chat.ts`)
- `{ v: 1, blocks: Block[] }` where a block is `paragraph`, `bulletList`, `orderedList` (items are lists of paragraphs, 3 levels deep at most), `quote`, or `codeBlock` (`{ language?, text }`).
- Inline parts: `text` with marks from `bold`, `italic`, `underline`, `strike`, `code`, `link` (`href` http/https only, at most 2,000 characters), and `hardBreak`.
- **Empty messages:** a text message whose trimmed `plain_text` is empty and that has no attachments is refused with `CHAT_INVALID`; a message with only attachments is allowed (AC-03).
- **Anything else is refused** by the backend with `CHAT_INVALID` (the app converts first, so people don't see this). At most 4,000 visible characters (code included) and 32 KB stored (AC-03, 17).
- **Drawing it:** our own React renderer turns the document into elements. React escapes all text; there is no `dangerouslySetInnerHTML`. Code blocks are shown in a monospace `pre`, never turned into links (AC-16).
- **Links open outside the app:** clicks go through the existing desktop rule (`guardContents` → `shell.openExternal`, http/https only).

## 6. Files and pictures (AC-28–34)
- **Upload (changed in T6):** `POST /calls/:callId/chat/attachments` (ticket) with the file itself as the body (`application/octet-stream`) and its name in the `X-File-Name` header (URL-encoded), as the F01 photo upload does; refused past 25 MB with `CHAT_FILE_TOO_BIG`. No multipart library is needed. Then `POST …/messages` with `attachmentIds`. Up to 10 files per message.
- **Content check:** the first bytes decide the type (library **file-type**, MIT, vetted in T1, D058): PNG, JPEG, GIF, WebP, PDF, DOCX/XLSX/PPTX (ZIP with the right inner parts; macro-enabled files, those with `vbaProject.bin` or a docm/xlsm/pptm content type, are refused). The old Office formats (.doc, .xls, .ppt) are not accepted: their container is shared with installers and often carries macros (owner, 2026-10-20). Plain text and CSV are accepted only when the whole file is valid UTF-8 without control characters. Anything else: `CHAT_FILE_TYPE` and nothing is kept (AC-30).
- **Pictures:** re-saved with **sharp** (already used for profile photos) in the same format: turned the right way up first (`.rotate()`), then saved without location, camera and other hidden details (AC-32); `limitInputPixels` (40 million) and at most 300 frames for animated GIF/WebP refuse "decompression bombs"; a preview up to 480 px wide is made. Animated GIFs keep their animation.
- **Names:** the shown file name is cleaned (no paths, no control characters, at most 200 characters).
- **Storage:** private bucket `chat` in RustFS (R2 later), key `workspace/meeting/attachment-id`; files are never run or opened by the app.
- **Download (changed in T6):** `GET …/attachments/:id/link` checks the rights again and returns a link to our own backend, `GET /api/v1/chat-files/:token`, valid 5 minutes. The token is signed by the backend (HMAC) and names the file and its end time; the backend then sends the file from private storage with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store` and the stored type (text and CSV as `text/plain; charset=utf-8`) (AC-F03-31). Storage links can't carry `nosniff`, so files never go to the app straight from storage. People who lost access get no new links. The desktop app saves through a "Save as" dialog (`window.meetapp.files.save`, section 5.1); previews use such links too.
- **Limits:** 10 uploads a minute per person (`CHAT_FILE_RATE`; every upload counts, sent or not), 500 MB of files per meeting (`CHAT_MEETING_FILES_FULL`), counting all attachments not deleted, including unsent ones, checked with the meeting row locked so two uploads can't both slip under it (AC-34).
- **Unfinished uploads:** attachments never sent are deleted after 1 hour; a cut-off upload leaves nothing (AC-05).
- **Drag and drop / paste (AC-29):** the meeting window listens to `dragenter`/`dragleave`/`drop` (counting enter and leave so child elements don't flicker); dropped and pasted files go through the same checks in the app first (size, type by extension) to give quick messages, then through the server's real checks.

## 7. GIFs and stickers (AC-24–27)
- **GIF service (D059, owner's choice 2026-10-20):** **KLIPY**'s free API (Tenor's closed on 30 June 2026). Checked in T1 against KLIPY's integration rules (docs.klipy.com):
  - API requests and GIF loads must come from the person's own app, not through our servers, and GIFs must not be copied, stored or re-hosted;
  - results are shown in KLIPY's order, in their own GIF area, with "Powered by KLIPY" shown;
  - ads are optional: we never send the ad settings, so no ads appear;
  - safety: the `content_filter` setting asks for family-safe results; extra blocked words are set in KLIPY's Partner Panel;
  - a test key allows 100 searches an hour; a free production key is requested from KLIPY before going online.
- **Search from the app:** when the GIF picker opens, the app asks our backend `GET /calls/:callId/chat/gif-settings` (ticket; refused when GIFs are off or chat is off). It returns the KLIPY key and a `customer_id` = HMAC(server secret, meeting id + attendance id), so KLIPY can't link one person across meetings. The app then calls `https://api.klipy.com/api/v1/<key>/gifs/search` itself with `q`, `customer_id`, `locale`, `per_page=24` and `content_filter` for family-safe results. The key is not a secret in this set-up (KLIPY's client keys are meant to live in apps); it is still kept out of the code and comes from settings.
- **What KLIPY sees:** the search words, the person's internet address when searching and when any GIF is shown, and the random `customer_id`; never names, emails or meeting details.
- **Sending a GIF:** the message stores only KLIPY's GIF id, the sizes, the description and the image addresses exactly as KLIPY returned them. The backend checks each address is `https://static.klipy.com/…` and refuses others. No GIF file is ever stored by us.
- **Showing GIFs:** loaded straight from `static.klipy.com` (allowed by name in the content security policy), using KLIPY's addresses unchanged.
- **Reduce motion (AC-25):** with the system setting on, the app shows the GIF's still picture with a Play button; every GIF can be paused. Each has a text description from the service ("GIF: …").
- **Turned off (AC-27):** `PATCH /workspaces/:workspaceId/settings` gains `allowGifs` (owner and admins, as F02's `allowGuests`); when false, the GIF button is hidden and the backend refuses GIF settings and GIF messages with `CHAT_GIFS_OFF`.
- **Stickers (AC-26):** about 24 SVG stickers drawn for MeetApp, in `packages/ui/src/assets/stickers/`, each with a name and a text description. A sticker message stores only the name; unknown names are refused.

## 8. Backend endpoints (all under `/api/v1`)
| Endpoint | Who | Purpose |
|---|---|---|
| `GET /calls/:callId/chat/messages` (`?before&limit`), `GET …/messages/:id`, `GET …/chat/events?after=` | ticket, in call | history, one message, catching up |
| `POST /calls/:callId/chat/messages` | ticket, may write | send |
| `PATCH`, `DELETE /calls/:callId/chat/messages/:id` | sender; delete also organizer, co-organizers | edit, delete |
| `POST`, `DELETE /calls/:callId/chat/messages/:id/reactions` (`{ emoji }`) | ticket, may write | react |
| `POST /calls/:callId/chat/pins`, `DELETE …/pins/:messageId` | organizer, co-organizers | pin, unpin |
| `POST /calls/:callId/chat/polls`, `GET …/polls/:id`, `PUT …/polls/:id/vote`, `POST …/polls/:id/close` | 3.1 | polls |
| `POST /calls/:callId/chat/attachments`, `GET …/attachments/:id/link` | members and external people in call | upload, download link |
| `GET /calls/:callId/chat/gif-settings` | ticket, GIFs allowed, chat on | the KLIPY key and a per-meeting `customer_id` for the app's own search |
| `GET /meetings/:meetingId/chat/messages`, `GET …/attachments/:id/link`, `GET …/polls/:id` | signed in, 3.1 | after the meeting |
| `GET /me/meeting-chats` | signed in | past meetings whose chat the person may open (up to 20), with whether they are an organizer there (T16) |
| `DELETE /meetings/:meetingId/chat/messages/:id` | organizer, co-organizers | after the meeting |
| `PATCH /meetings/:id/options` (F02, extended) | organizer, co-organizers | `chatMode` |
| `PATCH /workspaces/:workspaceId/settings` (F02, extended) | owner, admin | `allowGifs` |

- **Errors** (F00 format): `CHAT_OFF`, `CHAT_TOO_FAST` (with wait time), `CHAT_INVALID`, `CHAT_FILE_TOO_BIG`, `CHAT_FILE_TYPE`, `CHAT_FILE_RATE`, `CHAT_MEETING_FILES_FULL`, `CHAT_PINS_FULL`, `CHAT_POLL_CLOSED`, `CHAT_GIFS_OFF`, `CHAT_EDIT_ENDED`; and `NOT_FOUND` for every rights refusal, as in F02 (S1, S2).
- Every write route takes the F00 `Idempotency-Key` where retrying could double it (messages use `clientId`).

## Edge cases and errors
- **Lost connection while typing:** the draft stays; sends show "Not sent" and retry with the same `clientId`.
- **Message arrives while the history is loading:** merged by id (3.3).
- **Two organizers pin a 4th message at once:** the meeting row lock makes one of them get `CHAT_PINS_FULL`.
- **Edit and delete at the same time:** the update checks `deleted_at` is empty; an edit after a delete gets `NOT_FOUND`.
- **Deleting a poll message:** closes the poll and deletes its votes. System notes can't be deleted.
- **Ticket ends (guest leaves, person removed):** the app clears its chat in memory, cached file links and previews (AC-40, 41).
- **Vote after close:** `CHAT_POLL_CLOSED`; the app shows the closed result.
- **Removed during an upload:** the upload finishes but the message is refused; the clean-up job deletes the file.
- **Very long code block:** sent by id only (3.4).
- **GIF service down or slow (over 2 seconds):** the picker shows "GIFs aren't available right now. Try again later."; the rest of chat works.
- **Chat mode changes while someone is typing:** their send gets `CHAT_OFF`; the draft stays.
- **Clock differences:** times come from the server.

## Security and privacy
- **S1, S2:** every route checks the ticket of this call or, after the meeting, the signed-in user's non-removed attendance in this meeting (members and external people) (3.1), re-reading roles each time; all refusals look like `NOT_FOUND`; outsider sweeps cover every new route.
- **S5:** rate limits for messages, reactions, votes and files (3.2, 6); GIF searches are limited by KLIPY itself.
- **S10:** message text, file names, poll text are never logged (only ids and counts); the log cleaning gains `body`, `plain_text`, `q`, `question`, poll option `text`, `href`, the GIF `description`, `fileName` (the `X-Meeting-Ticket` header is already hidden since F02).
- **S11:** strict document shape (5.2), text-only rendering, http/https links opened outside, file names cleaned.
- **S12:** content-based type checks, 25 MB limit, private storage, 5-minute links, `attachment` downloads, never opened by the app. **Virus scanning is a must-do before going online** (progress.md).
- **S14:** chat text will be passed to AI (F06, F07) as data, inside clear data markers, never as instructions; AI only uses chats the asking person can read (3.1).
- **Desktop (S17):** the content security policy adds `api.klipy.com` (from `GIF_API_URL`) to `connect-src`, and the GIF image host `static.klipy.com` to `img-src` only (chat files and previews come from our own backend); drag and drop of files must not navigate the window (the existing navigation guard already blocks it; a test checks a dropped file goes to chat, not the window).
- **Privacy-legal.md:** chat row already added; the KLIPY entry says it receives the search words, a random per-meeting id and the internet address of people searching or seeing GIFs.

## Cost impact
None locally: chat uses the existing database, file storage and call server. KLIPY is free (checked in T1; no ads asked for). Online later: chat files use R2 storage (about $0.015 per GB a month; 1,000 meetings × 50 MB ≈ 50 GB ≈ $0.75 a month).

## Test approach
Tests are listed in tests.md (`TC-F03-…`). Per D052, each task runs its own tests; the full suite, desktop tests and screenshots run at `/spec-verify`.

- **Unit:** permissions table; document checks (allowed and refused shapes, limits, link schemes); renderer (no HTML injection, code kept exactly); content type checks with sample files (renamed `.exe` as `.pdf`, broken text, Office files); poll result rules; emoji list check; drop area enter/leave counting; every new component (stories, keyboard, axe).
- **Integration (API + Postgres + Redis + RustFS + the local LiveKit):** every endpoint's rights (members, external, guests, lobby, removed, after the meeting, other workspaces); chat modes; rate limits; idempotent send; broadcast events received by a test LiveKit participant and only from the server; picture details removed (checked with sharp's metadata); 5-minute links; clean-up jobs with a fake clock; account deletion step; meeting deletion; the gif-settings route and GIF address checks (no real network in tests).
- **Desktop end to end (Playwright + Electron, 2–3 windows):** send and see within 1 second; history for late joiners; formatting and code Copy; reactions, reply, edit, delete, pin; poll create, vote, close; GIF (fake service) and sticker; drag and drop and paste of files, download with Save as; chat off and in-meeting-only; guest has no attach; removed person stops receiving; spell check suggestions in the context menu; keyboard-only run with announcements.
- **Load:** the 100-person load test sends chat messages from the simulated people's side through the API and measures delivery time to the desktop app (95% under 1 second).
- **Screenshots:** new components and the chat panel against the approved canvas.

| AC | How it's tested |
|---|---|
| AC-F03-01 | desktop (two windows, under 1 s, names and groups) + load (100 people, 95% under 1 s) |
| AC-F03-02 | integration (paging, order, late joiner sees earlier messages, guest rejoin) + desktop (newest 50 shown within 2 s) |
| AC-F03-03 | unit (limits) + desktop (counter, Send disabled) + integration (server refuses) |
| AC-F03-04 | unit (renderer: only http/https links; other schemes plain) + desktop security (link opens outside) |
| AC-F03-05 | integration (same `clientId` twice → one message) + desktop (API stopped → Not sent → Retry) |
| AC-F03-06 | integration (11th in 10 s refused for 10 s, message text) |
| AC-F03-07, 08, 09 | desktop (badge, 99+, no jump while scrolled up, New messages, empty state) |
| AC-F03-10, 11 | integration (rights, during vs after, text and file removed) + desktop (confirmation, "Edited", "deleted") |
| AC-F03-12, 13, 14 | desktop (picker search, skin tones, recent; reactions seen within 1 s; reply quote and jump) + integration (20-reaction limit, emoji list) |
| AC-F03-15, 16, 17 | unit (document checks, paste cleaning, renderer) + desktop (toolbar, shortcuts, backticks, Copy exact) |
| AC-F03-18 | desktop (misspelled word → suggestions in the context menu; no network request) |
| AC-F03-19, 20 | integration (3-pin limit, rights) + desktop (pinned bar and note within 2 s) |
| AC-F03-21, 22, 23 | integration (limits, one vote, change, anonymous has no names anywhere, results only after voting, close, auto-close at end, attendee can't create) + desktop (poll and results seen within 2 s) |
| AC-F03-24–27 | desktop timing (GIF results within 2 s from the fake service) + integration (gif-settings rights, per-meeting customer id, only static.klipy.com addresses accepted; GIFs off refused) + desktop (the app's KLIPY request to a fake service carries the family-safe filter, no ad settings and no personal data) + desktop (reduced motion still picture, descriptions, notice once, stickers) |
| AC-F03-28–34 | unit (type checks) + integration (25 MB, real type, details removed, links expire, no links after access lost, guests refused, 10/min and 500 MB) + desktop (drop area, paste, chips, download) |
| AC-F03-35–38 | integration (each mode on every writing route, who reads after, 403 for others) + desktop (note within 2 s) |
| AC-F03-39, 40, 41 | integration (lobby, removed, guest left) + desktop (removed window stops receiving within 2 s) |
| AC-F03-42, 43, 44 | integration (after-meeting readers per call end value, link meeting reused: no edits of last call's messages, meeting deletion removes rows and files, account deletion step runs within the 30-day job schedule) |
| AC-F03-45, 46 | desktop keyboard-only run + axe + live announcements; translation keys test |

## Decisions made here
- **D058 (accepted):** new libraries for F03: TipTap (editor), Frimousse (emoji picker) with emojibase-data bundled, file-type (content check), `@fastify/multipart` (uploads); vetted in T1.
- **D059 (accepted by the owner, 2026-10-20; changed in T1):** GIF service: KLIPY's free API, searched from each person's app as KLIPY's rules require, GIFs loaded from KLIPY; we store only which GIF was sent; no ads.
- **D060 (proposed):** how chat is built: one chat per meeting; backend saves, LiveKit delivers server-only events on `meetapp.chat`; messages as a strict JSON document drawn by our own renderer; files checked by content and kept privately.
