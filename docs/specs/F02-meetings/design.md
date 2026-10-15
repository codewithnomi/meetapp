---
feature: F02
title: Meetings & calling
status: approved
updated: 2026-10-14
---

# F02 Meetings & calling: Design (HOW)

## Summary (plain English)
- **Call server:** audio and video travel through the call server we already run on the Mac (**LiveKit**, D004). It passes each person's sound and picture to the others and can handle 100 people.
- **Who gets in:** our backend decides that, never the app. Before anyone touches the call server, the backend checks:
  - the link, or the ID and passcode;
  - the lobby rules, the lock and the guest switch;
  - the 100-person limit and the 60-day expiry.

  Only then does it hand out a **one-meeting pass** (a "token": a short signed note the call server trusts). The pass allows only what that person's role may do. An attendee's pass doesn't include screen sharing, so the call server itself refuses it.
- **The lobby:** people waiting in the lobby aren't connected to the call yet. Their app asks the backend every 2 seconds "am I in?". When someone presses **Admit**, the next answer carries their pass.
- **Organizer controls** (mute, remove, roles, lock, End meeting) are buttons that call our backend. The backend checks the rights, then tells the call server what to do. That way a changed app can't skip the rules.
- **The call server tells the backend** when someone joins or leaves. The backend keeps the meeting record from that: who took part and when. Nothing of the sound or picture is stored.
- **Guests** have no account. They type a name and get a private "ticket" for that one meeting, kept only in the app's memory.
- **The desktop app** may use the camera and microphone only on MeetApp's own screens (D040). Screen sharing shows MeetApp's own picker with small previews.
- **100 people:** each person sees one page of 16 videos. Videos on other pages aren't downloaded at all, so a big meeting stays smooth on a laptop.
- **Cost:** nothing; everything runs on the Mac.

Screens follow the approved designs (D029): canvas https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ, section "Meetings and calling (F02)" (12 screens, approved 2026-10-14).

## 1. What gets created
```
infra/livekit.yaml                 rooms only made by the backend, 100-person cap, an empty room stays open 30 s, webhooks to the API
apps/api/src/
  providers/livekit.ts             rooms, participants, permissions, data messages, passes (tokens), webhook check
  modules/meetings/                create, options, lookup by link or ID+passcode, expiry, record (meetings.*.ts)
  modules/calls/                   join, lobby, admit/deny, in-call controls, end, the 30-hour limit (calls.*.ts)
    calls.permissions.ts           the role table of requirements.md, in one place
    livekit-webhook.routes.ts      joins and leaves reported by the call server
    calls.jobs.ts                  BullMQ: lobby timeout, 30-hour warning and end, cleanup
  plugins/meeting-ticket.ts        reads the meeting ticket (`X-Meeting-Ticket` header) for call routes
packages/db/src/schema/meetings.ts meetings, co-organizers, calls, attendances; workspaces.allow_guests
packages/contracts/src/meetings.ts Zod schemas for every new endpoint and every server data message
apps/web/src/
  features/meetings/               API hooks, useMeetingRoom (LiveKit), devices, shortcuts, announcements
  pages/MeetingsPage               Meet now, Get a meeting link, Join (canvas "Meetings")
  pages/PreJoinPage                camera, mic level, speakers, guest name (canvas "Pre-join", "Pre-join as a guest")
  pages/LobbyPage                  waiting (canvas "Lobby")
  pages/MeetingPage                gallery, speaker view, panels, dialogs (canvas "Meeting: …", "Meeting options", "Choose what to share")
  pages/MeetingEndedPage           the messages of canvas "Messages" that end a visit
  pages/WorkspaceSettingsPage      the workspace name (moved from F01) and Allow guests
apps/desktop/src/main/
  media-permissions.ts             camera and mic for MeetApp's own screens only; screen sharing through our picker
  device-key.ts                    a random key for this app on this computer (guests' "same app" for AC-35)
  media-actions.ts, media-bridge.ts  the page bridge behind `meetapp.media` and `meetapp.deviceKey` (rules / Electron wiring)
packages/ui                        atoms: LevelMeter, ActionMenu (the ⋯ menu, moved out of MemberRow so rows share it);
                                   molecules: DeviceSelect, ParticipantRow (reworked), LobbyRow, MessageCard,
                                   SidePanel (the panels' frame); organisms: VideoTile (reworked), ControlBar (reworked),
                                   Gallery, ParticipantPanel, MeetingInfoPanel, MeetingOptionsForm, DevicePanel,
                                   SharePicker; template MeetingLayout. Icons added from the approved screens: info,
                                   smile, chevron-left, chevron-down, pin. Dialog gains widths (lg 620px, xl 720px).
```
`docs/engineering/project-structure.md` gains these folders in the same change. LiveKit code stays in `features/meetings` hooks and the meeting organisms, never in atoms (frontend.md rule 4).

## 2. Screens and user flow
Names match the canvas.

1. **Meetings** (new item in the main menu, workspace members only):
   - **Meet now** creates a meeting and opens its pre-join (AC-01).
   - **Get link** creates it and opens the **link-ready dialog** with the link, ID, passcode, **Copy** buttons and **Meeting options** (AC-02).
   - **Join a meeting** has two tabs: **Meeting ID** (ID + passcode) and **Link** (AC-08). The sign-in screen gets a **Join a meeting** button that opens the same form for guests.
