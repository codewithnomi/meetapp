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

- [x] **T6: Chat requests and blocking.**
  - Pending requests, preview, accept, delete (30-day wait), block and unblock, 10 messages while pending, 20 requests a day, 30-day expiry (read-time hiding plus the daily job), Personal everyone-external.
  - Covers: AC-F14-10–13.
  - Tests: TC-F14-16, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 66.
  - Built in T6: requests, preview, accept, delete (+block), 30-day wait, 20 a day, expiry, block/unblock (`POST /me/blocked` added for blocking from an accepted chat); 10 tests. Moved: the 10-message limit (TC-21), sending in a blocked or shared group chat (TC-25 send part, TC-27) to T8 where sending lands; status parts (TC-18, 25) to T10; the `list` news item (TC-16) to T9; the all-states sweep TC-66 to T12. The "next day" part of TC-22 relies on the 24-hour rate window (rate-limit unit tests).

- [x] **T7: Group chats.**
  - 3–250 people, rename, add with history (none, 1–365 days, all), remove and leave (`left_seq`), external members' requests, last member leaves.
  - Covers: AC-F14-14–18.
  - Tests: TC-F14-29, 30, 31, 32, 33, 34, 35.
  - Built in T7: rename, add with history, remove anyone, leave, groups with outside people at creation, notes (named, added, removed, left, didn't join), empty groups deleted by the clean-up after 30 days; 5 tests. Reading only up to `left_seq` and refused sends (TC-34) are checked in T8, the live line's part in T9.

- [x] **T8: Messages in conversations, mentions and reads.** (split in two in T8: 8a messages, 8b pins, polls, files and GIFs)
  - F03's message, reaction and reply routes per conversation; edit and delete any time; `mention` parts; read marks, unread, "Seen" and "who has seen" with the receipts setting.
  - Covers: AC-F14-19, 21, 22, 24 (and from T6/T7: AC-F14-12 10 messages, 13 send in blocked chats, 18 reading up to leaving).
  - Tests: TC-F14-36, 39, 45, 48, 49 (and TC-F14-21, 25, 27, 34 moved here).
  - Built in T8: migration `0007_chats_people` (D066), F03's rules on a shared "seat" (call join or chat account), `/conversations/:id/messages`, `…/events`, edits, deletes, reactions, `…/seen`, `PATCH /me/settings`, mentions (members only), `mentioned` in the list, hidden chats come back on a new message; 9 integration + 2 unit tests; F03's 134 chat tests still pass. The `read` news on the line is T9.

- [x] **T8b: Pins, polls, files and GIFs in chats.**
  - F03's pin (any member, 3 at most), poll (any member creates, its creator closes), file (25 MB, safe types, 10 a minute, 2 GB per chat) and GIF routes per conversation, using the D066 columns.
  - Covers: AC-F14-19.
  - Tests: TC-F14-37, 38.
  - Built in T8b: migration `0008_chat_pins_per_conversation` (the 3-pin limit per chat), pins/polls/files/GIF settings on the shared seat (meeting organizers keep their poll rights), `/conversations/:id/pins`, `…/polls`, `…/attachments`, `…/gif-settings`; the file total is counted per conversation (500 MB meetings, 2 GB chats); 5 tests; F03's chat tests still pass. Virus scanning is still the open item before going online (progress.md).

- [x] **T9: The live line.**
  - `GET /realtime` WebSocket: sign-in before opening, session end closes lines within 2 seconds, Redis channels per conversation and person, subscriptions updated within 2 seconds, typing, limits (64 KB, 5 lines, ping), catch-up after reconnect.
  - Covers: AC-F14-18, 20, 23, 34.
  - Tests: TC-F14-41, 43, 47, 64, 73, 74, 75.
  - Built in T9: `@fastify/websocket` 11.3.1 (registered first in the app so every route sees upgrades), `GET /api/v1/realtime`, a hub per server (`chats-line.ts`) following `conv:<id>` and `user:<id>` Redis channels, news/notes/typing/read/list published by the services, the session re-checked every second, 64 KB / 5 lines / 2-minute ping limits, the typing timing helpers for the app (`apps/web/src/features/chats/typing.ts`); 10 integration + 2 unit tests. Found and fixed: the hub's Redis listener must queue subscriptions until connected. Note: the test helper `injectWS` never settles when a line is refused, so refusals are checked over a real connection. The desktop side (token on the upgrade, `connect-src`) is T13; `status` news is T10.

- [x] **T10: Status.**
  - Available, Away, Offline from the line (offline within 35 seconds), In a meeting from calls, locked computer; only colleagues and accepted contacts see it.
  - Covers: AC-F14-26.
  - Tests: TC-F14-51, 52.
  - Built in T10: the status rule (`chats-status.ts`), presence in Redis per line (`chats-presence.ts`), the status service (who may see: colleagues and accepted contacts, minus blocks), `status` news on `status:<id>` channels followed only by allowed lines, a 30-second sweep (Away after 5 idle minutes, calls), Offline 30 seconds after the last line closes, `GET /people/status?ids=`, status in the chat list and New chat suggestions; 2 tests. The hub now finishes its status work before the server closes. The locked-computer signal from the desktop is T13; removal from a workspace stopping status is T11.

- [x] **T11: Workspace setting, leaving a workspace, deletion and export.**
  - Outside chat on and off (both sides, several workspaces), removed from or leaving a workspace, account deletion step and data export, workspace deletion.
  - Covers: AC-F14-27, 33, 34, 35.
  - Tests: TC-F14-54, 55, 56, 69, 70, 71.
  - Built in T11: `allowOutsideChat` in the workspace settings (owner and admins), read-only reasons for the app's note (`readOnlyReason` in the list: blocked, outside_off, left_workspace, left; `CHAT_OUTSIDE_OFF` on sends), `chats.forgetMembership` called by F01's remove and leave (notes, read-only one-to-one chats, lines refreshed), `chatsRequests.forgetPerson` for account deletion (F10 calls it with F03's `chatUpkeep.forgetPerson`, which now also covers the account columns of D066), the export includes chats; 5 tests. Workspace deletion doesn't exist yet: the database already removes a workspace's chats with it (cascade); removing their stored files belongs to the step that builds workspace deletion.

- [x] **T12: Security sweeps.**
  - The outsider sweep over every new route and the live line; same-looking refusals; no chat text, file names or emails in logs.
  - Covers: AC-F14-31, 32.
  - Tests: TC-F14-63, 67, 68.
  - Built in T12: `chats-security.integration.test.ts`: the outsider sweep generated from the server's route list (every `:conversationId` route answers three kinds of outsiders exactly as for a missing chat), each membership state (TC-F14-66, moved here from T6), same-looking refusals with timing, and a log scan with marker strings. Found and fixed: search words (`?q=`, which can hold a typed email) were written into request logs and traces; `q` is now hidden like other sensitive query values.

## Desktop and app
- [x] **T13: Desktop: the live line's token, security policy and lock events.**
  - `applyApiAuth` with the `ws`/`wss` pattern, `connect-src` with exactly that address, `powerMonitor` lock events through `window.meetapp.power.onLockChange` (bridge tests updated).
  - Covers: AC-F14-26, 31.
  - Tests: TC-F14-76.
  - Built in T13: `applyApiAuth` covers the backend's `ws`/`wss` address, `connect-src` adds exactly that address, main forwards `powerMonitor` lock/unlock to the window, preload exposes `power.onLockChange(listener)` (returns "stop listening"); 3 unit tests, 2 desktop tests (`live-line.spec.ts`), the bridge list in `tests/e2e/desktop/desktop.ts` updated (TC-F02-113 still passes).

- [x] **T14: New UI building blocks.**
  - `StatusDot`, `ChatListItem`, `ChatRequestCard`, `PeoplePicker`, `TypingIndicator`, `SeenMark`, `HistoryChoice`, `ChatList`, `ConversationHeader`, `GroupDetails`, `NavRail` (the folding menu in `AppLayout`), with stories, tests and screenshots.
  - Covers: AC-F14-01, 02, 36.
  - Tests: TC-F14-02, 79, 81.
  - Built in T14: atoms `StatusDot` (+ icons `menu`, `phone`, `mail`, `muted`; Tooltip `side="right"`); molecules `ChatListItem`, `ChatRequestCard`, `PeoplePicker` (combobox), `TypingIndicator`, `SeenMark`, `HistoryChoice`; organisms `ChatList`, `ConversationHeader`, `GroupDetails`, `NavRail`; `AppLayout` now uses `NavRail` (folding is optional: the main menu folds, Settings' menu doesn't); the main menu folds with the choice kept in `meetapp.nav.folded` (`features/chats/nav-folded.ts`); the time label (`features/chats/time-label.ts`); stories for every state, 28 component and unit tests. Screenshot baselines for the new stories are made at `/spec-verify` with the other screenshots (D052); the `ui-reviewer` check runs there too.

- [x] **T15: The Chat screen (milestone).**
  - Side-menu Chat with its badge, the chat list and the conversation, New chat, the app's live-line client with reconnect and catch-up, meeting chats from the list.
  - Covers: AC-F14-01–09, 20, 28, 29.
  - Tests: TC-F14-04, 10, 58, 59.
  - Built in T15: `pages/ChatsPage` (list, open chat, New chat), the Chat item in the side menu with its unread badge, `features/chats` (requests, live-line client with reconnect and catch-up, activity and lock reporting, the list hook), meeting chat's screen code now works from a "place" (a call or a chat) so chats reuse it (messages, replies, reactions, files, GIFs, polls, pins), `ChatPanel`/`ChatArea` take an optional header and message-box text, the chat vote is `PUT` like meeting chat's, the list item carries `meetingId`; 2 unit test files, 2 desktop tests (`chats.spec.ts`), all F03 desktop chat tests still pass. Found and fixed: opening a chat didn't refresh the app's own unread count. TC-F03-13's flakiness (progress.md watch item) was the test's timing (a slow rejoin inside the 10-second window); the rejoin now happens first. Open: TC-F14-58's "live meeting chat from the list during a call" opens it read-only for now (the call screen's chat stays the place to write during a call); TC-F14-59's paging is covered by the shared page code and its F03 tests, with a 120-message desktop check left for `/spec-verify`.

- [x] **T16: Requests, groups, status, typing, Seen and mentions in the app.**
  - Chat requests screen, group details, status dots, "is typing", "Seen", mentions, Settings → Privacy (blocked people, read receipts), the folding menu.
  - Covers: AC-F14-10–18, 22–24, 26, 36.
  - Tests: TC-F14-17, 46, 53, 82.
  - Built in T16: Chat requests pane, group details with Add people (history choice), rename, remove, leave; Block in a chat's More menu; "… is typing" and "Seen" above the message box; @mentions in the composer (`@tiptap/extension-mention` and `@tiptap/suggestion` 3.31.4, MIT, the tiptap team, released 30 Sep 2026; with `@floating-ui/dom` 1.8.0 they need); Settings → Privacy (read receipts, blocked people with Unblock); the workspace's "Chat with people outside the workspace" switch; server: `GET /conversations/:id/members` and `GET /me/settings`; 4 desktop tests (`chats-more.spec.ts`), 2 unit/integration tests. Found and fixed: (1) a late presence write could undo a closed line, leaving people Available after closing the app; writes per line now run in order; (2) a line that stops pinging counts as gone after 75 s (two missed pings), not 3 minutes; a server shutting down clears its own lines; (3) `packages/ui`'s `.test.ts` files weren't run at all (only `.test.tsx`); they now are, and pass.

- [x] **T17: Delivery, failures and the Redis fallback.**
  - Delivery within a second between windows, "Not sent" with Retry, refreshing while Redis is down.
  - Covers: AC-F14-20, 25.
  - Tests: TC-F14-40, 44, 50.
  - Built in T17: announcing on Redis never fails the change (the publisher swallows Redis errors; saved news is caught up); the hub tells its lines `{ t: "polling", on }` when its Redis connection closes and returns; the app then refreshes the open chat every 10 s and the list every 30 s; `chats-line-parts.ts` holds the line's shapes (file-size rule). Tests: 2 desktop (`chats.spec.ts`: 20 messages, 95% under 1 second between windows; "Not sent", Retry twice, stored once), 1 integration (TC-F14-44 at server level: polling on and off, sending still works). The desktop half of TC-F14-44 (stopping the shared Redis while windows are open) is left for `/spec-verify`. **Watch:** TC-F14-53's "Offline" step took longer than 60 s once in a combined run on a busy Mac; it passed in the other runs.

- [x] **T18: Load test.**
  - A 250-person group of simulated members on live lines delivering to the desktop app (`pnpm test:load`).
  - Covers: AC-F14-20.
  - Tests: TC-F14-42.
  - Built in T18: `tests/load/chat-crowd.ts` writes the 249 simulated people straight into the test database (the backend allows 50 sign-ups an hour), each with a session only the test knows; each opens a live line with Node's own WebSocket and sends through the normal API. 300 messages over 3 minutes. First run (2026-10-22): 95% shown in the app within 337 ms (slowest 510 ms), every line got all 300, none dropped. `pnpm test:load -- -g TC-F14-42` runs just this test.

- [x] **T19: Keyboard, screen reader, translations and documentation.**
  - Keyboard-only run, announcements, translation keys, docs (API, runbooks, privacy-legal, project structure, READMEs).
  - Covers: AC-F14-30.
  - Tests: TC-F14-60, 61, 62.
  - Built in T19: `chats-keyboard.spec.ts` (TC-F14-60 the whole Chat screen with the keyboard only, with axe on the Chat screen, New chat, Chat requests and Group details; TC-F14-61 announcements and names); the no-hard-coded-text check now covers `pages/ChatsPage` and `features/chats` (TC-F14-62); the keyboard helper `tabTo` moved to `keyboard-steps.ts`. Problems the keyboard test found and fixed: no focus in To: on New chat or Add people; no focus in the message box on opening a chat or pressing Reply; a chat started while a filter or search was on didn't open; closed tooltips stayed on the page (their fade-in also ran while closing) and caught Escape, so dialogs didn't close; Leave group left without the designed question; own messages' actions were read as "Actions for You's message" (now "Actions for your message", meeting chat too). Docs: privacy-legal (chats, requests and blocks, status), project structure, READMEs (web, api, ui, contracts, db), local-services runbook (Redis down, Offline).

## Fixes from the first verification (2026-10-23, verification.md)
- [x] **T-fix-1: Chat list respects the read window (privacy, High).** `lastMessages`, `unreadCounts` and the mention flag use the member's `history_from` and, after leaving or removal, `left_seq`; integration tests for "no history" and "removed".
- [x] **T-fix-2: Live line clean-ups.** Server: a line closed during `open`/`refresh` follows nothing and leaves no id in the 5-line list. App: no reconnect after 4001/4400 (4401 until signed in again), ignore an old socket's close, one ping timer. Malformed Redis messages dropped. Origin checked on the upgrade (Medium security). Swallowed errors get a reason.
- [x] **T-fix-3: The open chat stays open** when the filter or search no longer matches it (kept apart from the filtered list).
- [x] **T-fix-4: Loading and error states** for the chat list, Chat requests, a conversation and Group details (with Retry), read-mark failures retried; h2 in the panes; translated unread names; New chat's Start disabled while sending and Invite errors shown.
- [x] **T-fix-5: Read marks and mentions.** Unread by news number (clamped to the chat's last); "Seen" only from accepted members; editing cleans mentions.
- [ ] **T-fix-6: Tests for AC-29 and AC-35** (TC-F14-59 paging with no gaps or repeats and the history limit; TC-F14-72 workspace deletion removes chats and files) and page tests for `pages/ChatsPage`, bringing `features/**` branch coverage to 80%.
- [ ] **T-fix-7: Documentation** listed in verification.md (design folders and endpoints, D067 for the mention libraries, overview, operations, privacy, desktop README, security S5, progress).
- [ ] **T-fix-8: Status after closing the app** as the owner decides (now "Away" for 30 s, then Offline).
- [ ] **T-fix-9: Second verification:** rerun the desktop tests (with sign-ups available) and create the new screenshots after the owner looks at them.
