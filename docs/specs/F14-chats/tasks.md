---
feature: F14
title: Chats (one to one and groups)
status: in-progress
updated: 2026-10-21
---

# F14 Chats (one to one and groups): Tasks (STEPS)

Small steps, done in order. Each step should be finishable and testable in one sitting.
Tick `[x]` when done and verified. While building, each step runs only its own tests plus typecheck and lint; the whole suite runs at `/spec-verify` (D052).

## Foundation
- [x] **T1: Library, contracts and the permissions table.**
  - Vet `@fastify/websocket` with `/add-dependency` (D064). Zod contracts in `packages/contracts/src/chats.ts` (conversations, members, requests, reads, status, live-line messages). `chats.permissions.ts`: every state × action, including pending, declined, left, removed, blocked, external, outside chat off.
  - Covers: AC-F14-13, 18, 27, 31, 34.
  - Tests: TC-F14-65.
  - **Built in T1:** `@fastify/websocket` 11.3.1 vetted (D064; installed in T9 where it is first used); `packages/contracts/src/chats.ts` (kinds, member states, statuses, limits, list items, start/add/read/decline bodies, people results, live-line messages both ways); `apps/api/src/modules/chats/chats.permissions.ts` with 7 unit tests over every state, kind and setting.

- [x] **T2: Migration `0006_chats`, step 1 (expand).**
  - `/db-migration`: `conversations`, `conversation_members`, `conversation_reads`, `chat_blocks`, `chat_request_cooldowns`, `workspaces.allow_outside_chat`, `user_settings.read_receipts`; nullable `conversation_id` on F03's tables; a conversation for every meeting (unique `meeting_id`); F02's meeting creation creates it; F03 code writes both columns.
  - Covers: AC-F14-28 (base), D065.
  - Tests: TC-F14-77 (first part), TC-F14-78.
  - **Built in T2:** schema `conversations.ts` (5 tables, each with `id`, `workspace_id` where owned) and migration `0006_chats` (adds only: meeting columns optional, empty `conversation_id` on F03's 5 tables with indexes, `user.read_receipts` and `workspaces.allow_outside_chat` default on); `meetingConversation` (find or create, safe to repeat) used by every F03 save, so new rows and news carry their conversation; new meetings get theirs at creation. Tests: migration on an F03 database loses nothing; one conversation per meeting; one direct chat per pair; F03's chat and meetings backend suites pass (132).

- [x] **T3: Migration steps 2 and 3 (fill, then read by conversation).**
  - The re-runnable fill until no message is left without a conversation; F03's reads switch to `conversation_id`; F03's routes find the meeting's conversation.
  - Covers: AC-F14-28, D065.
  - Tests: TC-F14-77, TC-F14-80.
  - **Built in T3:** `fillConversations` (meetings get conversations; F03's 5 tables filled in batches of 5,000; safe to stop and re-run; returns rows filled) runs once before the server starts serving and on every chat clean-up; F03's reading functions (page, one, news, pins, quotes, polls, files, last news number) and news numbering now work by conversation; `chatActor`/`afterActor` hand services the meeting's conversation. Tests: the fill with 12,000 old messages while new ones arrive (none lost, none left, re-run 0); F03's chat, meetings and calls backend suites pass (199). The desktop suites run at `/spec-verify` (D052).

## Backend
- [x] **T4: Conversations and the chat list.**
  - Start a direct chat (unique per pair and workspace) or a group; the list with Personal/external rule, meeting chats by F03's rules, filters, name search (case and accents), unread counts, pinned (15), mute, hide.
  - Covers: AC-F14-01–05, 07, 09, 15, 28, 35.
  - Tests: TC-F14-01, 03, 05, 06, 07, 08, 09, 12, 15, 57, 72.
  - **Built in T4:** `chats.repository.ts`, `chats.service.ts`, `chats.routes.ts`, `chats.search.ts`: start a direct chat (one per pair per workspace, also under races) or a group (up to 250); the list (own workspace's chats, meeting chats by F03's rules through `chatAfter.readable`, newest first, pinned on top up to 15, unread counts after the read mark, filters, name search ignoring case and accents in the service); per-person pin, mute and hide; read marks that never move back; conversations' last activity updated on every message. 16 tests. Moved: a hidden chat coming back with a new message is tested in T8 (sending); workspace deletion in T11. People outside the workspace are refused until T6.

- [x] **T5: People lookup and invitations.**
  - To: suggestions from members; exact email returns one account (30 a minute, D063, logged without the email); Personal "Join me on MeetApp" invitations (20 a day); team workspaces use F01's invitation.
  - Covers: AC-F14-07, 08.
  - Tests: TC-F14-11, 13, 14.
  - Built in T5: `GET /workspaces/:id/people?q=`, `POST /me/invitations`; 3 tests. Suggestions show no job title (F01 accounts have none).

- [ ] **T6: Chat requests and blocking.**
  - Pending requests, preview, accept, delete (30-day wait), block and unblock, 10 messages while pending, 20 requests a day, 30-day expiry (read-time hiding plus the daily job), Personal everyone-external.
  - Covers: AC-F14-10–13.
  - Tests: TC-F14-16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 66.

- [ ] **T7: Group chats.**
  - 3–250 people, rename, add with history (none, 1–365 days, all), remove and leave (`left_seq`), external members' requests, last member leaves.
  - Covers: AC-F14-14–18.
  - Tests: TC-F14-29, 30, 31, 32, 33, 34, 35.

- [ ] **T8: Messages in conversations, mentions and reads.**
  - F03's message, reaction, reply, pin, poll, file and GIF routes per conversation (any member pins and creates polls); edit and delete any time; `mention` parts; read marks, unread, "Seen" and "who has seen" with the receipts setting.
  - Covers: AC-F14-19, 21, 22, 24.
  - Tests: TC-F14-36, 37, 38, 39, 45, 48, 49.

- [ ] **T9: The live line.**
  - `GET /realtime` WebSocket: sign-in before opening, session end closes lines within 2 seconds, Redis channels per conversation and person, subscriptions updated within 2 seconds, typing, limits (64 KB, 5 lines, ping), catch-up after reconnect.
  - Covers: AC-F14-18, 20, 23, 34.
  - Tests: TC-F14-41, 43, 47, 64, 73, 74, 75.

- [ ] **T10: Status.**
  - Available, Away, Offline from the line (offline within 35 seconds), In a meeting from calls, locked computer; only colleagues and accepted contacts see it.
  - Covers: AC-F14-26.
  - Tests: TC-F14-51, 52.

- [ ] **T11: Workspace setting, leaving a workspace, deletion and export.**
  - Outside chat on and off (both sides, several workspaces), removed from or leaving a workspace, account deletion step and data export, workspace deletion.
  - Covers: AC-F14-27, 33, 34, 35.
  - Tests: TC-F14-54, 55, 56, 69, 70, 71.

- [ ] **T12: Security sweeps.**
  - The outsider sweep over every new route and the live line; same-looking refusals; no chat text, file names or emails in logs.
  - Covers: AC-F14-31, 32.
  - Tests: TC-F14-63, 67, 68.

## Desktop and app
- [ ] **T13: Desktop: the live line's token, security policy and lock events.**
  - `applyApiAuth` with the `ws`/`wss` pattern, `connect-src` with exactly that address, `powerMonitor` lock events through `window.meetapp.power.onLockChange` (bridge tests updated).
  - Covers: AC-F14-26, 31.
  - Tests: TC-F14-76.

- [ ] **T14: New UI building blocks.**
  - `StatusDot`, `ChatListItem`, `ChatRequestCard`, `PeoplePicker`, `TypingIndicator`, `SeenMark`, `HistoryChoice`, `ChatList`, `ConversationHeader`, `GroupDetails`, `NavRail` (the folding menu in `AppLayout`), with stories, tests and screenshots.
  - Covers: AC-F14-01, 02, 36.
  - Tests: TC-F14-02, 79, 81.

- [ ] **T15: The Chat screen (milestone).**
  - Side-menu Chat with its badge, the chat list and the conversation, New chat, the app's live-line client with reconnect and catch-up, meeting chats from the list.
  - Covers: AC-F14-01–09, 20, 28, 29.
  - Tests: TC-F14-04, 10, 58, 59.

- [ ] **T16: Requests, groups, status, typing, Seen and mentions in the app.**
  - Chat requests screen, group details, status dots, "is typing", "Seen", mentions, Settings → Privacy (blocked people, read receipts), the folding menu.
  - Covers: AC-F14-10–18, 22–24, 26, 36.
  - Tests: TC-F14-17, 46, 53, 82.

- [ ] **T17: Delivery, failures and the Redis fallback.**
  - Delivery within a second between windows, "Not sent" with Retry, refreshing while Redis is down.
  - Covers: AC-F14-20, 25.
  - Tests: TC-F14-40, 44, 50.

- [ ] **T18: Load test.**
  - A 250-person group of simulated members on live lines delivering to the desktop app (`pnpm test:load`).
  - Covers: AC-F14-20.
  - Tests: TC-F14-42.

- [ ] **T19: Keyboard, screen reader, translations and documentation.**
  - Keyboard-only run, announcements, translation keys, docs (API, runbooks, privacy-legal, project structure, READMEs).
  - Covers: AC-F14-30.
  - Tests: TC-F14-60, 61, 62.