2. **Pre-join:**
   - the camera preview, the mic level meter and **Test speakers** (a short sound through the chosen speakers);
   - three device menus and the mic/camera switches. The choices are kept in the page's local storage on this computer (AC-09);
   - guests also see the **Your name** field (1–60 characters) and the Terms sentence as plain text (AC-11, D051).

   **Join now** asks the backend to join:
   - the answer is either "in" with a pass, or "lobby";
   - while the person looks at the preview, the app warms up the connection to the call server (`prepareConnection`: it reaches the server early, but joins nothing), and the camera and mic are already running. That keeps joining under 3 seconds (AC-12).
3. **Lobby:**
   - the meeting title, "Someone in the meeting will let you in soon", the mic and camera switches and **Leave**;
   - every 2 seconds the app asks the backend for its status; the answer may carry the pass;
   - endings show the matching card from **Messages** (denied, nobody let you in, locked, guests not allowed, ended, full).
4. **Meeting:**
   - **Gallery** (16 per page, with page arrows) or **Speaker** view; **Pin for me** works in both;
   - the lobby bar for the organizer, co-organizers and presenters;
   - side panels: **Participants** (with the lobby at the top), **Meeting info**, **Device settings** (from More);
   - the **Meeting options** dialog (organizer and co-organizers);
   - **Choose what to share**;
   - **Leave**, with "End meeting" in its menu for the organizer and co-organizers.
5. **Workspace settings** (owner and admins; in a personal workspace its user): name and **Allow guests**. This replaces the F01 menu item "Workspace name".

**Keyboard** (AC-44): ⌘⇧M microphone, ⌘⇧O camera, ⌘⇧K raise/lower hand (Ctrl+Shift on Windows, the same keys as Teams). They are active only on the meeting screen, never system-wide.

Screen readers hear these through one polite live region, at most one message every 2 seconds (AC-21, AC-44):
- joins and leaves;
- hands raised;
- "X muted you";
- lobby arrivals;
- the active speaker.

## 3. How a meeting works

### 3.1 Making a meeting (AC-01–07)
- `POST /workspaces/:workspaceId/meetings` with `{ kind: "meet_now" | "link", title? }`. Workspace members only (S2), 50 an hour per user (S5), and an Idempotency-Key, so a double click makes one meeting (AC-46).
- **Title:** "Meeting with <name>" unless one is given (1–100 characters, trimmed, shown as plain text: AC-51).
- **Secrets (AC-03):**
  - **Link:** `https://<app>/m/<22 characters>`, 128 random bits in base64url.
  - **Meeting ID:** 12 random digits whose first digit isn't 0. It is unique among meetings that haven't expired (a new draw if taken).
  - **Passcode:** 6 characters from letters and digits without look-alikes (no 0/O, 1/l/I), drawn at random.
- **Storage:** link and passcode are stored encrypted (AES-256-GCM with a key from `DATA_ENCRYPTION_KEY` and a key version, as D050 does for join links), so Meeting info can show them. Lookups use HMAC columns:
  - `link_lookup` = HMAC(link part);
  - `passcode_check` = HMAC(meeting ID + passcode).

  The database alone can't reveal either secret.
- **Expiry (AC-04):**
  - Meet now gets `expires_at` = creation + 60 days, never moved.
  - A link meeting gets `expires_at` = now + 60 days at creation, at every join into the call and at every change of the title or an option.
  - A lookup with the right secret for an expired meeting gets "This meeting has expired" (AC-04). Only someone who already has the link, or the ID and passcode, learns this, so it reveals nothing to a guesser (AC-48).
- **Personal workspace (AC-06):** the only "workspace member" is its user. Everyone else counts as external or guest, so the default lobby rule sends them to the lobby, and the co-organizer list must be empty (refused with 400).
- **Organizer gone (AC-07):** every lookup joins the organizer's membership; if the organizer isn't a member of the meeting's workspace any more, the meeting counts as expired.

### 3.2 Finding a meeting (AC-08, AC-48)
- `POST /meeting-lookups` with `{ link }` or `{ meetingNumber, passcode }`. It works signed in or signed out.
- **Wrong tries** (AC-48):
  - At most 20 a minute, per user (or per device key for guests) **and** per network address.
  - Counted before the check and given back on a hit, as in D050, so only wrong tries count.
  - A third counter per meeting ID: after 20 wrong passcodes in a minute for one ID, that ID answers `TOO_MANY_ATTEMPTS` ("Too many tries for this meeting ID. Wait a minute or use the link") for the rest of the minute. Unknown IDs answer the same way, so nothing is revealed. Joining by link is never affected, so nobody can lock others out of a meeting.
- **Same answer every time:** any miss gives the same 404 `MEETING_NOT_FOUND`, with the same wording and timing (a fixed minimum response time). A miss is a wrong secret or an unknown meeting. With the right secret, a meeting whose organizer left the workspace counts as expired (AC-07). An HMAC is always computed, so a miss takes as long as a hit.
- **A hit** returns:
  - the meeting title;
  - `lookupToken`: a 15-minute signed note naming the meeting, so the passcode isn't sent again;
  - the joiner's group: member, external or guest.

  Nothing about who is inside is returned (AC-14, AC-50).

### 3.3 Joining (AC-09–19, AC-37, AC-40, AC-42)
`POST /meetings/join` with `{ lookupToken, guestName?, deviceKey }`.
- **Meet now:** creating a meeting also returns a `lookupToken` for its creator, so Meet now goes straight to the pre-join.
- **Limits:** at most 10 joins a minute per network address and per lookup token, so one person can't fill the lobby with fake guests (AC-19, S5).

