---
feature: F03
title: In-meeting chat
status: approved
updated: 2026-10-20
---

# F03 In-meeting chat: Tasks (STEPS)

Small steps, done in order, on branch `feat/F03-chat`. Each step is committed and pushed when its tests pass (D026). Tick `[x]` when done and verified.
- **Tests per step (D052):** each step runs only its own test cases plus typecheck and lint. The whole suite, the desktop tests and the screenshots run once, at `/spec-verify`.
- **Library details:** before a step uses a library (TipTap, Frimousse, file-type, `@fastify/multipart`, sharp, LiveKit, KLIPY), it is checked against current docs (Context7). A difference updates design.md first, and the owner is told.

## Backend

- [ ] **T1: Libraries, the GIF service and settings.**
  - Vet the D058 libraries with `/add-dependency`: TipTap, Frimousse, file-type, `@fastify/multipart`. Each is installed in the task that first uses it.
  - KLIPY: confirm the free terms, the family-safe filter, no ads in API results, the image host name (D059). Get a free key into `.env` (`GIF_API_KEY`, not required in development: without it the GIF picker says GIFs aren't available).
  - Check that LiveKit passes can limit data publishing by topic (design 3.4); if not, apps ignore participant packets on `meetapp.chat`.
  - Check Electron's `setSpellCheckerDictionaryDownloadURL` with bundled dictionaries.
  - New settings in `config.ts`/`.env.example`; new folders in `docs/engineering/project-structure.md`.
  - Tests: none of their own (checks recorded in design.md and D058/D059).

- [ ] **T2: Database tables (migration `0005_chat`) and the permissions table.**
  - With `/db-migration`: `chat_messages`, `chat_attachments`, `chat_reactions`, `chat_pins`, `chat_polls`, `chat_poll_options`, `chat_poll_votes`, `chat_events`, `meetings.chat_mode`, `calls.chat_mode_at_end`, `workspaces.allow_gifs`.
  - `chat/permissions.ts` (design 3.1) and the Zod shapes in `packages/contracts/src/chat.ts`, including the message document (design 5.2).
  - Covers: AC-F03-03, 17 (shape part).
  - Tests: TC-F03-27, 32, 94.

- [ ] **T3: Sending, reading and delivering messages.**
  - Send (with `clientId`), history pages, one message, catching up (`chat/events`), the LiveKit broadcaster on `meetapp.chat`, large events by id, rate limits.
  - Covers: AC-F03-01, 02, 03, 05, 06.
  - Tests: TC-F03-03, 05, 06, 10, 13, 88 (server part), 89, 92 (server part).

- [ ] **T4: Editing, deleting, reactions, replies and pins.**
  - Covers: AC-F03-10, 11, 13, 14, 19, 20.
  - Tests: TC-F03-18, 19, 20, 24, 25, 35.

- [ ] **T5: Polls.**
  - Create, vote, results only after voting, anonymous voter keys, close, auto-close when the call ends, deleting a poll message.
  - Covers: AC-F03-21, 22, 23.
  - Tests: TC-F03-37, 38, 39, 40, 41.

- [ ] **T6: Files and pictures.**
  - Upload (streamed, 25 MB), content checks (no old Office files, no macros), sharp clean-up and previews, bomb limits, private storage, 5-minute links with safe headers, limits, clean-up of unsent and deleted files.
  - Covers: AC-F03-28, 30, 31, 32, 33, 34; AC-F03-05 (cut-off upload).
  - Tests: TC-F03-12, 50, 51, 52, 56, 57, 58, 60, 84, 85, 86.

- [ ] **T7: GIFs, stickers and the GIF switch.**
  - GIF search through the backend (fake GIF service in tests), GIF and sticker messages, `allowGifs` in workspace settings.
  - Covers: AC-F03-24, 26, 27.
  - Tests: TC-F03-43, 47, 48, 90.

- [ ] **T8: Chat setting, who can chat, after the meeting, deletion.**
  - `chatMode` in Meeting options, the room metadata and note, `chat_mode_at_end`, Off on every writing route, lobby and removed people, after-meeting routes, meeting deletion and the account deletion step, the readable-chats function for AI later.
  - Covers: AC-F03-35–44.
  - Tests: TC-F03-62, 64, 65, 67, 68, 70, 71, 73, 74, 91.

- [ ] **T9: Backend security sweeps.**
  - Outsider sweep generated from the router, other workspace and other meeting, logs without chat text, names and poll text stored as plain text.
  - Covers: S1, S2, S10, S11 for every new route.
  - Tests: TC-F03-79, 80, 82 (server part), 87.

## Desktop and app

- [ ] **T10: Desktop: spell check, Save as, drop safety, content policy.**
  - `spellcheck.ts` (bundled dictionaries, right-click menu), `downloads.ts`, the GIF and file storage hosts in `img-src`, dropped files never navigate the window.
  - Covers: AC-F03-18; AC-F03-31 (Save as).
  - Tests: TC-F03-33, 34, 93.

- [ ] **T11: Building blocks in the gallery.**
  - `/new-component` for the atoms, molecules and organisms in design 2.3, with stories, keyboard and axe checks; our own message renderer; the sticker set.
  - Covers: AC-F03-04, 16, 17 (renderer), 45 (components).
  - Tests: TC-F03-08, 29, 54, 76.

- [ ] **T12: The chat panel: a first real chat (milestone).**
  - Chat button and badge, panel, history and paging, sending with "Not sent" and Retry, live news, catching up after a reconnect, empty state, "New messages".
  - Covers: AC-F03-01, 02, 05, 07, 08, 09.
  - Tests: TC-F03-01, 04, 11, 15, 16, 17, 92 (app part).
  - Milestone: the owner tries chat with two windows (`pnpm dev` + `pnpm dev:window`).

- [ ] **T13: The message box: formatting, code, emoji, limits.**
  - TipTap with the Format toolbar and shortcuts, paste cleaning, Frimousse, counter, Enter/Shift+Enter, links opened outside.
  - Covers: AC-F03-03, 04, 06, 12, 15, 16, 17.
  - Tests: TC-F03-07, 09, 14, 22, 28, 30, 31, 81, 83.

- [ ] **T14: Reactions, replies, edit, delete, pins and polls in the app.**
  - Covers: AC-F03-10, 11, 13, 14, 19, 20, 21, 22, 23.
  - Tests: TC-F03-21, 23, 26, 36, 42.

- [ ] **T15: Files, drag and drop, GIFs and stickers in the app.**
  - Attach, chips with progress, previews, Download, drop area, paste; GIF picker with the one-time notice, reduced motion; stickers; Workspace settings: Allow GIFs.
  - Covers: AC-F03-24–29, 33, 34.
  - Tests: TC-F03-44, 45, 46, 49, 53, 55, 59, 61.

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
