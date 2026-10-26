---
feature: F14
title: Chats (one to one and groups)
status: approved
updated: 2026-10-21
---

# F14 Chats (one to one and groups): Design (HOW)

## Summary (plain English)
Chats reuse everything F03 built for meeting chat (the message box, messages, reactions, replies, files, GIFs, stickers, pins, polls and their safety checks). What is new:
- **One kind of "conversation" for everything.** A one-to-one chat, a group chat and a meeting's chat are all conversations. F03's tables get a conversation number, so a message, a reaction or a file works the same in every kind (D065).
- **A live line to the server while the app is open** (a WebSocket, D064). It carries new messages, edits, reactions, "is typing", "Seen" and status to everyone who has MeetApp open, within a second, also when nobody is in a call. During a call, meeting chat keeps F03's path through the call server.
- **Chat requests** for people outside the workspace (and everyone in Personal), as in Teams: the receiver accepts, deletes or blocks; blocked people can't reach you.
- **Status** (Available, Away, In a meeting, Offline) is worked out by the server from the live line and from calls, and shown only to colleagues and accepted contacts.
- **Unread counts and "Seen"** come from each person's "read up to here" mark per conversation.
- **The side menu folds** to icons with tooltips; the choice is kept on the computer.
Nothing new costs money: the same backend, database and Redis.

## 1. What gets created
```
packages/db/src/schema/conversations.ts   conversations, members, reads, blocks; migration 0006_chats
packages/contracts/src/chats.ts           chats, members, requests, reads, status, live-line messages
apps/api/src/modules/chats/               routes, services, repositories: conversations, members, requests,
                                          blocks, reads; permissions table (chats.permissions.ts)
apps/api/src/modules/realtime/            the live line: connect, who is listening, Redis fan-out, status
apps/api/src/modules/chat/                F03, changed to work on a conversation (not only a meeting call)
apps/web/src/features/chats/              chat list, requests, reads, typing, status, live-line client
apps/web/src/features/realtime/           one live line per app, reconnects, hands news to features
apps/web/src/pages/ChatsPage/             the Chat screen: list, conversation, new chat, requests, group panel
packages/ui/src/…                         ChatListItem, StatusDot, ChatRequestCard, PeoplePicker, NavRail (2.3)
apps/desktop/src/main/                    the live line's address added to the security policy and token rule; powerMonitor
                                          lock events and the preload's `power.onLockChange` (status "Away")
```