**Checks, in this order** (each has its own message from requirements.md). They run in one database transaction that locks the meeting's current call row (`SELECT … FOR UPDATE`), so two joins at 99 people can't both get in:
1. The meeting still works (expiry, organizer still a member).
2. Guests: the workspace's `allow_guests` is on (AC-40).
3. The meeting isn't locked (AC-37). The organizer and co-organizers can always get in.
4. The call isn't full (100, AC-42), or the lobby isn't full (100, AC-19). The call count is `admitted + in_call`.

**Who skips the lobby** (AC-14, AC-16, AC-17, AC-35):
- The meeting's `lobby_bypass` decides:
  - `everyone`;
  - `workspace` (default);
  - `organizers`.
- The organizer and co-organizers always skip it.
- Guests skip it only when someone with an account is in the call.
- A person removed during this call always waits. Removal and the lock belong to one call, as in Teams, where a new meeting session starts unlocked.

**Result:**
- An **attendance** row is created: one per join, so the same account on two computers is two people (AC-13).
- The answer gives the attendance ID and a **meeting ticket**: 32 random bytes. Only its SHA-256 fingerprint is stored. Every later call action uses this ticket, for members and guests alike.
- If the person may enter, the answer also has the pass (section 3.5); otherwise it says `waiting`.

**The call itself:**
- The first person to enter starts the call: a `calls` row, then a LiveKit room named after the call's ID. A unique index allows one running call per meeting.
- Before any pass is issued, the backend calls `CreateRoom` under the call lock. It returns the room if it already exists. The room is created with:
  - `maxParticipants` 100;
  - `emptyTimeout` and `departureTimeout` 30 s (how long an empty room stays open).

  LiveKit is set so clients can never create rooms themselves.
- If the room closed in between, the app gets "room not found" and asks `GET /attendances/:id` once, which returns a pass for the new call, or `waiting`.
- The first entry also schedules the 30-hour jobs (section 3.7).

### 3.4 The lobby (AC-14–19)
- **Waiting:** `GET /attendances/:id` (ticket) returns the status. The app asks every 2 seconds; each ask also counts as "still here". The answer may carry the pass, so it is sent with `Cache-Control: no-store`.
- **Admit:** the next answer carries the pass, so entry takes at most about 2 seconds. Admitted people go into the call without further checks.
- **Who sees the lobby:** people with lobby rights (organizer, co-organizers, presenters) see it:
  - as a count and names, with "(External)" or "(Guest)" after each name;
  - through `GET /calls/:callId/lobby`. The app fetches it again whenever the server's data message `lobby_changed` arrives (section 3.6).
- **Decisions:** `POST /calls/:callId/lobby/admit` with `{ attendanceIds }` or `{ all: true }`, and `POST /calls/:callId/lobby/deny`. A denied person's next ask gets `denied` (AC-15).
  - Admitting runs under the same call lock as joining.
  - **Admit all** admits in arrival order, up to the free places; the rest keep waiting, and the person admitting is told how many didn't fit.
  - Each change is one conditional update (`waiting` → `admitted`), so two people pressing Admit at once is harmless.
  - `call_id` is set at admission.
- **Waiting with nobody inside:** guests whose meeting has nobody with an account inside keep `waiting`. When the first such person enters, waiting guests who may skip the lobby are let in automatically (AC-17).
- **Timeouts:**
  - After 15 minutes of waiting, the person gets `timed_out` ("Nobody let you in", AC-18). Each ask checks `lobby_entered_at + 15 min`, so it is exact. A cleanup job every minute catches people who stopped asking.
  - After 60 seconds without an ask, the person is counted as gone.
- **Room closed after admission:** when LiveKit reports `room_finished`, people `admitted` to that call who never connected get the join decision again: those who may skip the lobby start or enter the next call; the others wait. (Built in T7: they become `waiting` with `admitted_at` kept as the sign; their next ask runs the decision once.)
- **When the call ends:**
  - after the last person leaves, people in the lobby keep waiting, and the next person to enter starts a new call;
  - **End meeting** sends everyone in the lobby away (AC-38).

### 3.5 The pass for the call server (AC-49, S4)
- Made by the backend with `livekit-server-sdk`:
  - identity = the attendance ID (a random UUID);
  - name = the display name, with "(External)" or "(Guest)" added by the app, not stored in the name;
  - valid **10 minutes** for the first connection;
  - one room only.
- **Rights:**
  - Everyone can join, subscribe and send data (for reactions).
  - Publishing is limited by `canPublishSources`:
    - presenters and up: camera, microphone and screen;
    - attendees: camera and microphone, minus each one the meeting options turned off (AC-34).
  - Nobody gets room-admin rights or the right to change their own name or attributes.
- **After connecting:** LiveKit renews the pass by itself while the person stays connected. That is how a short drop reconnects without the lobby (AC-29). The app's `reconnectPolicy` keeps retrying for 30 seconds in total.
- **Rights change** (role, options): the backend calls `UpdateParticipant` with the new permission at once. LiveKit stops any track the person may no longer send, which also ends a screen share (AC-34, AC-36).
- **Remove or end:** `RemoveParticipant`, or deleting the room, disconnects people within 5 seconds.
  - Removing also passes `revokeTokenTs` = now: LiveKit then refuses every pass of that person issued before the removal, so a removed person's renewed pass can't be used to come back (found in T5).
