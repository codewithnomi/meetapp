---
feature: F15
title: Calls from chat (audio and video)
status: approved
updated: 2026-10-27
---

# F15 Calls from chat (audio and video): Design (HOW)

## Summary (plain English)
- **A chat call is an F02 call without a meeting.** F02 already knows how to put people in a call on our call server (LiveKit), give each one a short-lived pass, keep who joined and left, and end it. A call now belongs either to a meeting (as before) or to a chat. Everything inside the call (microphone, camera, screen sharing, reactions, reconnecting) is F02's, unchanged (D072).
- **Ringing goes over F14's live line** (the always-open connection that already delivers chat messages). The backend tells each called person's windows "ring", and "stop ringing" when someone answers, declines, cancels, or 30 seconds pass. The backend owns the 30-second clock, so ringing stops even if the caller's app crashed.
- **Accepting** is one request: the backend checks the person is still in the chat, then hands back the pass for the call, exactly like F02's join for a workspace member (no lobby).
- **The chat shows the call**: notes "started a call" (with Join), "Call ended · 12m 30s" and "Missed call from …" are saved as chat notes, so they stay in the chat's history and in the chat list.
- **Status "In a call"** comes from the same place F14's "In a meeting" came from; only the word and the name change (D070).
- **Settings**: device choices and the background are remembered on the computer; the ringtone and its volume are kept on the account. Backgrounds and blur run on the person's own computer with LiveKit's free background tool, whose files ship inside the app (nothing is downloaded from the internet, D073). The 5 ringtones are made by the app itself (generated sound), so there are no sound files to license (D074).
- **Cost:** none.

## 1. What gets created
```
packages/db/src/schema/meetings.ts       calls and call_attendances may belong to a chat; call_rings; migration 0009_chat_calls
packages/db/src/schema/auth.ts           user.ringtone, user.ring_volume (account settings)
packages/contracts/src/calls.ts          chat-call requests and answers, ring line messages, call note shapes
apps/api/src/modules/calls/              chat calls: start/join, ring, accept, decline, cancel, add people, ending rules,
                                         ring timeout job, call notes, status "in a call"
apps/api/src/modules/meetings/…          F02's join/pass/webhook code takes a "call place" (meeting or chat), like F03's seat
apps/api/src/modules/chats/…             membership changes take people out of a running chat call; live line: ring messages
apps/web/src/features/calls/             start/join from a chat, incoming-call state, ringtone player, call notes
apps/web/src/features/devices/           Settings → Devices: device choices, preview, background effects (shared with F02)
apps/web/src/pages/ChatsPage/            call buttons, Join, call notes; IncomingCall overlay (app-wide)
apps/web/src/pages/MeetingPage/          reused as the call screen; Add people panel; equal rights for chat calls
apps/web/src/pages/SettingsPage/         Devices and Calls sections
packages/ui/src/…                        IncomingCall (organism), CallNote (molecule), BackgroundPicker (molecule),
                                         RingtonePicker (molecule), CallingScreen (template)
apps/web/public/backgrounds/             8 background pictures (free licence, D073) and the background tool's model files
                                         (new folder; the build tool copies public/ into the app as it is)
```
- `docs/engineering/project-structure.md` is updated: `features/` gains `calls/` (F15) and `devices/` (device choices and backgrounds for F02 and F15, moved from `meetings/`); `public/backgrounds/` holds the pictures and model files.

## 2. Screens and user flow (approved canvas row "Calls from chat (F15)")
1. **Chat header** (F14): **Video call** and **Audio call** buttons. Disabled with a tooltip and note when the chat can't call (AC-02). While a call runs, a **Join** button replaces them (AC-03).
2. **Start:** pressing a button opens the **Calling** screen (dark stage): "Calling Bilal Ahmed…", own preview, controls (mute, camera, devices and background, **Cancel**). Ends as **Declined** or **No answer** with **Call again** and **Back to chat** (one-to-one), or simply becomes the call when someone joins.
3. **Incoming call** (any screen of the app, top right): caller photo and name, "Video call · Release team", three round buttons labelled **Video**, **Audio**, **Decline** whose full names (tooltip and screen reader) are **Accept with video**, **Accept with audio** and **Decline**; when already in a call or meeting, a line "You're in … Accepting leaves it" and the accept buttons are named **Leave current call and accept with video/audio** (AC-05, 10). It takes focus and is announced (AC-18).
4. **In the call:** F02's call screen with a side panel: **Add people** (chat members not in the call, each ringing / declined / Add) and **Chat** (the chat itself). No organizer controls.
5. **Chat notes:** "Sara Malik started a call · 03:12 · 2 people" with **Join** (while running); "Call ended · 1h 05m · Sara, Omar and you"; "Missed call from Omar · 17:42" with **Call back**.
6. **Loading and errors (AC-18, 19):** starting, joining or accepting shows a spinner on the button; a failure shows "Couldn't start the call" (or "Couldn't join the call") with **Retry**; if the backend or call server can't be reached, F02's message appears within 10 seconds. All text comes from the translation file.
7. **Settings → Devices:** preview (with the chosen background), background grid (None, Blur, 8 pictures), camera, microphone with level, speaker with **Test speakers**, noise suppression. **Settings → Calls:** 5 ringtones with play buttons, volume.