## 2. Screens and user flow (approved canvas row "Chats (F14)")
### 2.1 Chat screen (F14Chat)
- **Side menu:** a ☰ button folds it to a 72 px icon rail (AC-36); tooltips name each item; Chat shows the number of chats with unread messages (AC-02). The choice is kept in this computer's storage.
- **Chat list (left):** "Chat" heading, **New chat**, search, filter chips **All · Unread · Chats · Meeting chats** (AC-03), a **Chat requests** link with its count (AC-10), **Pinned** chats first (AC-05), then the rest by last activity (AC-01). Each row: avatar with status dot (or group initials, or a calendar for meetings), name, last line with "You:", time, unread count in bold (AC-02).
- **The open chat stays open** when the filter or search no longer lists it (as in Teams): the right side looks it up in the unfiltered list, so its draft is kept; it closes only when the chat is really gone (left, hidden).
- **Loading and errors:** the chat list, Chat requests, a conversation and Group details show a spinner while loading and "Couldn't load this" with **Retry** after a failure (never "No chats yet" then); failed actions (accept, delete, rename, add, remove, leave, invite) say so; a failed read mark is sent again after 5 seconds; New chat's Start works once (no double groups). The panes use h2 under the screen's h1 "Chat"; the side menu reads "Chat, 3 unread chats".
- **Conversation (right):** header with name, status in words, **Video call** and **Audio call** (shown, working in F15), More (pin, mute, hide, group details). Messages as F03 (grouped bubbles, big emoji, Teams reactions), plus @mention highlight (AC-22), "Seen" (AC-24), "is typing…" (AC-23). Composer as F03 with "Message <name>".
- **Empty states:** "No chats yet" with New chat (AC-06); a chat with no messages: "Say hello to <name>".
### 2.2 New chat (F14NewChat)
- **To:** with chips; suggestions from the workspace's members as typed (name, title, status), and an exact email shows that account (External if not a member) or "No one with this email uses MeetApp yet" with **Invite** (AC-07, 08). One person → their one-to-one chat (existing or new, AC-09); two or more → a group with an optional name.
### 2.3 Chat requests (F14Requests)
- The request list; a request shows sender, email, "(External)", **Preview messages**, **Accept**, **Delete** (with "Also block") (AC-10, 11). The sender sees "Waiting for <name> to accept…" and the 10-message limit (AC-12).
### 2.4 Group details (F14Group)
- Name (any member can rename, AC-16), people with status and "(External)", **Add people** with the history choice (none / last 1–365 days / all, AC-17), remove (AC-18), **Leave group**.
- **Workspace settings → Chat:** "Chat with people outside the workspace" (owner, admins; AC-27).
### 2.5 New UI components (Atomic Design, `packages/ui`)
- **Atoms:** `StatusDot` (colour plus a word for screen readers). Every new part has stories (each state) and tests; `PeoplePicker`, `HistoryChoice` and `NavRail` get screenshot tests. `AppLayout` stays a template that uses the `NavRail` organism.
- **Molecules:** `ChatListItem`, `ChatRequestCard`, `PeoplePicker` (To: field with chips and suggestions), `TypingIndicator`, `SeenMark`, `HistoryChoice`.
- **Organisms:** `ChatList` (heading, search, filters, requests link, pinned and other rows), `ConversationHeader`, `GroupDetails`, `NavRail` (the folding side menu, used by `AppLayout`).
- Reused from F03: `ChatPanel` parts, `ChatMessage`, `ChatComposer`, `ExpressionPicker`, `PollCard`, `PollCreator`, `AttachmentCard`.