- **Clock allowance:** LiveKit accepts a pass up to about one minute after it ends, to allow for clock differences between computers. A pass that is never used therefore stops working after 10–11 minutes (found in T5).
- **Reused passes:** when LiveKit reports `participant_joined`, the backend checks the attendance:
  - **Allowed:** it is `admitted` or `in_call`, or it is `left` for under 30 seconds because of a dropped connection (not the app's own Leave, which also calls `DELETE /attendances/:id`). That last case is a reconnect (AC-29).
  - **Otherwise** (removed, ended, or a call that is over): the backend removes the participant immediately.

  The cleanup job also lists the participants of every running room each minute and removes anyone whose attendance doesn't allow it, in case a webhook was lost.
- **Remaining window:** a reused old pass can be connected for about 1 second before the removal. Measured by a test case, and accepted. It is possible while the newest pass LiveKit gave the app is still valid: up to about 10 minutes after removal.

### 3.6 Live state inside the call (AC-21–26, AC-33–39)
**What the backend sets:** only the backend changes shared state, through LiveKit:
- **Participant attributes** (read by every app):
  - `role`: organizer, co_organizer, presenter or attendee;
  - `group`: member, external or guest;
  - `userId` (members and external people only; never an email). Tiles load photos through the F01 photo endpoint, which shows a photo only when the viewer shares a workspace with that person (AC-27). Guests, and viewers who don't share a workspace, see initials.
  - `handRaisedAt` (a time, or empty).
- **Room metadata:** the meeting options, `locked`, and `endsAt` (the 30-hour limit).
- **Server data messages** on topic `meetapp.control`, which apps trust only when they come from the server rather than a participant:
  - `lobby_changed`;
  - `muted_by` (to the muted person);
  - `share_replaced`;
  - `ending_soon`.

**Hands and reactions:**
- **Hands** (AC-23): `POST /calls/:callId/hand` raises or lowers your own hand. `POST /calls/:callId/participants/:id/lower-hand` (lobby rights) lowers someone else's. The order comes from `handRaisedAt`.
- **Reactions** (AC-24): sent by the app as LiveKit data on topic `meetapp.reaction` with one of the five names. Others show them for 3 seconds. Anything else on that topic is ignored. An app sends at most one a second, and receivers drop extra ones.
- **Limits on in-call actions:** 30 a minute per ticket (S5). Status polls (`GET /attendances/:id`) are not counted.

**Microphones and cameras:**
- **Mic and camera** (AC-22): the app mutes or unmutes its own tracks. LiveKit tells everyone within about 1 second, and the shortcuts do the same.
- **Mute** (AC-33):
  - `POST …/participants/:id/mute` uses LiveKit's mute of that person's microphone track and sends `muted_by`;
  - `POST /calls/:callId/mute-all` mutes everyone except the caller;
  - people can unmute themselves unless the options forbid it.

**Other controls:**
- **Remove** (AC-35): `POST …/participants/:id/remove`. The attendance becomes `removed` with `acted_by`, and LiveKit disconnects the person. Their app then reads `GET /attendances/:id`, which returns `removed` and the remover's display name, and shows "You were removed" with that name. Later joins in this call by the same user, or the same guest device key, go to the lobby.
- **Roles** (AC-36):
  - `PATCH …/participants/:id/role` with `{ role: "presenter" | "attendee" }`, for people with lobby rights;
  - `PATCH /meetings/:id/options` (organizer and co-organizers) carries `whoCanPresent`, `lobbyBypass`, `allowAttendeeMic`, `allowAttendeeCamera`, and `coOrganizerIds` (organizer only: up to 10, current members of the workspace).

  A person's role is:
  - **organizer**, if they made the meeting;
  - **co-organizer**, if named;
  - otherwise the role someone gave them during this call, if any;
  - otherwise the role `whoCanPresent` gives their group.

  After each change the backend updates the attributes and permissions of everyone affected.
- **Lock** (AC-37): `PATCH /calls/:callId` with `{ locked }`. Locking also turns away everyone in the lobby. Reconnects within the 30 seconds aren't joins (section 3.5), so they keep working.
- **Screen share** (AC-25):
  - The app asks for the screen only after the person picks one in our picker (section 5).
  - The backend decides who shares: on LiveKit's `track_published` for a screen, the newest one wins.
  - The backend mutes the older screen track (`MutePublishedTrack`) and sends `share_replaced` to its owner. That app stops sharing and shows "Your share ended".
  - Apps never stop a share on their own, so two shares started at the same moment can't both stop.

### 3.7 Ending (AC-32, AC-38, AC-39, AC-41)
- **Leave:** the app calls `DELETE /attendances/:id` and disconnects. LiveKit reports `participant_left` at once.
- **Crash or sleep:** LiveKit notices a silent connection through its ping timeout (about 15–20 seconds) and reports the leave. The 30 seconds of AC-32 are measured by a test case.
- **End meeting** (organizer or co-organizer, after confirmation):
  - The backend marks the call ended and sends everyone in the lobby away.
  - It deletes the room, so everyone is disconnected and sees "The meeting has ended".
  - A link meeting can be joined again later, which starts a new call.
- **Last person leaves:** LiveKit closes the empty room 30 seconds later and reports `room_finished`. The call is marked ended, with `ended_at` = the time the last person left.
- **30 hours:** two delayed BullMQ jobs per call, scheduled when it starts:
  - at 29 h 50 min, `ending_soon` to everyone;
  - at 30 h, the room is deleted.

  The jobs check that the call is still the same one, so they are safe if run twice.
- **Record** (AC-41): the `calls` row (start, end, how it ended) and the attendances with `joined_at`/`left_at`, filled from LiveKit's webhooks. Guests keep only their name. No audio or video is stored. `GET /meetings/:id/calls` returns it, but only to people who were in one of its calls, the organizer and co-organizers (F06 builds the screens).

### 3.8 Connection, devices and quality (AC-20, AC-28–31, AC-47)
**Settings for the calling library** (`livekit-client`):
- **`adaptiveStream`:** each video is downloaded only while visible, at the size it is shown, so videos on other gallery pages cost nothing.
- **`dynacast`:** a camera stops sending sizes nobody watches.
- **Simulcast:** each camera sends 3 sizes.

LiveKit already protects audio first, so on a weak line video gets worse or stops before audio suffers (AC-28).

**Weak connection** (AC-28): every second, the app reads its own connection's WebRTC numbers:
- packet loss;
- round-trip time.

When loss is over 5% or delay over 300 ms for 5 seconds in a row, the person's own tile and the Device panel show the weak-connection notice.

**Reconnecting** (AC-29):
- LiveKit retries by itself.
- After 30 seconds without success, the app shows "You've lost connection" with **Rejoin**.
- **Rejoin** sends the old ticket to `POST /attendances/:id/rejoin`. It works only from `left` with `left_reason = dropped`, for 30 minutes, once per attendance, and counts against the join limits. It makes a new attendance under the normal rules (lock, removal, lobby) and copies the old one's role, so it works for the same account on two computers too (AC-13).

**Noise and devices:**
- **Noise suppression** (AC-30): the browser's built-in WebRTC noise suppression, on by default; a switch in Device settings. No paid add-on.
- **Device changes** (AC-31): when a device in use disappears or changes, the app switches to the system default within 2 seconds and shows which one changed. LiveKit reports the change through the `MediaDevicesChanged` event plus the browser's `devicechange` event.

**Speaking** (AC-21):
- LiveKit's active-speaker event.
- The tile gets a ring **and** a "Speaking" label with an icon, so the cue doesn't rely on colour alone.
- The tile's name for screen readers includes ", speaking".

**Memory** (AC-47): only visible tiles hold video elements. Hidden tiles stop their video elements, and the gallery never draws more than 16.

## 4. Data stored (migration `0003_meetings`)
| Table / column | What it holds |
|---|---|
| `workspaces.allow_guests` | boolean, default true (AC-40) |
| `meetings` | `id`, `workspace_id`, `organizer_id`, `kind` (meet_now / link), `title`, `meeting_number` (12 digits), `link_lookup` (HMAC, unique), `link_secret` (encrypted), `passcode_check` (HMAC), `passcode` (encrypted), `key_version`, `lobby_bypass`, `who_can_present`, `allow_attendee_mic`, `allow_attendee_camera`, `expires_at`, `created_at`, `updated_at`. A plain unique index on `meeting_number` covers all rows (a new draw if taken; 9·10¹¹ numbers make reuse unnecessary) |
| `meeting_co_organizers` | `id`, `meeting_id`, `user_id` (unique together), times; at most 10, checked in code and by a trigger that locks the meeting row first |
| `calls` | `id` (also the LiveKit room name), `workspace_id`, `meeting_id`, `started_at`, `ended_at`, `end_reason` (last_left / ended / time_limit), `locked` |
| `call_attendances` | `id` (also the LiveKit identity), `workspace_id`, `call_id` (empty while waiting before a call exists), `meeting_id`, `user_id` (empty for guests; set to empty if the account is deleted, the record keeps the name), `display_name` (the name shown and kept in the record), `guest_device_hash` (HMAC of the meeting ID and the device key, so one guest's meetings can't be linked), `participant_group` (member / external / guest), `role_override`, `status` (waiting / admitted / in_call / left / denied / removed / timed_out / turned_away), `ticket_hash`, `lobby_entered_at`, `last_seen_at`, `admitted_at`, `joined_at`, `left_at`, `left_reason` (leave / dropped / removed / ended), `acted_by` (the attendance that admitted, denied or removed: guests can be presenters too), `rejoined_at` (Rejoin works once), `last_event_at` (time of the newest LiveKit event applied) |
| `livekit_events` | `id`, `event_id` (unique), times: webhooks already handled, kept 1 day |

Indexes:
- `call_attendances` on `(meeting_id, status)` for the lobby and the counts;
- on `ticket_hash`;
- `meetings` on `(workspace_id)` and `expires_at`.

Every query that reads a meeting goes through its workspace or a ticket for it (S2).

## 5. Desktop app (AC-10, AC-54, S17, D040)
- **Camera and microphone** (`media-permissions.ts`):
  - `setPermissionRequestHandler` and `setPermissionCheckHandler` allow only `media` with audio and/or video, and screen capture, and only for the window's top frame on `app://meetapp` (or the development server in development). Electron 44 reports a screen request as `media` with no media types; newer versions call it `display-capture`. Both are accepted, and the picker step below decides what is shared.
  - Choosing the speakers (`setSinkId`) may need Electron's `speaker-selection` permission for the same origin. A test case checks this.
  - Every other permission stays refused, as do device permissions (USB, HID, serial).
  - Context isolation, the sandbox and "no Node.js in the page" are unchanged.
- **One place for the rules:** `lockDownSession` (`guards.ts`) installs these handlers instead of the ones that refuse everything, because Electron keeps only the last handler set.
  - D040 is updated: from "device and screen-share requests refused" to "allowed only as here".
  - The F00 desktop security tests are updated to match.
- **New page bridge functions** (preload, accepted only from the app's own page):
  - `meetapp.media.accessStatus()`: camera, mic and screen permission;
  - `meetapp.media.requestAccess(kind)`;
  - `meetapp.media.getShareSources()`: names and small previews;
  - `meetapp.media.chooseShareSource(id)`;
  - `meetapp.deviceKey()`.
- **macOS permission:**
  - Before the pre-join opens, the main process checks `systemPreferences.getMediaAccessStatus` for the camera and microphone and asks with `askForMediaAccess` when undecided.
  - A "denied" answer becomes the matching pre-join message (AC-10).
  - Missing or busy devices come from the browser's own errors (`NotFoundError`, `NotReadableError`).
- **Screen sharing:**
  1. The page asks the main process for the list of screens and windows (`desktopCapturer.getSources` with thumbnails). The page gets stand-in ids (`share-1`, …), never the system's, so it can't capture a screen around the picker.
  2. The page shows our **Choose what to share** picker and sends back the chosen ID.
  3. `setDisplayMediaRequestHandler` answers the next screen request (within 10 seconds, once) with exactly that source and never with computer sound.
  4. If macOS screen recording isn't allowed (`getMediaAccessStatus("screen")`), the picker shows the "Allow screen recording" card instead.
- **Call server address:**
  - Join and attendance answers include `serverUrl`, so the app is never hard-coded to it.
  - The content security policy's `connect-src` is built from the same setting (`LIVEKIT_HOST`/`LIVEKIT_PORT`: `ws://` on this computer in development, `wss://` online).
- **Device key** (`device-key.ts`): a random 32-byte key made once and kept in the app's settings. It is sent with joins so a removed guest from the same app waits in the lobby (AC-35). The backend stores only its fingerprint.
- **The meeting ticket** stays in the page's memory only and is gone when the window closes. It grants rights in one call only, unlike the sign-in token (F01) that stays in the main process.

## 6. Backend endpoints (all under `/api/v1`, Zod in `packages/contracts/src/meetings.ts`)
| Endpoint | Who | Purpose |
|---|---|---|
| `POST /workspaces/:workspaceId/meetings` | member | create (AC-01, 02, 05) |
| `GET /meetings/:id` | organizer, co-organizer | title, link, ID, passcode, organizer, options |
| `GET /calls/:callId/meeting` | ticket of anyone in this call | Meeting info: title, link, ID, passcode, organizer (AC-F02-01) |
| `PATCH /meetings/:id/options` | organizer, co-organizer (co-organizers: organizer only) | title and options (AC-16, 34, 36) |
| `GET /meetings/:id/calls` | people who took part, organizer, co-organizers | the record (AC-41) |
| `POST /meeting-lookups` | anyone (rate limited) | find by link or ID+passcode (AC-08, 48) |
| `POST /meetings/join` | anyone with a lookup token | join or wait (section 3.3) |
| `GET /attendances/:id` | ticket | lobby status and the pass (AC-14–18) |
| `DELETE /attendances/:id` | ticket | leave the lobby or the call (Leave) |
| `POST /attendances/:id/rejoin` | ticket (up to 30 minutes after the end) | Rejoin after a lost connection (AC-29) |
| `GET /calls/:callId/lobby` | ticket with lobby rights | who waits (AC-15, 26) |
| `POST /calls/:callId/lobby/admit`, `/deny` | ticket with lobby rights | admit, admit all, deny |
| `POST /calls/:callId/hand` | ticket | raise or lower your hand |
| `POST /calls/:callId/participants/:id/lower-hand`, `/mute`, `/remove` | ticket with lobby rights | AC-23, 33, 35 |
| `POST /calls/:callId/mute-all` | ticket with lobby rights | AC-33 |
| `PATCH /calls/:callId/participants/:id/role` | ticket with lobby rights | presenter or attendee (AC-36) |
| `PATCH /calls/:callId` | ticket, organizer or co-organizer | lock or unlock (AC-37) |
| `POST /calls/:callId/end` | ticket, organizer or co-organizer | End meeting (AC-38) |
| `POST /livekit/webhook` | LiveKit only (signed with the API key, checked by `WebhookReceiver`; read as raw text through a parser for `application/webhook+json` on this route only) | joins, leaves, room finished, screen published |
| `PATCH /workspaces/:workspaceId/settings` | owner, admin | `allowGuests` (AC-40) |

**Errors** use the F00 format, with codes:
- `MEETING_NOT_FOUND`;
- `MEETING_EXPIRED` (only after the right secret, section 3.1);
- `MEETING_LOCKED`;
- `MEETING_FULL`;
- `LOBBY_FULL`;
- `GUESTS_NOT_ALLOWED`;
- `NOT_ALLOWED`;
- `TOO_MANY_ATTEMPTS` (with the wait time).

**Ticket routes:** the meeting ticket goes in its own header, `X-Meeting-Ticket`, because the desktop app replaces `Authorization` with the sign-in token (F01). CORS allows the header, and the log cleaning hides it. The `meeting-ticket` plugin looks the ticket up by fingerprint and loads the attendance, its call and its current role.

**Ticket lifetime:**
- A ticket belongs to one attendance, so to one meeting.
- In-call routes need the status `admitted` or `in_call` and a matching `call_id` (set at admission), so a late webhook doesn't block anyone.
- Lobby routes need `waiting`.
- After a final status (left, denied, removed, timed_out, turned_away, or the call ended), only `GET /attendances/:id` works (to read the outcome), for 30 minutes, plus Rejoin after a dropped connection (section 3.8).

Anything else is answered with 404 (S1, S2, AC-50).

## 7. LiveKit settings (`infra/livekit.yaml`)
- `room.auto_create: false`: only the backend makes rooms.
- `room.max_participants: 100`; `room.empty_timeout` and `room.departure_timeout`: 30 (how long an empty room stays open).
- **Webhooks:**
  - `webhook.urls: [http://host.docker.internal:<API_PORT>/api/v1/livekit/webhook]`, signed with the existing API key.
  - The signing key comes from `.env` through LiveKit's `LIVEKIT_WEBHOOK_API_KEY` setting.
  - The address depends on `API_PORT`, and neither a yaml file nor LiveKit's environment settings can hold it (`--config-body` would replace the whole file). So the container starts with a small `sed` step that copies `livekit.yaml` with the address filled in, then starts the server on the copy. Checked in T1, 2026-10-14.
- **Reaching the API:**
  - On the Mac (Docker Desktop), `host.docker.internal` reaches the API, which stays on 127.0.0.1 (AC-F00-23).
  - Linux CI has no such bridge to 127.0.0.1. There, `docker-compose.yml` adds `extra_hosts: host.docker.internal:host-gateway`, and the CI's API listens on the Docker bridge address (in CI only, `tools/test.ts` starts it with `API_HOST=0.0.0.0` on a throw-away machine).
- **Load-test bots:** the `lk` container runs with `network_mode: "service:livekit"`, so "127.0.0.1" means the call server for it too.
- **Speaker updates:** LiveKit's `audio.update_interval` is lowered if the test for AC-21 (highlight within half a second) needs it.
- In development the signalling runs over `ws://127.0.0.1` (this computer only). Media is always encrypted between app and call server (DTLS-SRTP, part of WebRTC) (AC-53). Online it will be `wss://` behind HTTPS (infrastructure.md stage 3).

## Edge cases and errors
- **The backend or call server is slow:** creating, looking up and joining time out after 10 seconds with "Can't reach MeetApp. Check your connection." and **Retry** (AC-46). In a call, LiveKit's own reconnect runs first.
- **Webhooks:**
  - **Lost:** the cleanup job compares, every minute, running calls with LiveKit's rooms and their participants. It fixes calls and attendances that disagree, and removes participants who shouldn't be there.
  - **Repeated:** each event ID is handled once (`livekit_events`).
  - **Out of order:** each attendance keeps the time of the newest event applied; an older event is ignored. So a join that arrives after its leave can't bring someone back.
- **Two people press Admit at once:** the status change is one conditional update (`waiting` → `admitted`). The second press finds nothing to change and returns success.
- **Two first joins start a call at once:** a unique partial index (one call per meeting with `ended_at` empty) makes the second join use the first call.
- **The organizer leaves:** the call goes on (AC-32). Co-organizers keep their controls.
- **Guests are allowed but the lobby rule is `everyone`, and only guests have come:** they wait (AC-17).
- **The guest switch is turned off during a meeting:** guests in the lobby get `turned_away` ("This meeting doesn't allow guests"); guests already inside stay (AC-40).
- **Expired while people are inside:** the call goes on; only new joins are refused (as in Teams).
- **Device errors:** pre-join and the Device panel show the messages of AC-10; joining is still possible with the device off.
- **Names and titles:** always shown as text (React escapes them). Names are trimmed; control characters are removed; the length is checked by Zod (AC-51).

## Security and privacy
- **S1, S2, AC-50:**
  - every route checks its caller, either the session plus workspace membership, or the meeting ticket of that call;
  - lookups and the lobby reveal only the title and one's own status;
  - the participant list is available only inside the call (through LiveKit) and to lobby rights holders.
- **S3, S5, AC-03, AC-48:**
  - 128-bit links;
  - 12-digit IDs with 6-character passcodes;
  - 20 wrong tries a minute per person and per address;
  - 50 meetings an hour;
  - lobby and call capped at 100.
- **S4, AC-49:** passes for one room, 10 minutes for the first use, rights from the role, no admin rights. Removal and ending disconnect people, and reuse is refused through the webhook check and the minute-by-minute participant check (a window of about 1 second, measured). Joins are limited to 10 a minute per address and per lookup token; in-call actions to 30 a minute per ticket.
- **S6, AC-53:** WebRTC media is always encrypted (DTLS-SRTP), and signalling uses `wss://` online. End-to-end encryption isn't part of F02.
- **S10, AC-52:**
  - the existing log cleaning (`redactPath`/`redactUrl`) gains `/m/<link part>` (also with the site in front, and inside error text), the `X-Meeting-Ticket` header, signed passes (JWTs) inside error text, and the fields `passcode`, `ticket`, `pass`, `lookupToken`, `link`, `deviceKey` and `guestName` wherever they appear;
  - the webhook body is never logged;
  - traces drop request bodies for meeting routes.
- **S11, AC-51:** Zod limits plus text-only rendering.
- **S17, AC-54:** section 5.
- **Privacy:** privacy-legal.md gains:
  - meeting records with participant names and times;
  - guests' names;
  - the guest device-key fingerprint;
  - link and passcode stored encrypted.

  How long these are kept comes with F06/F10 (S9).

## Cost impact
None. LiveKit runs in Docker on the Mac. The load tests use LiveKit's free command-line tool (`lk`) in Docker against the local server; LiveKit Cloud forbids load tests anyway. Noise suppression is the browser's built-in one.

## Test approach
The test cases go in tests.md (`TC-F02-…`). Following D052, each task runs only its own tests; the whole suite, the desktop tests and the screenshots run at `/spec-verify`.

**Test levels:**
- **Unit:**
  - the role and permission table;
  - lobby rules (who skips, guests alone, removed people);
  - the expiry calculation;
  - secret formats;
  - weak-connection detection (fed made-up WebRTC numbers);
  - every new UI component (Storybook stories, keyboard and axe checks).
- **Integration** (API + Postgres + Redis + the real local LiveKit):
  - every endpoint's rights;
  - pass contents (decoded and checked);
  - webhooks (signed test events);
  - timeouts with a fake clock;
  - rate limits;
  - secrets never in logs.
- **Desktop end to end** (Playwright with Electron, fake camera and mic from Chromium's `--use-fake-device-for-media-stream`):
  - two or three app windows in one meeting;
  - lobby admit and deny;
  - mute;
  - remove;
  - roles;
  - lock;
  - end;
  - share (with a fake screen source);
  - reconnect after the network is cut (via the call server's port);
  - device switching.
- **Load:**
  - 99 simulated participants with video, made by `lk perf load-test`;
  - the desktop app as the 100th, measuring frames per second of the 16 visible tiles;
  - audio delay (round-trip time / 2 plus the jitter buffer, from WebRTC numbers);
  - join time (click → first remote audio);
  - memory (25-person run, Electron's process memory).

  Run with `pnpm test:load`, separately like `test:monitoring`, because it takes several minutes and much of the Mac's power.

**Every acceptance criterion and how it's tested:**

| AC | How it's tested |
|---|---|
| AC-F02-01, 02 | integration (create, info contents) + desktop (Meet now → pre-join; link dialog, Copy) |
| AC-F02-03 | unit (formats, randomness length) + integration (link and ID+passcode resolve only their meeting) |
| AC-F02-04 | integration with a moved clock (Meet now fixed; link extended by join and change, not by lobby or deny) |
| AC-F02-05 | integration (51st meeting in an hour refused with the wait time) |
| AC-F02-06, 07 | integration (personal workspace lobby and empty co-organizers; organizer removed → expired with the right secret, not found otherwise) |
| AC-F02-08 | integration (link, ID+passcode, every miss the same) + desktop (guest from sign-in) |
| AC-F02-09, 10, 11 | desktop (fake devices; devices remembered; permission denied and missing device messages; guest name 1–60; Terms text) |
| AC-F02-12 | load/desktop timing (join under 3 s) |
| AC-F02-13 | integration + desktop (same account twice = two participants) |
| AC-F02-14–19 | integration (lobby rules, admit, admit all, deny, 15-minute timeout with a fake clock, guests alone, 100 in lobby) + desktop (lobby screen, admit) |
| AC-F02-20 | load (16 tiles ≥ 15 fps, pages, audio delay < 250 ms) + desktop (speaker view, pin) |
| AC-F02-21, 22 | desktop (speaking label and announcement within 0.5 s; mute/camera seen by the other window within 1 s; shortcuts) |
| AC-F02-23, 24 | integration (hand order, lowering rights) + desktop (hand and reactions shown; reaction gone after 3 s) |
| AC-F02-25 | desktop (share seen within 2 s, replaced share told, attendee has no Share) + integration (attendee pass has no screen right) |
| AC-F02-26, 27 | desktop (panel contents) + integration (no email to outsiders; photo only with a shared workspace) |
| AC-F02-28 | unit (weak detection) + desktop (notice with a simulated bad line) |
| AC-F02-29 | desktop (cut and restore the network: back within 10 s, same role, no lobby even when locked; a reconnect after LiveKit reported the leave is not refused; > 30 s → Rejoin with the old role) |
| AC-F02-30, 31 | desktop (noise suppression on by default and switch; device removed → default within 2 s with notice) |
| AC-F02-32 | desktop (Leave seen at once; closed app seen within 30 s) |
| AC-F02-33–37 | integration (rights, permission updates, mute all spares the caller, removal → lobby next time, lock rules) + desktop (each shown) |
| AC-F02-38, 39 | integration (end clears lobby and room; 30-hour jobs with a fake clock; warning 10 min before) + desktop (ended message) |
| AC-F02-40 | integration (guests refused, lobby guests turned away, inside guests stay) + desktop (switch) |
| AC-F02-41 | integration (record contents and who may read it; no media stored) |
| AC-F02-42 | integration (101st refused) |
| AC-F02-43 | screenshot tests of the new pages and components against the approved canvas (owner's look check at verify) |
| AC-F02-44, 45 | desktop keyboard-only run + axe; live announcements; loading and error states; translation keys test |
| AC-F02-46 | integration (Idempotency-Key) + desktop (backend stopped → message and Retry) |
| AC-F02-47 | load (25-person meeting, memory < 600 MB) |
| AC-F02-48, 49, 50 | security integration (wrong tries, same miss answer and timing, pass scope and lifetime, removal within 5 s, reuse refused, outsider sweeps on every new route) |
| AC-F02-51, 52 | html-names test extended; secrets-in-logs test extended (tokens, passcodes, link parts) |
| AC-F02-53 | integration (call connections use DTLS-SRTP; production config demands wss) |
| AC-F02-54 | desktop security tests (only media for app origin; other permissions refused; screen only after our picker; settings unchanged) |

## Decisions made here
- **D054 (proposed):** how meetings are built (backend decides, LiveKit enforces; lobby by polling; meeting tickets; webhooks as the record).
- **D055 (proposed):** new libraries `livekit-client` and `@livekit/components-react` (hooks only, styled with our components), and the `livekit/livekit-cli` Docker image for load tests. Each is vetted with `/add-dependency` before it's added.
