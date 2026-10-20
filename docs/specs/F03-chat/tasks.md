---
feature: F03
title: In-meeting chat
status: in-progress
updated: 2026-10-20
---

# F03 In-meeting chat: Tasks (STEPS)

Small steps, done in order, on branch `feat/F03-chat`. Each step is committed and pushed when its tests pass (D026). Tick `[x]` when done and verified.
- **Tests per step (D052):** each step runs only its own test cases plus typecheck and lint. The whole suite, the desktop tests and the screenshots run once, at `/spec-verify`.
- **Library details:** before a step uses a library (TipTap, Frimousse, file-type, `@fastify/multipart`, sharp, LiveKit, KLIPY), it is checked against current docs (Context7). A difference updates design.md first, and the owner is told.

## Backend

- [x] **T1: Libraries, the GIF service and settings.**
  - Vet the D058 libraries with `/add-dependency`: TipTap, Frimousse, file-type, `@fastify/multipart`. Each is installed in the task that first uses it.
  - KLIPY: confirm the free terms, the family-safe filter, no ads in API results, the image host name (D059). Get a free key into `.env` (`GIF_API_KEY`, not required in development: without it the GIF picker says GIFs aren't available).
  - Check that LiveKit passes can limit data publishing by topic (design 3.4); if not, apps ignore participant packets on `meetapp.chat`.
  - Check Electron's `setSpellCheckerDictionaryDownloadURL` with bundled dictionaries.
  - New settings in `config.ts`/`.env.example`; new folders in `docs/engineering/project-structure.md`.
  - Tests: none of their own (checks recorded in design.md and D058/D059).
  - **Done in T1 (2026-10-20):**
    - libraries vetted, versions pinned in D058; emojibase-data added so the emoji picker downloads nothing;
    - LiveKit has no per-topic data limit, so apps ignore participant packets on `meetapp.chat` (design 3.4);
    - `GIF_API_KEY` (optional) and `GIF_API_URL` settings, with the config tests;
    - KLIPY checked (on another network; the office network's Fortinet filter blocks klipy.com): free, ads optional (we never ask for them), family-safe filter per request, but searches and GIF loads must come from the person's app, not our server. The owner chose to follow that (D059 changed; design section 7, TC-F03-43 and 90 updated);
    - Electron's bundled spell-check dictionaries are checked in T10, where they are built.

- [x] **T2: Database tables (migration `0005_chat`) and the permissions table.**
  - With `/db-migration`: `chat_messages`, `chat_attachments`, `chat_reactions`, `chat_pins`, `chat_polls`, `chat_poll_options`, `chat_poll_votes`, `chat_events`, `meetings.chat_mode`, `calls.chat_mode_at_end`, `workspaces.allow_gifs`.
  - `chat/permissions.ts` (design 3.1) and the Zod shapes in `packages/contracts/src/chat.ts`, including the message document (design 5.2).
  - Covers: AC-F03-03, 17 (shape part).
  - Tests: TC-F03-27, 94; the database rules in `packages/db/src/chat.integration.test.ts` (TC-F03-10, 35, 73 database parts). TC-F03-32 moved to T3: it needs the send route.
  - **Built in T2:** migration `0005_chat` (only new tables, and new columns with defaults: safe on existing data) with a 3-pin trigger; `packages/contracts/src/chat.ts` (the message document); `modules/chat/chat.permissions.ts`; shared test rows in `packages/db/src/test-fixtures.ts`.

- [x] **T3: Sending, reading and delivering messages.**
  - Send (with `clientId`), history pages, one message, catching up (`chat/events`), the LiveKit broadcaster on `meetapp.chat`, large events by id, rate limits.
  - Covers: AC-F03-01, 02, 03, 05, 06.
  - Tests: TC-F03-03, 05, 06, 10, 13, 32, 92 (server part). TC-F03-88 and 89 move to T12: LiveKit can't limit data by topic (T1), so the protection is the app ignoring participant packets; the server side is only that news is sent by the server.
  - **Built in T3:** `modules/chat/` service, repository and routes (send with `clientId`, history pages by time and id, one message, missed events), `sendChat` on the call server, the 10-in-10-seconds limit, chat error codes, log cleaning for chat text, the route and meeting sweeps extended. The 1-day clean-up of `chat_events` comes with the other clean-up jobs in T8. The attachment-only part of TC-F03-06 comes in T6.

- [x] **T4: Editing, deleting, reactions, replies and pins.**
  - Covers: AC-F03-10, 11, 13, 14, 19, 20.
  - Tests: TC-F03-18, 19, 20, 24, 25, 35 (during the call). The after-meeting delete route of TC-F03-20 comes with the after-meeting routes in T8; the GIF and file parts of TC-F03-19 with T6 and T7.
  - **Built in T4:** `chat-actions.repository.ts`, `chat-actions.service.ts`, `chat-actions.routes.ts`, `chat-access.ts` (shared rights, delivery and message views with quotes and reactions), `emoji.ts` (emojibase-data 17.0.0 list, D058). "Own" means the same account (any join) or the same guest join; an organizer may still remove their own message from an earlier call. Removing a reaction is `DELETE …/reactions/:emoji`.

- [x] **T5: Polls.**
  - Create, vote, results only after voting, anonymous voter keys, close, auto-close when the call ends, deleting a poll message.
  - Covers: AC-F03-21, 22, 23.
  - Tests: TC-F03-37, 38, 39, 40, 41 (during the call). Reading the final result after the meeting comes with the after-meeting routes in T8.
  - **Built in T5:** `chat-polls.repository.ts`, `chat-polls.service.ts`, `chat-polls.routes.ts`; the voter key is HMAC(a key derived from `DATA_ENCRYPTION_KEY`, poll id + account, guest device fingerprint or join), so votes can't be linked across polls; when a call ends (either way) its chat setting is saved in `calls.chat_mode_at_end` and open polls close (`call-events.repository.ts`). Fixed on the way: chat news rows took the message's own id (`recordEvent`).

- [x] **T6: Files and pictures.**
  - Upload (streamed, 25 MB), content checks (no old Office files, no macros), sharp clean-up and previews, bomb limits, private storage, 5-minute links with safe headers, limits, clean-up of unsent and deleted files.
  - Covers: AC-F03-28, 30, 31, 32, 33, 34; AC-F03-05 (cut-off upload).
  - Tests: TC-F03-12 (a failed store leaves no row or file), 50, 51, 52, 56, 57, 58, 60, 84, 85, 86. The 1-hour clean-up of unsent files and the removal of deleted messages' files from storage come with the clean-up jobs in T8; after-meeting links with the after-meeting routes in T8.
  - **Built in T6:** `chat-files.ts` (content checks with file-type 22.1.1; Office files with a macro part refused; text only as .txt/.csv, valid UTF-8, no page code; pictures re-saved by sharp, upright, without hidden details, with a 480 px preview; 40-million-pixel and 300-frame limits), `chat-files.repository.ts` (500 MB per meeting counted with the meeting row locked), `chat-files.service.ts` and routes (upload as the request body with `X-File-Name`; files given to a message in the same save; signed 5-minute links to `/api/v1/chat-files/:token` answered with `attachment`, `nosniff`, `no-store` and a sandbox policy). Design changed (owner told): no multipart library, downloads through our backend instead of storage links. New "download" right: everyone in the call but guests.

- [x] **T7: GIFs, stickers and the GIF switch.**
  - The `gif-settings` route (key, `GIF_API_URL`, per-meeting `customer_id`), GIF messages checked for `static.klipy.com` addresses, sticker messages, `allowGifs` in workspace settings.
  - Covers: AC-F03-24, 26, 27.
  - Tests: TC-F03-43, 47, 48 (TC-F03-90 is the app's own KLIPY request, tested in T15).
  - **Built in T7:** `GET …/chat/gif-settings` (key, address, per-person-per-meeting `customerId`), GIF messages accepted only with `https://static.klipy.com/…` addresses, a 24-sticker name list in `packages/contracts` (`STICKERS`; the pictures come in T11), one kind per message (text and files, or a GIF, or a sticker), and `allowGifs` in workspace settings and in each workspace the app lists.

- [x] **T8: Chat setting, who can chat, after the meeting, deletion.**
  - `chatMode` in Meeting options, the room metadata and note, `chat_mode_at_end`, Off on every writing route, lobby and removed people, after-meeting routes, meeting deletion and the account deletion step, the readable-chats function for AI later.
  - Covers: AC-F03-35–44.
  - Tests: TC-F03-62, 64, 65, 67, 68, 70, 71, 73, 74, 91; the `chat_events` clean-up (TC-F03-92, kept 1 day).
  - **Built in T8:** `chatMode` in Meeting options (also in the room's shared state), with a note and `chat_mode_changed` news when changed during a call; `chat-after.*` (reading, links and organizer deletes after the meeting, under `/api/v1/meetings/:meetingId/chat/…`; "took part" means let into a call, not removed; the latest ended call's setting decides); `chatForAi` (the reading rule, text marked as data, for F06/F07); `chat-upkeep.*` (minute-by-minute clean-up inside the call jobs: news older than a day, files of deleted messages, files never sent within an hour; `forgetPerson` and `exportFor` for account deletion and data requests, used by support until F10 builds account deletion; `beforeMeetingDeleted` for F06/F10 to call before deleting a meeting record, so its files go too).

- [x] **T9: Backend security sweeps.**
  - Outsider sweep generated from the router, other workspace and other meeting, logs without chat text, names and poll text stored as plain text.
  - Covers: S1, S2, S10, S11 for every new route.
  - Tests: TC-F03-79 (the F02 meeting sweep, which lists routes from the router, now covers every chat route), 80, 82 (server part), 87.
  - **Built in T9:** `chat-security.integration.test.ts`; log cleaning also hides `options`, `fileName` and the `X-File-Name` header; services take database types only through their repositories (architecture check); `pnpm check` clean.

## Desktop and app

- [x] **T10: Desktop: spell check, Save as, drop safety, content policy.**
  - `spellcheck.ts` (bundled dictionaries, right-click menu), `downloads.ts`, the GIF and file storage hosts in `img-src`, dropped files never navigate the window.
  - Covers: AC-F03-18; AC-F03-31 (Save as).
  - Tests: TC-F03-33, 34, 93 (rules and policy as unit tests; the parts that need the chat panel on screen, typing in the message box and dropping onto it, run with T13 and T15).
  - **Built in T10:** `chat-desktop.ts` (rules), `chat-bridge.ts` (Electron wiring), `meetapp.files.save` in the preload, downloads allowed only for chat file links, KLIPY in the security policy (`GIF_API_URL` in development only). Windows dictionaries ship with F04's installer (design 5.1).

- [x] **T11: Building blocks in the gallery.**
  - `/new-component` for the atoms, molecules and organisms in design 2.3, with stories, keyboard and axe checks; our own message renderer; the sticker set.
  - Covers: AC-F03-04, 16, 17 (renderer), 45 (components).
  - Tests: TC-F03-08, 29, 54, 76 (plus component tests for 11, 16, 17, 21, 23, 26, 36, 53, 66, 75).
  - **Built in T11:** the reading side, which T12 needs: `MessageBody` (our own renderer of the message document; never HTML), `ReactionChip`, `ReplyQuote`, `AttachmentCard`, `SystemNote`, `PinnedBar`, `DropArea` (with `trackDrag`), and the organisms `ChatMessage` and `ChatPanel` (ChatMessage became an organism because it uses MessageBody and ReplyQuote, which are molecules); 19 new icons. The writing side is built where it is first used: the message box, format toolbar and emoji picker in T13 (TipTap, Frimousse), message actions and polls in T14, GIF and sticker pickers and the sticker pictures in T15.

- [ ] **T12: The chat panel: a first real chat (milestone).**
  - Chat button and badge, panel, history and paging, sending with "Not sent" and Retry, live news, catching up after a reconnect, empty state, "New messages".
  - Covers: AC-F03-01, 02, 05, 07, 08, 09.
  - Tests: TC-F03-01, 04, 11, 15, 16, 17, 88, 89, 92 (app part).
  - Milestone: the owner tries chat with two windows (`pnpm dev` + `pnpm dev:window`).

- [ ] **T13: The message box: formatting, code, emoji, limits.**
  - New components: `ChatComposer`, `FormatToolbar`, `EmojiPicker`. TipTap with the Format toolbar and shortcuts, paste cleaning, Frimousse, counter, Enter/Shift+Enter, links opened outside.
  - Covers: AC-F03-03, 04, 06, 12, 15, 16, 17.
  - Tests: TC-F03-07, 09, 14, 22, 28, 30, 31, 33 (on screen), 34 (on screen), 81, 83.

- [ ] **T14: Reactions, replies, edit, delete, pins and polls in the app.**
  - New components: `MessageActions`, `PollCard`, `PollCreator`.
  - Covers: AC-F03-10, 11, 13, 14, 19, 20, 21, 22, 23.
  - Tests: TC-F03-21, 23, 26, 36, 42.

- [ ] **T15: Files, drag and drop, GIFs and stickers in the app.**
  - New components: `FileChip`, `GifPicker`, `StickerPicker` and the sticker pictures. Attach, chips with progress, previews, Download, drop area, paste; GIF picker searching KLIPY from the app ("Powered by KLIPY", results in KLIPY's order) with the one-time notice, reduced motion; stickers; Workspace settings: Allow GIFs.
  - Covers: AC-F03-24–29, 33, 34.
  - Tests: TC-F03-44, 45, 46, 49, 53, 55, 59, 61, 90 (app part), 93 (on screen).

- [ ] **T16: Chat setting, removed people and after the meeting in the app.**
  - Meeting chat setting in Meeting options, notes, "Chat is turned off", the app clearing chat when a ticket ends, Open chat from the meetings list.
  - Covers: AC-F03-35, 37, 40, 41, 42.
  - Tests: TC-F03-63, 66, 69, 72.

- [ ] **T17: Load test.**
  - `pnpm test:load` sends messages from the simulated people's side and measures delivery to the desktop app.
  - Covers: AC-F03-01 (100 people).
  - Tests: TC-F03-02.

- [ ] **T18: Keyboard, screen reader, translations and documentation.**
  - Keyboard-only run, announcements, translation keys, docs (API, runbooks, privacy-legal, project-structure, code map).
  - Covers: AC-F03-45, 46.
  - Tests: TC-F03-75, 77, 78; TC-F03-95 (screenshots, run at `/spec-verify`).