## 3. How chats work
### 3.1 Conversations (D065)
- `conversations.kind` is `direct`, `group` or `meeting`. Meeting conversations are made for every meeting (migration backfills F03's meetings), so meeting chat works as before.
- A **direct** conversation is unique per pair of people per workspace (AC-09): a unique key on (workspace, the two user ids in order).
- **Membership** (`conversation_members`): user, state (`accepted`, `pending`, `declined`, `left`, `removed`), `left_seq` (the last news number they may read after leaving or removal), `external` (not a member of the workspace), `history_from` (what they may read, AC-17), `pinned_at`, `muted`, `hidden`. Meeting conversations have no member rows: F03's rules decide who reads them (attendance).
- **Where a chat is listed (AC-01, 03, 28):** a person's list in workspace W shows (a) direct and group conversations of W where they are an accepted, non-external member (or left/removed from a group: read up to `left_seq`); (b) meeting conversations of W whose chat they may read under F03's rules (AC-42: they took part, F02 attendance); (c) in their Personal workspace, every conversation where they are external (requests under Chat requests while pending).
- **Live-line subscriptions for meetings:** a meeting conversation is followed on the live line while the person may read it (during the call through the call server as in F03, and afterwards through the line, so edits and deletions after the meeting still reach them).
### 3.2 Who may do what (`chats.permissions.ts`, unit tested)
| Action | Who |
|---|---|
| read, write, react, reply, pin/unpin, create a poll, add people, remove people, rename, leave | accepted members of a direct or group conversation (any member, as in Teams, AC-15–19); a poll's creator closes it |
| edit/delete own message | the sender, any time (AC-21) |
| see a pending request, preview it, accept, delete, block | the invited person |
| send while pending | the starter, up to 10 messages (AC-12) |
| start a chat with an external person | a member of W while W allows outside chat (AC-27), the target not blocking them, at most 20 new requests a day, not within 30 days of a deleted request (AC-11, 12) |
| turn outside chat on or off | W's owner and admins |
| **pending** (invited, not accepted) | preview from `history_from`; nothing else (no writing, reactions, pins, members' status, adding people) |
| **declined** | nothing |
| **left or removed from a group** (AC-18) | read up to `left_seq`; nothing else |
| **removed from the workspace or left it** (AC-34) | nothing in that workspace's chats (this rule wins over AC-18's "keep reading", as in Teams) |
| **blocked, direct chat** (AC-13) | read-only for both |
| **outside chat off** (AC-27) | read-only for every member of a chat that has an external member |
| **external, accepted** | as a member, but no workspace people search |
- Meeting conversations keep F03's table (`chat.permissions.ts`), unchanged.
- Every refusal looks like "not found" (AC-31). Roles and membership are read again on every request. The unit tests cover every state × action pair.
- **Outside chat across workspaces (AC-27, decided as in Teams):** a request is refused (as "not found") when the starter's workspace has outside chat off, or when the target belongs only to team workspaces that all have it off. If at least one of the target's team workspaces allows it (or they have only Personal), the request goes to their Personal list.
### 3.3 Sending and delivery (AC-19, 20)
1. `POST /conversations/:id/messages` (signed in) runs F03's checks (document, files, limits per person, AC-19), saves the message and a news item in `chat_events` (now keyed by conversation).
2. The server **publishes** the news on Redis channel `conv:<id>`. Every API server listening for one of the members' live lines **sends** it to them (D064).
3. Apps apply news as in F03 (numbered news, catch-up on gaps, "mine" worked out in the app). An app that was offline loads the newest page when it opens a chat, and the chat list shows unread counts from the server (3.5).
4. For a **meeting** conversation during a call, news also goes through the call server, as in F03.
- Large groups: one Redis message per news item; each server sends it only to its own connected members. 250 members × one small packet is well inside one server's capacity (load test, AC-20).
### 3.4 The live line (D064)
- `GET /api/v1/realtime` upgraded to a WebSocket (`@fastify/websocket`). The sign-in check runs **before** the line opens (`preValidation`). Desktop: `applyApiAuth` gets a second URL pattern built from `apiUrl` with scheme `ws`/`wss` (same host and port) for both `onBeforeRequest` and `onBeforeSendHeaders`, so the upgrade carries the token like any request; the security policy's `connect-src` gains exactly that address; a desktop test checks the upgrade carries `Authorization` and that the page can't open a line to any other host. The web app (F10) will use its cookie.
- **Session ends** (sign-out, sign-out everywhere, token expiry, password change, F01's revoke): the server closes that person's lines within 2 seconds; the app reconnects only with a new token.
- After opening, the server subscribes the line to the person's conversations (`conv:<id>`) and personal channel (`user:<id>`: new chats, requests, membership changes, list updates). Joining or leaving a conversation updates the subscriptions at once (AC-18, 34: within 2 seconds).
- **Messages on the line** (JSON, checked by Zod both ways): server → app `news` (conversation id + F03 event), `typing`, `read`, `status`, `list` (a chat appeared, changed or went); app → server `typing` (conversation id), `active` (a key or mouse action, at most once a minute), `ping`. The app sends nothing else on the line; everything that changes data uses normal requests, so the same checks and limits apply.
- Limits: 64 KB per message; 10 typing signals per 10 seconds per person; the app pings every 30 seconds and lines without a ping for 2 minutes are closed; at most 5 lines per person (a 6th closes the oldest with code 4001; a line closed while it is still opening follows nothing and doesn't count); the upgrade is refused (403) when it names an origin other than the app's own; malformed Redis messages are dropped; one line follows all the person's conversations through two Redis channels per person plus one per conversation.
- **Reconnect:** the app reconnects with growing waits (1, 2, 4… up to 30 seconds), except after codes 4001 (replaced by a newer window), 4400 (refused) and 4401 (signed out), where it stays closed until signed in again; it then catches up each open conversation from its last news number (F03's catch-up) and reloads the list.
### 3.5 Reading, unread and "Seen" (AC-02, 24)
- `conversation_reads (conversation_id, user_id, last_read_seq, last_read_at)`. Opening a chat at the bottom (or scrolling to the newest message) sends `PUT /conversations/:id/read` with the newest seen news number, at most once every 2 seconds.
- **Unread** for a chat = messages after `last_read_seq` not sent by the person; the list asks the server for counts (one query per list load, then updated by news). The side menu counts chats with unread messages (AC-02).
- **Seen:** in direct chats and groups of up to 20, readers' marks go to members as `read` on the live line, unless the reader turned read receipts off (`user.read_receipts`), in which case they neither send nor receive marks (AC-24, as in Teams). Because `conv:<id>` reaches everyone, the sending server filters `read` per receiver. **Who has seen** a group message: `GET /conversations/:id/messages/:mid/seen`. Groups of 21–250: none.
- **Mentions (AC-22):** the message document gains a `mention` inline part (user id + name as shown); a mentioned person's unread counts even when muted. Only members can be mentioned.
### 3.6 Typing (AC-23)
- The app sends `typing` at most every 3 seconds while the person types; the server forwards it to the other members (not stored). The others show "<name> is typing…" and hide it 5 seconds after the last signal.
### 3.7 Chat requests and blocking (AC-10–14)
- Starting a chat with an external person creates the conversation with the starter `accepted` and the other `pending`. The pending person gets a `list` news item on `user:<id>`; their Personal list shows it under Chat requests.
- **Accept** → `accepted`. **Delete** → `declined` (the conversation disappears for them; the starter sees nothing new; a 30-day wait before a new request to the same person). **Block** → a `blocks (blocker_id, blocked_id)` row: the blocked person can't start chats with the blocker, send in an accepted chat between them (read-only for both), or see their status; in group chats they share, nothing changes (as in Teams). Only external people can be blocked.
- Unanswered requests expire after 30 days: reads hide them at once and the regular chat clean-up marks them declined; the starter's list item says `request: "not_accepted"` ("<name> didn't accept"). A deleted request shows "waiting" to the starter until the same 30 days pass, so the sender is never told. Asking again later reuses the same direct chat.
- Group requests: the external person is `pending` until they accept; Preview shows messages after they were added; deleting means they're not in the group ("<name> didn't join").
### 3.8 Status (AC-26)
- Redis keeps `status:<user>` = `available` / `away` / `offline`, updated by the live line (open + `active` within 5 minutes = available; open, no activity = away; no line = **offline within 35 seconds** of the last line closing, a 30-second grace for reconnects). **In a meeting** comes from F02's attendance (in a call).
- **Locked computer:** the desktop's main process listens to Electron's `powerMonitor` `lock-screen`/`unlock-screen` and passes it to the screens through a new preload call `window.meetapp.power.onLockChange(cb)` (a design change to the bridge; the bridge-surface desktop tests are updated); the screens send `active: false` on the line.
- **Who receives status:** each line keeps the set of people whose status this person may see (colleagues in shared team workspaces and accepted external contacts), loaded at connect and updated by `list` news; a change is published on `status:<user>` and each server forwards it only to lines whose set contains that user. Blocking, removal and a declined request drop the person at once.
### 3.9 Groups (AC-15–18)
- 3–250 people at creation; adding past 250 is refused (`CHAT_GROUP_FULL`). Rename (1–80), add with `history_from` (none = now; days = now − N days; all = the conversation's start), remove, leave: each saves a system note and news. When the last member leaves, the group is marked and deleted (with files) by the daily job within 30 days.
### 3.10 Leaving a workspace and deleting (AC-33–35)
- F01's "removed from workspace" and "left workspace" steps call `chats.forgetMembership(workspace, user)`: membership `left`, a note "<name> left", live-line subscriptions dropped at once; direct chats there become read-only for the other person.
- **Hide** sets `hidden` for the person (it comes back with a new message). Workspace deletion removes its conversations and files within 30 days (cascade + the F03 file clean-up job).
- Account deletion (F10's job, as in F03): `chats.forgetPerson(user)` withdraws requests they sent and removes requests they received, deletes their block and cooldown rows, shows "Deleted user", keeps groups, makes direct chats read-only, and runs F03's message and file removal. **Data export** (AC-33): F03's `exportFor` covers their messages and files in every conversation kind.
### 3.11 Workspace setting (AC-27)
- `workspaces.allow_outside_chat` (default `true`), changed through F02's `PATCH /workspaces/:id/settings`. When off, starting external chats is refused and conversations with external members of that workspace become read-only (the send check refuses with `CHAT_OUTSIDE_OFF`); back on, they're writable again.
### 3.12 Side menu folding (AC-36)
- `AppLayout` gets `NavRail`: folded state in this computer's storage (`meetapp.nav.folded`), toggled by the ☰ button (`aria-expanded`), tooltips from F00's Tooltip, the unread badge on the Chat icon.

## 4. Data stored (migration `0006_chats`)
| Table / column | What |
|---|---|
| `conversations` | `id`, `workspace_id`, `kind` (direct/group/meeting), `meeting_id` (meeting kind), `name` (group), `direct_key` (direct: the two user ids, unique per workspace), `created_by`, `created_at`, `last_message_at` (list order), `deleted_at` |
| `conversation_members` | `conversation_id`, `user_id`, `workspace_id`, `state` (accepted/pending/declined/left/removed), `external`, `history_from`, `added_by`, `joined_at`, `pinned_at`, `muted`, `hidden`, `requested_at`; primary key (conversation, user) |
| `conversation_reads` | `conversation_id`, `user_id`, `last_read_seq`, `last_read_at` |
| `chat_blocks` | `blocker_id`, `blocked_id`, `created_at`; primary key on both |
| `chat_request_cooldowns` | `from_user`, `to_user`, `until` (30 days after a deleted request) |
| `workspaces.allow_outside_chat` | boolean, default true |
| `user.read_receipts` | boolean, default true (on the user's own row, where F01 keeps theme and accent; there is no `user_settings` table) |
| F03 tables | `chat_messages`, `chat_events`, `chat_pins`, `chat_polls`, `chat_attachments` gain `conversation_id` (filled by the migration from the meeting's conversation); `meeting_id` and `call_id` stay for meeting chats and become optional; new indexes on `conversation_id` |
| Migration `0007_chats_people` (D066, added in T8) | the account next to the join in F03's tables: `chat_reactions.user_id` (join now optional, one reaction per account), `chat_messages.deleted_by_user_id` and `mentioned_user_ids`, `chat_attachments.uploader_user_id`, `chat_pins.pinned_by_user_id`, `chat_polls.creator_user_id`, `chat_poll_votes.voter_user_id`; "sent once" per account for chat messages; `conversation_members.left_at` |
| Migration `0008_chat_pins_per_conversation` (T8b) | the "3 pins at most" database rule counts per conversation (with its row locked), so it holds in chats too |
- The migration follows backend.md's "expand, then contract" (order below). No column is dropped in F14.
- Indexes: members by user (the list), conversations by `(workspace_id, last_message_at)`, reads by user, `workspace_id` on every table (S2). Name search ignores case and accents; it runs in the chats service over the person's own list (small), so no database extension is needed (AC-04, changed in T4).
- **Order of the change (no message lost):** step 1, add the nullable columns and a `conversations` row for every meeting (unique `meeting_id`), and deploy code that writes both `meeting_id` and `conversation_id` (F02's meeting creation now also creates the meeting's conversation); step 2, a re-runnable fill until no message is left without a conversation (checked by a query in the test); step 3, reads switch to `conversation_id`. Making it required and dropping the old columns is a later "contract" migration, not F14. F03's news numbers are already per meeting, so merging a meeting's calls into one conversation keeps their order.

## 5. Backend endpoints (all under `/api/v1`, signed in)
| Endpoint | Purpose |
|---|---|
| `GET /workspaces/:id/conversations?filter=&q=` | the chat list (with unread counts, pinned first), AC-01–05 |
| `GET /me/chat-requests` | pending requests (Personal list), AC-10 |
| `POST /workspaces/:id/conversations` (`{ userIds, emails, name? }`) | start a direct chat (existing returned) or group, AC-07, 09, 15 |
| `GET /workspaces/:id/people?q=` | To: suggestions: members by name; an exact email returns that one account (30 lookups a minute), AC-07, 08, D063 |
| `GET /conversations/:id/messages`, `POST …/messages`, `PATCH/DELETE …/messages/:mid`, reactions, pins, polls, attachments | F03's routes, now per conversation, AC-19, 21 |
| `PUT /conversations/:id/read` | the read mark, AC-24 |
| `POST /conversations/:id/accept`, `POST …/decline` (`{ block }`) | requests, AC-11, 13 |
| `POST /conversations/:id/members`, `DELETE …/members/:userId`, `POST …/leave`, `PATCH /conversations/:id` (`{ name }`) | groups, AC-16–18 |
| `PATCH /conversations/:id/me` (`{ pinned, muted, hidden }`) | per-person list choices (at most 15 pinned: `CHAT_PIN_LIMIT`), AC-05, 35 |
| `POST /me/invitations` (`{ email }`) | the Personal "Join me on MeetApp" email (20 a day per person); in a team workspace the app uses F01's invitation route, AC-08 |
| `GET /conversations/:id/messages/:mid/seen` | who has seen a group message (groups up to 20), AC-24 |
| `GET /me/blocked`, `POST /me/blocked` (`{ userId }`, block from an accepted chat), `DELETE /me/blocked/:userId` | Settings → Privacy, AC-13 |
| `PATCH /me/settings` (`{ readReceipts }`) | AC-24 |
| `GET /realtime` (WebSocket) | the live line, 3.4 |
| `GET /people/status?ids=` | statuses the asker may see (others left out), AC-26; added in T10 |
- Meeting chat keeps F03's `/calls/:callId/chat/…` routes during a call (they find the meeting's conversation).

## Edge cases & errors
- **Two people start a direct chat with each other at the same moment:** the unique `direct_key` makes one conversation; both get it.
- **Line lost during typing:** typing stops showing after 5 seconds; messages sent with "Not sent" + Retry (F03, AC-25).
- **A person in several windows:** each has its own line (up to 5); reads and typing come from any of them.
- **Removed while the chat is open:** the `list` news closes the chat with "You're no longer in this chat".
- **Outside chat turned off while typing:** the send is refused (`CHAT_OUTSIDE_OFF`) and the composer shows the read-only note.
- **Blocked person tries:** refused like "not found"; they see nothing about the block.
- **News for a conversation the app doesn't have yet:** the app fetches the list item.
- **Redis down:** the live line still opens but news can't fan out across servers; the app falls back to refreshing the open chat every 10 seconds and the list every 30 seconds until news returns (status page shows Cache down); tested with Redis stopped.

## Security & privacy
- **S1, S2 (AC-31):** every route checks membership (or F03's attendance rules for meetings) and the workspace, re-reading them each time; refusals look like "not found"; the outsider sweep covers every new route and the live line (an outsider's line gets no news of others' chats).
- **The live line** opens only after the sign-in check; it carries only news for the person's own conversations and allowed status; app → server messages are only `typing`, `active`, `ping` (anything else closes the line). The desktop's security policy adds the backend's `ws://`/`wss://` address only.
- **S10 (AC-32):** message text, file names and emails never in logs; the live line logs only ids and counts.
- **Email lookup (D063):** exact email only, 30 a minute per person, answers only name and picture of that one account; logged as the searcher's id and a count, never the email (S10). An account that blocked the searcher still shows (as in Teams), but a request to it is refused like "not found".
- **Requests older than 30 days** are hidden when read; the daily job only cleans up.
- **Status privacy:** only colleagues in a shared team workspace and accepted contacts (3.8).
- Files, GIFs and the message document keep F03's rules (content checks, 5-minute links, never HTML).

## Cost impact
None: the live line runs inside the existing backend; Redis (already used) carries the fan-out. The 250-person load test runs on this Mac only (free, D017).

## Test approach
- **Unit:** permissions table (every action × member state × kind × outside-chat setting); list ordering and filters; unread and Seen rules (receipt setting, group sizes); typing timing; status rules; NavRail folding; new UI parts (stories and tests).
- **Integration (API + Postgres + Redis):** every route's rights (member, pending, declined, left, removed, blocked, external, other workspace, outsider sweep); direct-chat uniqueness under races; request limits (10 messages, 20 a day, 30-day cooldown, 30-day expiry with a fake clock); group limits and history; leaving a workspace; account deletion step; the migration on an F03 database (meeting chats keep working, all F03 chat tests pass); the live line with `injectWS` (sign-in before opening, news only for own chats, subscriptions change within 2 seconds, idle close, 5-line limit, Redis fan-out across two server instances).
- **Keyboard focus (added in T19, as in Teams; AC-30):** New chat opens with the cursor in To:; Add people opens with it in its To: field (the dialog's `initialFocusId`) and gives it back to the Add people button on closing; opening a chat puts it in the message box; Reply moves it to the box. A chat just started or accepted opens with the list's filter and search cleared, so it is always listed and opens. Leave group asks "Leave this group?" first.
- **Desktop (real app):** two and three windows: start a chat, request accept/delete/block, group create/add/remove/leave, unread counts, Seen, typing, status changes, mentions, outside-chat off, menu folding, keyboard-only run.
- **Load:** a 250-person group (simulated members on live lines) delivering to the app within 1 second (95%) (AC-20), added to `pnpm test:load`.

## Acceptance criteria → tests
| AC | Covered by |
|---|---|
| AC-F14-01–06 | unit (list order, filters, search with accents) + integration (list, counts, 15-pin limit, mute) + desktop |
| AC-F14-07–09 | integration (suggestions, exact email, invite, direct uniqueness race) + desktop |
| AC-F14-10–14 | integration (requests, limits, cooldown, expiry, blocking, group requests) + desktop (accept, delete, block) |
| AC-F14-15–18 | integration (sizes, rename, history, add/remove/leave, last member) + desktop |
| AC-F14-19, 21 | integration (F03 suite on conversations; edit/delete any time) |
| AC-F14-20 | live-line integration + desktop + load (250-person group) |
| AC-F14-22–25 | unit (mention, typing timing, Seen rules) + integration + desktop |
| AC-F14-26 | unit (status rules) + integration (visibility) + desktop |
| AC-F14-27 | integration (setting on/off, read-only, back on) + desktop |
| AC-F14-28 | integration (meeting conversations in the list, F03 rules) + desktop |
| AC-F14-29, 30 | desktop (timing, keyboard-only, announcements) + unit (translation keys) |
| AC-F14-31, 32 | security: outsider sweep incl. the live line; log check |
| AC-F14-33 | integration (account deletion step, data export) |
| AC-F14-34, 35 | integration (leaving a workspace, hide, workspace deletion) |
| AC-F14-36 | unit (NavRail) + desktop + screenshots |

## Decisions made here
- **D064 (proposed):** a WebSocket live line (`@fastify/websocket`, Fastify team, MIT) with Redis publish/subscribe for news, typing, Seen and status outside calls.
- **D065 (proposed):** one conversation model for direct, group and meeting chats; F03's tables gain `conversation_id` (expand then contract).