## 3. How it works

### 3.1 The call record (AC-01, 03, 14, 26; D072)
- `calls.meeting_id` becomes optional and `calls.conversation_id` is added; a check makes every call belong to exactly one of them. `call_attendances` likewise (`meeting_id` optional, `conversation_id` added). Add-only migration; F02 rows keep their meeting.
- **One running call per chat:** a partial unique index on `calls(conversation_id) WHERE ended_at IS NULL`. Starting when one runs (from another window, or both people at the same moment: AC-26) hits the index and joins the running call instead; nobody is rung twice.
- **Kind and size:** `calls.media` (`video` | `audio`, what the caller chose, shown in the ring) and a 20-**person** limit (distinct accounts with a running attendance) checked when joining, ringing and adding; a person's second window doesn't take a place. LiveKit's `maxParticipants` is 25 as a safety cap (AC-14). Joining a call that ended meanwhile: 409 `CALL_ENDED`, "This call has ended". The 30-hour end (`endsAt`) and its 10-minute notice are F02's.
- **Rights in a chat call:** everyone is a "participant" with F02's presenter rights for their own tracks (mic, camera, screen) and nothing else: no mute/remove/roles/lock/lobby buttons, and the backend refuses those routes for chat calls (AC-12).

### 3.2 Starting and joining (AC-01–04, 12, 20–22, 27)
- `POST /conversations/:id/calls` `{ media }`: checks the person may write in the chat (F14's read-only rules, AC-02), the rate limit (AC-22), then creates the call (or finds the running one), an attendance for the person, and returns F02's join answer (ticket + call-server pass, no lobby). For a new call it also writes the "started a call" note and rings the others (3.3).
- `POST /calls/:callId/join` for **Join** from the chat: same checks, no ringing.
- The camera choice is the app's: video call starts with the camera on, audio call off; a missing or blocked device starts the call with that device off and shows F02's device message (AC-27).

### 3.3 Ringing (AC-04–11, 19, 24)
- `call_rings (call_id, user_id, state, rang_at, answered_at)`, states `ringing` → `accepted` | `declined` | `missed` | `cancelled`. One row per person rung per call (Add people may ring again: a new row once the earlier one ended).
- **Who is rung:** the chat's other accepted members, unless the group has more than 20 (AC-04), and never a person who blocked the caller in their one-to-one chat (that chat is read-only anyway, AC-24).
- **Delivery:** live-line message `{ t: "ring", callId, conversationId, from: { userId, name, photoUrl }, media, groupName?, expiresAt }` to all the person's lines (F14's per-person channel). The app shows the incoming call and plays the ringtone (quieter while in a call, AC-10). People with no line open get nothing now and the missed note later (AC-11).
- **Stopping:** `{ t: "ring_stop", callId, reason: "accepted" | "declined" | "cancelled" | "missed" | "ended" }` to the person's lines, so every window stops at once (AC-06, 07, 09).
- **30 seconds:** a delayed job on the existing BullMQ queue fires at `rang_at + 30 s` and marks still-ringing rows `missed`, sends `ring_stop`, and writes missed notes; the every-minute clean-up also ends any ring older than 35 seconds (so a lost job can't leave anyone ringing, AC-19).
- **Caller leaves first (group):** F02's webhook handler, chat-call branch: when the caller's last participant leaves and no other attendance exists, all `ringing` rows become `cancelled`, `ring_stop` (`cancelled`) goes out, missed notes are written and the call ends (AC-09).
- **Already in this call / rung twice:** a person already in the call is never rung; a person rung by two calls at once sees both (the newer on top), each with its own buttons.
- **The caller's name and photo** are copied into the ring when it is sent; if the caller is removed or deleted meanwhile, the ring is cancelled.
- **One-to-one outcomes:** decline or timeout ends the call (the caller's screen shows **Declined** / **No answer**, AC-07, 08). **Group:** the others keep ringing; if nobody has joined after 30 seconds, or the caller leaves first, the call ends and everyone rung gets a missed call (AC-08, 09).

### 3.4 Answering (AC-06, 07, 10)
- The ring row is looked up by `(callId, userId = the signed-in person)`; no row → 404; a row that isn't `ringing` → 409 `RING_OVER`.
- `POST /calls/:callId/accept` `{ media }`: the ring must be `ringing`, membership is checked again, the ring becomes `accepted`, and F02's join answer comes back (within 3 seconds to being in the call, AC-06). If the person is in another call, the app first leaves it (F02 leave), then accepts.
- `POST /calls/:callId/decline`: ring `declined`, `ring_stop` to their windows, and a `call_missed` note for them (AC-15); one-to-one: the call ends.
- `DELETE /calls/:callId/ring` (caller's **Cancel**, only the person who started the call; others 404): all `ringing` rows → `cancelled`, `ring_stop` to everyone, notes as missed (AC-09).
- `POST /calls/:callId/ring` `{ userIds }` (**Add people**): each must be an accepted chat member not in the call; at most 20 in the call; counts toward the rate limit (AC-13, 22).

### 3.5 Ending and notes (AC-14, 15, 28)
- **One-to-one:** once both people have joined, when either leaves (LiveKit `participant_left` for that person's last participant) the backend deletes the room and the call ends for both (AC-14). Before the other joins, it ends only by decline, timeout or Cancel (3.3). **Group:** F02's rule (last one out). Both also end at 30 hours.
- **Notes** are chat system messages through F14's note path (`chats-notes.ts`), so they appear in the chat, on the live line and as the list's last line:
  - `call_started` `{ callId, by, media }`: the app shows **Join** while the call is running (it asks the running call from the conversation).
  - `call_ended` `{ callId, seconds, people }`: "Call ended · 12m 30s" (`1h 05m` from an hour).
  - `call_missed` `{ callId, from, forUserId }`: shown only to `forUserId` ("Missed call from … · Call back"). Its news goes only to that person's live-line channel; pages and the list's last line skip it for everyone else. It is the only call note that counts as unread, and only for its `forUserId`; `call_started` and `call_ended` never count (AC-04, 15).
  - When a call ends, every person with a `call_rings` row and no attendance in that call has exactly one `call_missed` note (declined, missed or cancelled alike).
- **Kept** (AC-28): the call row (who started, chat, start/end), attendances (who joined and left), rings. They go with the conversation (cascade) and the account deletion/export helpers include them (F03/F14's `chatUpkeep`).

### 3.6 Status "In a call" (AC-16, D070)
- F14's status rule already reads "has a running attendance" for "In a meeting"; it now counts chat-call attendances too and the value is renamed `in_call` everywhere (contracts, app labels, F14's status tests), so nothing shows "In a meeting" any more. No database change (status lives in Redis). D068 still applies when the app closes.

### 3.7 Membership changes during a call (AC-25)
- F14's member removal, leaving, workspace removal and account deletion call `calls.leaveChatCall(conversationId, userId)`: the attendance becomes `removed`, LiveKit `RemoveParticipant`, ringing stops. Within 2 seconds, measured by a test.

### 3.8 Devices, rings and transfer, ready for mobile (AC-33, 34; D075)
- **Ring targets:** the ring service doesn't send to "the desktop"; it sends to the person's **ring targets**: a small interface (`RingTarget.ring(ring)`, `RingTarget.stop(callId, reason)`) with one kind now, the live line (all the person's open windows). F11 adds a push target (phone notifications, Apple/Google) behind the same interface. The ring record, the 30-second clock, accept/decline and missed notes stay in the backend and don't change (AC-34).
- **Answer from anywhere:** accept and decline carry nothing device-specific; whichever device calls first wins (conditional update), the others get `ring_stop`.
- **Seats per device:** each device in a call has its own attendance (F02 already allows two). `GET /me/calls/active` lists the person's running calls (call, chat, which devices are in), so any device can show "You're in a call on another device" (AC-33).
- **Transfer:** `POST /calls/:callId/transfer` `{ fromAttendanceId }` returns a normal join answer for the new device and marks the old attendance `transferring`. When LiveKit reports the new participant joined, the backend removes the old one (`RemoveParticipant`, attendance `transferred`). The call server identity is the account plus a seat number, and other apps show one person, so others don't see a leave and a new join. If the new device never connects within 30 seconds, the old seat stays and nothing changes.
- **Sign-in per device:** desktop uses its token (F01); the phone will use its own session the same way, so nothing in the call rules depends on the kind of device.

### 3.9 Settings (AC-29–32)
- **Devices (per computer):** F02's device preferences (already used by pre-join and in-call settings) move to `features/devices` and gain a Settings page. Kept in the app's local storage; a missing device falls back to the default with F02's notice (AC-29).
- **Backgrounds (per computer, AC-30, 31):** `@livekit/track-processors` (`BackgroundProcessor`, D073) set on the local camera track in disabled mode at start, then `switchTo` blur or a picture, so switching has no flicker. Its model and engine files are copied into the app (`assetPaths`), and the 8 pictures ship with the app: nothing leaves the computer. A frame counter (`onFrameProcessed`) checks speed; under 15 frames a second for 5 seconds, the app switches to disabled and shows "Background turned off to keep your video smooth" (AC-31). Used in preview, pre-join, calls and meetings.
- **Ringtone (per account, AC-32):** `user.ringtone` (1–5, default 1) and `user.ring_volume` (0–100, default 70) via `GET/PATCH /me/settings` (F14's route, two more fields). The 5 tones are short patterns generated with the Web Audio API (D074), played by the incoming-call screen and the play buttons.

## 4. Data stored
| Table / field | What |
|---|---|
| `calls.conversation_id` (new), `calls.meeting_id` (now optional), `calls.media` | which chat (or meeting) the call belongs to; video or audio |
| `call_attendances.conversation_id` (new), `meeting_id` (now optional) | who was in a chat call |
| `call_rings (id, workspace_id, call_id, user_id, state, rang_at, answered_at)` | who was rung and what happened; indexes on `(call_id)`, `(user_id, state)` |
| `user.ringtone`, `user.ring_volume` | the person's ringtone and volume |
- Migration `0009_chat_calls` (0008 is F14's last): add-only (columns, table, partial unique index, check constraint added `NOT VALID` then validated). No lock-heavy rewrite.

## 5. Backend endpoints and live-line messages (all signed in)
| Endpoint | Purpose |
|---|---|
| `POST /conversations/:id/calls` `{ media }` | start (or join the running) chat call; rings the others; returns F02's join answer, AC-01–04 |
| `GET /conversations/:id/call` | the running call (for **Join**), or none |
| `POST /calls/:callId/join` | join a running chat call, AC-03, 15 |
| `POST /calls/:callId/accept` `{ media }`, `POST /calls/:callId/decline` | answer a ring, AC-06, 07 |
| `DELETE /calls/:callId/ring` | caller cancels, AC-09 |
| `POST /calls/:callId/ring` `{ userIds }` | Add people, AC-13 |
| F02's `DELETE /attendances/:id`, hand, reactions, share | leave and in-call actions, unchanged |
| `GET /me/calls/active` | the person's running calls and which devices are in them, AC-33 |
| `POST /calls/:callId/transfer` `{ fromAttendanceId }` | move the call to this device, AC-33 |
| `GET/PATCH /me/settings` `{ ringtone, ringVolume }` | ringtone, AC-32 |
| Live line `ring`, `ring_stop` | ringing, AC-05–09 |
- Errors: `CHAT_READ_ONLY` (403), `CALL_FULL` (409), `RING_OVER` (409), `CALL_RATE` (429 with wait), not a member → 404.

## Edge cases & errors
- **Two windows of the called person:** both ring; the first to accept wins (the ring row update is conditional); the other gets `ring_stop`. Joining again from the other window adds a second participant, as F02 does.
- **Caller's app crashes while ringing:** the job and the clean-up stop the ringing; a group call with nobody else ends, and LiveKit's empty-room timeout ends the room.
- **Accept just after 30 seconds:** `RING_OVER`; the app shows "This call has ended" with **Call back**.
- **Live line down for the called person:** no ring; the missed note arrives with the next catch-up.
- **Redis down:** ringing can't fan out across servers; F14's fallback checks (open chat every 10 seconds, chat list every 30 seconds) also ask `GET /conversations/:id/call`, so **Join** shows; missed notes are still saved.
- **Called during a meeting:** quieter tone; accepting leaves the meeting first (F02 leave), then joins.
- **Camera blocked:** video call starts with camera off and F02's device message.
- **Background tool unsupported** (old graphics): the background options say "Not available on this computer" and are disabled.
- **Removed from the chat while ringing:** ring cancelled, `ring_stop`.

## Security & privacy
- **S1, S2 (AC-20):** every route checks chat membership (accepted) and the workspace at that moment; others get 404. Chat calls never accept meeting tickets from F02's lobby paths, and F02's organizer routes refuse chat calls.
- **S4 (AC-21):** F02's pass rules: one call, short-lived, removed on leave, removal from the chat, or end.
- **S5 (AC-22):** each start counts 1 and each person rung by Add people counts 1; at most 10 a minute per person (Redis counter under an HMAC, as F01); the 11th gets 429 `CALL_RATE` with the seconds to wait.
- **S10 (AC-23):** logs carry ids and timings only; never passes, names in rings, or chat text.
- **Blocks (AC-24):** the blocked person's one-to-one chat is read-only, so no call; rings never go to a blocker from that chat; group calls are normal.
- **Backgrounds:** processing on the device; the model files and pictures are served by the app itself; the desktop security policy needs no new address (the tool's default internet download is turned off by `assetPaths`).
- Encryption and camera/microphone permission rules: F02 (AC-F02-53, 54).

## Cost impact
None: the same call server, backend, Redis and BullMQ (D017). The background tool and pictures are free (D073); ringtones are generated (D074).

## Test approach
- **Unit:** ring state machine (accept/decline/cancel/timeout races); who is rung (sizes, blocks); one-to-one end rule; note texts and durations; frame-rate fallback; ringtone patterns; settings validation.
- **Integration (API + Postgres + Redis + LiveKit test server):** start/join/accept/decline/cancel/add; the unique running-call index under a race (AC-26); 30-second timeout with a fake clock; membership removal during a call within 2 seconds; rate limits; outsider sweep over every new route; notes and missed-note visibility; status `in_call`.
- **E2E (two desktop windows, `pnpm dev:window`):** call, ring, accept with video/audio, decline, no answer, cancel, group call with Add people, Join from the chat, call during a meeting, keyboard-only and screen reader on the incoming call.
- **Visual:** stories and screenshots for IncomingCall, CallingScreen, CallNote, BackgroundPicker, RingtonePicker.
- **Performance:** the 25-person load test already covers a 20-person call; background effect frame rate measured on the reference Mac.

| AC | Test level |
|---|---|
| AC-F15-01, 02, 03, 04 | integration + e2e |
| AC-F15-05, 06, 07, 08, 09, 10, 11 | unit (state machine) + integration (timeout, races) + e2e |
| AC-F15-12, 13, 14 | integration + e2e |
| AC-F15-15 | integration (notes, visibility, unread) + component |
| AC-F15-16 | integration (status; F14's status tests updated to `in_call`) |
| AC-F15-17 | visual (canvas match) |
| AC-F15-18 | e2e (keyboard, screen reader) + component (loading, error + Retry) |
| AC-F15-19 | integration (job + clean-up with fake clock) + e2e (backend down) |
| AC-F15-20, 21, 22, 24, 25 | security / integration |
| AC-F15-23 | integration: the logs of a whole call hold no passes, names or chat text |
| AC-F15-26 | integration (race) |
| AC-F15-27 | component + e2e (camera blocked) |
| AC-F15-28 | integration (cascade, export) |
| AC-F15-33, 34 | integration (transfer: new connects before old leaves; ring to every target, answer on one) + e2e (two windows) |
| AC-F15-29, 30, 31, 32 | component + unit (frame-rate fallback) + e2e (settings) |

## Decisions made here
- **D072** (accepted): a call belongs to a meeting or a chat; chat calls reuse F02's call machinery.
- **D073** (accepted): `@livekit/track-processors` for blur and backgrounds, files shipped in the app; 8 free-licence pictures.
- **D074** (accepted): ringtones generated with the Web Audio API (no sound files).
- **D075** (accepted): rings go to "ring targets" and calls can move between devices, so the mobile app adds push ringing and phone transfer without changing the core.
