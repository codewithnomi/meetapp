---
feature: F15
title: Calls from chat (audio and video)
status: approved
updated: 2026-10-27
---

# F15 Calls from chat: Test Cases

Written **before** the code. Each test case becomes an automated test.
Levels: unit · component · integration · security (integration-style attempts to break rules) · e2e (desktop: real Electron windows, Playwright) · visual (Storybook screenshots) · performance.

Test names must include the TC and AC IDs, e.g. `TC-F15-18 [AC-F15-08] One-to-one: no answer after 30 s ends the call`.

**Test set-up (design.md "Test approach"):**
- Integration and security tests use real PostgreSQL, Redis, BullMQ and the LiveKit test server (as F02). The live line is tested with `injectWS`, and with two API server instances for fan-out.
- Seeded people as in F02/F14: workspace W1 (owner, admin A1, members M1, M2, M3, plus M4..M25 for the large-group cases) and W2 (member X1). External person E1 (account, member of W2 only). Y1: account with Personal workspace only. Outsider = signed-in user not in the chat. "Same answer" = same status code, body shape and message as "not found".
- Chats used: DM(M1,M2), group G3 (M1,M2,M3), group G21 (21 accepted members), group G20 (20 members), a meeting chat, a read-only DM (blocked, request pending, outside chat off, left).
- Time rules (30-second ring, 35-second clean-up, 30-hour end, 30 seconds to leave Away, 30-second transfer wait) use a fake clock on the server (BullMQ delayed jobs advanced by the test) and in unit tests.
- Desktop e2e uses 2 or 3 Electron windows with Playwright (`pnpm dev:window` style, as F02/F14). Camera and microphone are fake devices.
- Performance cases run with `pnpm test:load`. Visual cases run with `pnpm test:visual`.
- The whole F02 and F14 suites must keep passing (F14 status tests are updated from "in a meeting" to `in_call`, TC-F15-39).

## Test cases

### Starting a call

### TC-F15-01: Start creates the call, joins the caller, notes and rings
- **Covers:** AC-F15-01
- **Level:** integration
- **Given** DM(M1,M2) with no running call
- **When** M1 calls `POST /conversations/:id/calls {media:"video"}`
- **Then** 201 with F02's join answer (ticket and call-server pass, no lobby, no passcode, no meeting row); a call row with `conversation_id`, `media=video` and no `meeting_id`; one attendance for M1; a `call_started` note in the chat; one `call_rings` row for M2 in state `ringing`; none for M1

### TC-F15-02: Video and Audio buttons and the Calling screen
- **Covers:** AC-F15-01
- **Level:** e2e
- **Given** M1 and M2 in two windows, M1 in the DM
- **When** M1 presses **Video call**, later (after it ends) **Audio call**
- **Then** the Calling screen shows "Calling <M2 name>…" with **Cancel**; M1's microphone is on; the camera is on for video and off for audio; M2's window rings; for a group chat the screen shows the group's name

### TC-F15-03: Calls refused in every read-only chat
- **Covers:** AC-F15-02
- **Level:** integration
- **Given** read-only chats: M1 blocked E1's DM, a DM request not yet accepted, outside chat turned off, M1 left the group, M1 left W1, M1's account deleted, and a meeting chat
- **When** the affected person calls `POST /conversations/:id/calls`
- **Then** each is refused (403 `CHAT_READ_ONLY`; the meeting chat is refused too); no call, no attendance, no ring and no note is created

### TC-F15-04: Call buttons disabled with a reason
- **Covers:** AC-F15-02
- **Level:** component
- **Given** the chat header in each read-only state (blocked, request pending, outside off, left chat, left workspace, deleted account, meeting chat)
- **When** it renders
- **Then** both buttons are disabled with a tooltip and a note naming the reason (text from the translation file); in a normal chat they are enabled

### TC-F15-05: A running call replaces the buttons; a second start joins it
- **Covers:** AC-F15-03
- **Level:** integration
- **Given** M1 started a call in G3
- **When** M1 (second window) and M2 each call `POST /conversations/:id/calls`, and `GET /conversations/:id/call` is read by M3
- **Then** exactly one running call exists; M1's second window gets a join answer to the same call as a second participant; M2 is joined to it; nobody is rung again; the GET returns the running call to M3 and nothing to an outsider

### TC-F15-06: Join in the header and from the note
- **Covers:** AC-F15-03
- **Level:** e2e
- **Given** M1 started a call in G3, M3 has the chat open
- **When** M3 looks at the header and presses **Join** (the header button or the note's)
- **Then** the Video/Audio buttons are gone, **Join** shows; pressing it puts M3 in the same call; when the call ends the buttons come back

### TC-F15-07: More than 20 members: no ring, note with Join
- **Covers:** AC-F15-04
- **Level:** integration
- **Given** G21 (21 accepted members) and G20 (20 members)
- **When** the caller starts a call in each
- **Then** G21: the call starts, no `call_rings` rows, no `ring` messages, a "started a call" note exists, and the chat list's last line shows it without raising anyone's unread count; G20: everyone is rung

### TC-F15-08: Twenty people at most
- **Covers:** AC-F15-04, AC-F15-14
- **Level:** integration
- **Given** a running call in G21 with 20 different people in it
- **When** the 21st person joins, and a person already in it joins with a second window
- **Then** the 21st gets 409 `CALL_FULL` ("This call is full"); the second window of an existing person is accepted (it takes no place); LiveKit `maxParticipants` is 25

### Ringing

### TC-F15-09: Incoming-call window on every open window
- **Covers:** AC-F15-05
- **Level:** e2e
- **Given** M2 has two windows open, one on Settings and one on a meeting-less Home page; M1 calls
- **When** the call starts
- **Then** within 2 seconds both of M2's windows show the incoming call with M1's photo and name ("Video call", the group name for a group), a ringing sound starts, and **Accept with video**, **Accept with audio** and **Decline** are present

### TC-F15-10: Ring message content and timing
- **Covers:** AC-F15-05, AC-F15-34
- **Level:** integration
- **Given** M2 has three live-line connections (including one on another API instance)
- **When** M1 starts a group and a one-to-one call
- **Then** all three connections receive `ring` within 2 seconds with `callId`, `conversationId`, `from {userId,name,photoUrl}`, `media`, `groupName` (group only) and `expiresAt` = `rang_at + 30 s`

### TC-F15-11: Ring while the app is behind other screens
- **Covers:** AC-F15-05
- **Level:** e2e
- **Given** M2's window shows a page other than Chats (and the window is not focused)
- **When** M1 calls
- **Then** the incoming call appears app-wide on that page and plays the ringtone

### TC-F15-12: Accept with video and with audio
- **Covers:** AC-F15-06
- **Level:** e2e
- **Given** M2 has two windows ringing
- **When** M2 presses **Accept with video** in window 1; later, in another call, **Accept with audio**
- **Then** M2 is in the call within 3 seconds with microphone on and camera on (video) or off (audio); ringing stops in window 2 at once; M1 sees M2 join

### TC-F15-13: Accept race between two windows
- **Covers:** AC-F15-06, AC-F15-34
- **Level:** integration
- **Given** M2 with two windows and one `ringing` row
- **When** both send `POST /calls/:id/accept` at the same moment (repeated 20 times)
- **Then** exactly one gets a join answer and the ring becomes `accepted`; the other gets 409 `RING_OVER`; every window gets `ring_stop` (`accepted`); only one attendance exists

### TC-F15-14: A second window joins as a second participant
- **Covers:** AC-F15-06
- **Level:** integration
- **Given** M2 accepted in window 1
- **When** window 2 presses **Join** (`POST /calls/:id/join`)
- **Then** M2 has two attendances with different seat numbers; other apps list M2 once; M2 counts as one person toward the 20

### TC-F15-15: Decline in a one-to-one call
- **Covers:** AC-F15-07
- **Level:** integration
- **Given** DM call, M2 ringing in two windows
- **When** M2 calls `POST /calls/:id/decline`
- **Then** ring `declined`; `ring_stop` (`declined`) to both windows; the call ends; M1's side gets the "declined" outcome; a `call_missed` note exists for M2 (and no second one when the call ends)

### TC-F15-16: Decline in a group call
- **Covers:** AC-F15-07
- **Level:** integration
- **Given** G3 call, M2 and M3 ringing
- **When** M2 declines
- **Then** M2's windows stop; M3 keeps ringing; the call keeps running; M3 can still accept

### TC-F15-17: Ring state machine
- **Covers:** AC-F15-06, AC-F15-07, AC-F15-08, AC-F15-09
- **Level:** unit
- **Given** the ring state machine
- **When** every event (accept, decline, cancel, timeout, call ended) is applied to every state in every order
- **Then** only `ringing` can change; `accepted`, `declined`, `missed`, `cancelled` are final; a later event returns "over" and changes nothing; the first event wins

### TC-F15-18: One-to-one: no answer after 30 seconds
- **Covers:** AC-F15-08, AC-F15-19
- **Level:** integration
- **Given** a DM call ringing, fake clock
- **When** the clock moves to 29 s, then 30 s
- **Then** at 29 s still `ringing`; at 30 s the row is `missed`, `ring_stop` (`missed`) is sent, the call ends, a `call_missed` note exists for M2, the caller gets the "No answer" outcome

### TC-F15-19: Group: nobody joins within 30 seconds
- **Covers:** AC-F15-08
- **Level:** integration
- **Given** G3 call with M2 and M3 ringing, nobody joined, fake clock
- **When** 30 s pass; and in a second run M2 joins at 20 s then the clock passes 30 s
- **Then** first run: both rows `missed`, the call ends, each gets one missed note; second run: M2's row `accepted`, M3's `missed` with a missed note, the call keeps running

### TC-F15-20: Accept after the timeout
- **Covers:** AC-F15-08
- **Level:** integration
- **Given** a ring that became `missed` at 30 s
- **When** M2 calls accept at 31 s
- **Then** 409 `RING_OVER`; no attendance; the app shows "This call has ended" with **Call back**

### TC-F15-21: Caller cancels
- **Covers:** AC-F15-09
- **Level:** integration
- **Given** G3 call, M2 and M3 ringing
- **When** M1 calls `DELETE /calls/:id/ring`
- **Then** all rows `cancelled`; `ring_stop` (`cancelled`) to every window of M2 and M3 at once; each gets a missed note; the call ends

### TC-F15-22: Caller leaves a group call first
- **Covers:** AC-F15-09
- **Level:** integration
- **Given** G3 call, nobody but M1 joined, M2 and M3 ringing
- **When** the LiveKit webhook reports M1's last participant left
- **Then** the same result as TC-F15-21 (rows `cancelled`, `ring_stop`, one missed note each, call ended). Variant: M2 already joined, M1 leaves: M3 keeps ringing and the call continues

### TC-F15-23: Calling screen outcomes
- **Covers:** AC-F15-07, AC-F15-08, AC-F15-09
- **Level:** e2e
- **Given** M1 and M2 windows
- **When** M2 declines; then M1 calls again and M2 ignores it for 30 s; then M1 calls and presses **Cancel**
- **Then** M1 sees "<name> declined" with **Call again** and **Back to chat**; then "No answer" with the same buttons; then Cancel returns to the chat and M2's incoming window disappears at once; each time M2's chat shows "Missed call from M1"

### TC-F15-24: Called while in a call or meeting
- **Covers:** AC-F15-10
- **Level:** integration
- **Given** M2 is in a meeting (F02) and M3 is in another chat call
- **When** M1 calls each of them
- **Then** both get `ring` (the message tells nothing that stops it); accepting makes the app leave the current call first (F02 leave) and then `accept`; M2's meeting attendance ends before the chat attendance starts

### TC-F15-25: Incoming call during a call: quiet tone and button names
- **Covers:** AC-F15-10
- **Level:** e2e
- **Given** M2 in a meeting
- **When** M1 calls M2
- **Then** the incoming window shows "You're in … Accepting leaves it", the buttons are named **Leave current call and accept with video/audio**, the tone plays at the lower volume; pressing it leaves the meeting and joins the call; there is no hold option

### TC-F15-26: No window open: nothing rings, missed note later
- **Covers:** AC-F15-11
- **Level:** integration
- **Given** M2 has no live-line connection
- **When** M1 calls and 30 s pass
- **Then** no `ring` is delivered; the ring becomes `missed`; the missed note is in the chat and M2 sees it with unread count 1 after connecting

### In the call

### TC-F15-27: Chat calls have equal rights; organizer routes refused
- **Covers:** AC-F15-12
- **Level:** integration
- **Given** a running chat call with M1 (starter) and M2
- **When** M1 and M2 try F02's mute-others, remove, lock, lobby admit, role-change and end-for-all routes, and a lobby-path ticket
- **Then** every one is refused for both (403/404); the call-server pass grants publish of own mic, camera and screen only; both can leave, raise hand and react

### TC-F15-28: In-call behaviour and the call's chat panel
- **Covers:** AC-F15-12
- **Level:** e2e
- **Given** M1 and M2 in a chat call
- **When** they use mute, camera, screen share, reactions, raised hand, device change, noise suppression; M1 sends a message in the call's Chat panel; the call ends
- **Then** all work as in F02; no organizer buttons show; the message is in the chat afterwards and for M2; the Chat panel is that same chat

### TC-F15-29: Add people
- **Covers:** AC-F15-13
- **Level:** integration
- **Given** a G3 call with M1 and M2 in it; M3 not in it; M4 not in the chat
- **When** M2 calls `POST /calls/:id/ring {userIds:[M3]}`, then `{userIds:[M4]}`, then M3 (already ringing and in the call after accepting)
- **Then** M3 gets `ring`; M4 is refused (404 like not found, no ring); a person already in the call is not rung; a person who declined earlier may be rung again with a new row

### TC-F15-30: Add people panel and the 20 limit
- **Covers:** AC-F15-13
- **Level:** e2e
- **Given** M1, M2 in a G3 call; then a call holding 20 people
- **When** M1 opens **Add people**
- **Then** the panel lists only chat members not in the call, each showing ringing / declined / Add; picking M3 rings M3's window; at 20 people **Add people** is disabled; members outside the chat cannot be chosen

### TC-F15-31: Call ending rules
- **Covers:** AC-F15-14
- **Level:** integration
- **Given** a DM call with both in it, and a group call with 3 in it
- **When** one person of the DM leaves; then in the group two leave, then the last leaves
- **Then** the DM call ends for both (room deleted, `ended_at` set, `call_ended` note); the group call continues after two leave and ends when the last leaves

### TC-F15-32: Thirty-hour limit
- **Covers:** AC-F15-14
- **Level:** integration
- **Given** a running call, fake clock
- **When** the clock reaches 29h50m and then 30h
- **Then** the 10-minute notice is sent to everyone; at 30 h the call ends with a note to everyone

### What the chat shows

### TC-F15-33: Started, ended and missed notes
- **Covers:** AC-F15-15
- **Level:** integration
- **Given** G3 call started by M1; M2 joins; M3 never joins (declines); the call lasts 12 min 30 s on the fake clock and ends
- **When** the chat is read by M1, M2, M3
- **Then** all see `call_started` then `call_ended {seconds:750, people}`; only M3 sees `call_missed {from:M1, forUserId:M3}`; M1 and M2 have no missed note; M3 has exactly one missed note even though declined

### TC-F15-34: Duration and note texts
- **Covers:** AC-F15-15
- **Level:** unit
- **Given** the note text functions
- **When** given 0 s, 59 s, 750 s, 3599 s, 3900 s, 36000 s
- **Then** "0s"/"59s"/"12m 30s"/"59m 59s"/"1h 05m"/"10h 00m"; all wording comes from the translation file with the locale

### TC-F15-35: Missed note visibility and unread
- **Covers:** AC-F15-15, AC-F15-04
- **Level:** integration
- **Given** the chat with a `call_missed` for M3, a `call_started` and a `call_ended`
- **When** M1, M2 and M3 load the chat, the chat list, and the unread totals; and the live line news is observed
- **Then** the missed note appears only for M3 (pages, list last line, live-line news go only to M3's channel; M1 and M2 never receive it); it raises M3's unread by 1; `call_started` and `call_ended` raise nobody's unread; reading the chat clears it

### TC-F15-36: CallNote display
- **Covers:** AC-F15-15
- **Level:** component
- **Given** the CallNote component
- **When** rendered as running, ended, missed
- **Then** running: "<name> started a call · 03:12 · 2 people" with **Join** (hidden once ended); ended: "Call ended · 1h 05m · Sara, Omar and you"; missed: "Missed call from Omar · 17:42" with **Call back**, which starts a call

### TC-F15-37: Chat list last line
- **Covers:** AC-F15-15
- **Level:** integration
- **Given** a chat whose newest item is each of the three notes
- **When** the list is loaded for the called person and another member
- **Then** the called person's last line shows the missed call and counts unread; the other member's last line shows the newest note they may see; ordering by latest activity includes notes

### Status

### TC-F15-38: Status "In a call"
- **Covers:** AC-F15-16
- **Level:** integration
- **Given** M1 who may see M2's status (F14 AC-26), M2 Available
- **When** M2 joins a chat call, then a meeting, then leaves; the clock passes 29 s and 31 s after leaving; and in another run M2's app closes during the call
- **Then** M1 sees `in_call` in both kinds of call; back to Available (or Away) within 30 s of leaving; app closed: Away for 30 s then Offline (D068); M2's status is hidden from people who may not see it (no leak)

### TC-F15-39: "In a meeting" is gone
- **Covers:** AC-F15-16
- **Level:** integration
- **Given** F14's status tests, updated
- **When** they run
- **Then** they expect `in_call` and pass; a search of contracts, app labels and translation files finds no `in_meeting` value and no "In a meeting" text

### Other devices and transfer

### TC-F15-40: Other device sees the active call
- **Covers:** AC-F15-33
- **Level:** integration
- **Given** M2 in a call from device A
- **When** device B (signed in as M2) calls `GET /me/calls/active`; an outsider calls it
- **Then** B gets the call, the chat and which devices are in it; the outsider gets only their own (empty) list; no other person's call is ever listed

### TC-F15-41: Transfer: new device connects before the old leaves
- **Covers:** AC-F15-33
- **Level:** integration
- **Given** M2 in a call on seat 1 with M1 present
- **When** device B calls `POST /calls/:id/transfer {fromAttendanceId}`, then connects to LiveKit
- **Then** the old attendance is `transferring` until the webhook reports the new participant; only then the old one is removed (`transferred`); the order of events is new joined, old removed; within 3 seconds; M1's app shows M2 once the whole time (no leave and join); the other attendance fields of M2 are unchanged

### TC-F15-42: Transfer never connects
- **Covers:** AC-F15-33
- **Level:** integration
- **Given** a transfer started and the new device never connects, fake clock
- **When** 30 s pass
- **Then** the old seat is still in the call; its attendance returns to `active`; the call is unaffected; the unused pass no longer works; transferring someone else's attendance is refused (404)

### TC-F15-43: Join on this device or Transfer to this device
- **Covers:** AC-F15-33
- **Level:** e2e
- **Given** M2 in a call in window 1; M2 opens window 2
- **When** window 2 shows the banner and M2 presses **Transfer to this device**; later repeats with **Join on this device**
- **Then** the banner says "You're in a call on another device" with both buttons; Transfer moves the call and window 1 leaves; Join keeps both windows in the call as two participants

### TC-F15-44: Ring reaches every device, answer on one stops all
- **Covers:** AC-F15-34
- **Level:** integration
- **Given** M2 signed in on three desktop windows
- **When** M1 calls; M2 declines on window 3; in a second run M2 accepts on window 2
- **Then** all three get `ring`; after the answer all three get `ring_stop`; a device that signs in later during ringing still gets the ring until `expiresAt`

### TC-F15-45: Ring targets interface
- **Covers:** AC-F15-34
- **Level:** unit
- **Given** the ring service with a fake push target added next to the live-line target
- **When** a ring, a stop, accept and decline are run
- **Then** both targets receive `ring` and `stop(callId, reason)` once; the ring record, 30 s clock and missed notes behave the same; a failing target does not stop the other

### Settings

### TC-F15-46: Settings → Devices
- **Covers:** AC-F15-29
- **Level:** component
- **Given** the Devices page with fake media devices (2 microphones, 2 speakers, 2 cameras)
- **When** the person opens it, picks each device, plays **Test speakers**, speaks into the microphone, toggles noise suppression
- **Then** it lists devices of each kind, shows a live camera preview, a moving level meter, plays the test sound on the chosen speaker, and the noise suppression switch changes the setting

### TC-F15-47: Device choices are remembered and fall back
- **Covers:** AC-F15-29
- **Level:** unit
- **Given** the device preferences store (local storage)
- **When** choices are saved, the store reloads, and the chosen device disappears from the list
- **Then** the choices are returned and used by pre-join, in-call settings and the incoming-call accept; a missing device falls back to the default and a notice is raised (F02 AC-31); choices stay per computer, not sent to the backend

### TC-F15-48: Background picker
- **Covers:** AC-F15-30
- **Level:** component
- **Given** the BackgroundPicker in Settings, pre-join and the in-call camera menu
- **When** the person picks None, Blur and each of the pictures
- **Then** there are at least 8 pictures with names; the own preview shows the choice before others do; the choice is saved per computer and preselected next time in calls and meetings

### TC-F15-49: Backgrounds stay on the computer
- **Covers:** AC-F15-30
- **Level:** e2e
- **Given** a window with network recording on
- **When** the person turns on blur and each picture in preview and in a call
- **Then** the model files and pictures are loaded from the app itself; no request goes to any outside address; the other person's window receives the processed video (checked with a fake camera pattern)

### TC-F15-50: Frame-rate fallback
- **Covers:** AC-F15-31
- **Level:** unit
- **Given** the frame monitor with a fake clock and fake `onFrameProcessed` events
- **When** the rate is 30 fps, then 14 fps for 4 s, then 14 fps for 5 s, then back to 30 fps
- **Then** no action at 30 fps or after only 4 s low; after 5 s under 15 fps the effect switches to disabled and the message "Background turned off to keep your video smooth" is shown once; the call video keeps running; it does not turn on again by itself

### TC-F15-51: Background tool not supported
- **Covers:** AC-F15-30
- **Level:** component
- **Given** the browser reports no support for the background tool
- **When** the picker renders
- **Then** the options are disabled with "Not available on this computer"; calls still work with the plain camera

### TC-F15-52: Ringtone settings API
- **Covers:** AC-F15-32
- **Level:** integration
- **Given** a new user and a second user
- **When** `GET /me/settings`, then `PATCH {ringtone:3, ringVolume:40}`, then invalid values (0, 6, -1, 101, text, extra keys), and the second user's settings are read
- **Then** defaults are ringtone 1 and volume 70; the valid values are saved and returned on every device; invalid values are rejected 422 and nothing changes; users can't read or write each other's values; F14's other settings are unchanged

### TC-F15-53: Ringtone picker and tone patterns
- **Covers:** AC-F15-32
- **Level:** component
- **Given** the RingtonePicker with the Web Audio API faked
- **When** each of the 5 play buttons is pressed and the volume is moved
- **Then** 5 distinct tone patterns are generated (no sound files requested); the chosen one is marked; the volume is applied to playback; the first is the default

### TC-F15-54: Chosen ringtone is used when ringing
- **Covers:** AC-F15-32, AC-F15-05
- **Level:** e2e
- **Given** M2 chose ringtone 4 at volume 50 in Settings → Calls, and opens a second window
- **When** M1 calls
- **Then** M2's incoming call plays tone 4 at the chosen volume in both windows (the same on every computer)

### Screens and quality

### TC-F15-55: Visual screenshots
- **Covers:** AC-F15-17
- **Level:** visual
- **Given** stories for IncomingCall (normal, group, in-call variant), CallingScreen (calling, declined, no answer), CallNote (running, ended, missed), BackgroundPicker, RingtonePicker, the chat header buttons (enabled, disabled, Join), Settings → Devices and Calls
- **When** `pnpm test:visual` runs in light and dark
- **Then** screenshots match the baselines made from the approved canvas row "Calls from chat (F15)"; only design-system tokens are used (checked by the lint rules)

### TC-F15-56: Keyboard and screen reader
- **Covers:** AC-F15-18
- **Level:** e2e
- **Given** M2 using only the keyboard, with accessibility tree checks
- **When** M1 calls; M2 presses Tab to reach the buttons, accepts with Enter; later declines with Escape or the button; also the call buttons, Add people and settings pages are used by keyboard
- **Then** the incoming call takes focus and is announced (live region with the caller's name); Accept and Decline are reachable and named; on close focus returns to the element that had it; every control has an accessible name and a visible focus; the axe check finds no serious problems

### TC-F15-57: Loading and error states with Retry
- **Covers:** AC-F15-18, AC-F15-19
- **Level:** component
- **Given** the call buttons and the accept button with a slow, then failing, request
- **When** pressed
- **Then** a spinner shows while waiting (button not pressable twice); a failure shows "Couldn't start the call" (or "Couldn't join the call") with **Retry**, which sends the request again and works

### TC-F15-58: All text from the translation file
- **Covers:** AC-F15-18
- **Level:** unit
- **Given** the new components and pages and a test language with marked strings
- **When** rendered
- **Then** every visible and screen reader text is from the marked file; the lint rule finds no hard-coded text in `features/calls`, `features/devices` and the new UI components

### TC-F15-59: Both people call at the same moment
- **Covers:** AC-F15-26
- **Level:** integration
- **Given** DM(M1,M2), no call
- **When** both send `POST /conversations/:id/calls` simultaneously (repeated 50 times, with random small delays)
- **Then** exactly one running call each time (partial unique index); both are joined to it; no `call_rings` rows are created for either; no `ring` message is sent; one `call_started` note

### TC-F15-60: Missing, busy or blocked camera or microphone
- **Covers:** AC-F15-27
- **Level:** component
- **Given** the media layer faked as: no camera; camera in use; microphone permission denied
- **When** a call is started and another accepted
- **Then** the call starts/accepts with that device off; F02's device message names the device and how to fix it; the other devices still work

### TC-F15-61: Backend or call server unreachable
- **Covers:** AC-F15-19
- **Level:** e2e
- **Given** the backend stopped (then the call server stopped)
- **When** the person starts, accepts, or is in a call when it goes down
- **Then** within 10 seconds the app says so (F02 AC-46); no endless spinner; the incoming call, if shown, stays at most until `expiresAt`

### TC-F15-62: Caller's app dies while ringing
- **Covers:** AC-F15-19
- **Level:** integration
- **Given** a group call ringing; the caller's connection and webhook vanish; the delayed job is deleted from the queue (simulating loss)
- **When** the fake clock passes 35 s and the every-minute clean-up runs
- **Then** every ring older than 35 s is `missed` with `ring_stop` sent; a call with nobody in it ends; ringing never lasts more than 35 s

### Security & privacy

### TC-F15-63: Outsider sweep over every new route
- **Covers:** AC-F15-20
- **Level:** security
- **Given** a running call in G3, an outsider from the same workspace (M4), an outsider from another workspace (X1), the external E1, Y1, and a signed-out client; each tries `POST /conversations/:id/calls`, `GET /conversations/:id/call`, `POST /calls/:id/join`, `/accept`, `/decline`, `DELETE /calls/:id/ring`, `POST /calls/:id/ring`, `POST /calls/:id/transfer`, `GET /me/calls/active`, and the live line for the call
- **When** the calls are made, including with unknown ids and with ids of calls in another workspace
- **Then** every one returns "same answer" as not found (signed out: 401); nothing about the call (existence, members, state) is revealed; no ring, attendance, note or pass is created; timing does not differ measurably between existing and non-existing calls

### TC-F15-64: Membership checked at the moment of joining
- **Covers:** AC-F15-20
- **Level:** security
- **Given** M3 a member of G3 who was removed a moment ago (and an old ring still on M3's screen); and M3 left the workspace
- **When** M3 presses **Join** and **Accept** with the old data
- **Then** both are refused as not found; no pass is returned; the old ring is already stopped

### TC-F15-65: Pass rules (S4)
- **Covers:** AC-F15-21
- **Level:** security
- **Given** a pass for M2 in a chat call
- **When** it is decoded; used for another call; used after M2 leaves, after M2 is removed from the chat, and after the call ends; and the clock passes its lifetime
- **Then** it names exactly one call and room, M2's identity and seat, and no admin rights; it is short-lived; each of the later uses is refused by the call server; a pass from a meeting does not open a chat call and vice versa

### TC-F15-66: Rate limit on calls and Add people (S5)
- **Covers:** AC-F15-22
- **Level:** security
- **Given** M1 with a fake clock and a group of 15 members
- **When** M1 starts 10 calls within a minute (ending each), then an 11th; or rings 8 people then 3 more with Add people
- **Then** the 11th unit (a start counts 1, each rung person counts 1) is refused 429 `CALL_RATE` with the seconds to wait; after the wait it works; another person's limit is separate; the counter key is an HMAC, not a plain id

### TC-F15-67: Logs and error reports (S10)
- **Covers:** AC-F15-23
- **Level:** security
- **Given** all log and error-report output captured during a whole call (start, ring, accept, decline, add, transfer, failures)
- **When** it is searched for the call-server passes, tickets, caller names, photos, chat text and any audio or video marker
- **Then** none found; only ids, states and timings

### TC-F15-68: Blocked one-to-one
- **Covers:** AC-F15-24, AC-F15-02
- **Level:** security
- **Given** M1 (blocker) blocked E1 who shares a DM
- **When** E1 calls from the DM; E1 reads the chat state; M1's live line is watched
- **Then** E1 is refused like any read-only chat, with no sign of the block (same message as other read-only states for an external person); M1 gets no `ring`; unblocking behaviour follows F14

### TC-F15-69: Blocked person in a shared group
- **Covers:** AC-F15-24
- **Level:** security
- **Given** M1 blocked E1 and both are in a group
- **When** either starts a group call
- **Then** the call works as normal for both; the other receives a ring; E1 is never told about the block

### TC-F15-70: Removal during a call (within 2 seconds)
- **Covers:** AC-F15-25
- **Level:** integration
- **Given** M3 in a G3 call
- **When** A1 removes M3 from the chat; and in separate runs M3 leaves the chat, M3 is removed from W1, M3's account is deleted
- **Then** each time M3's attendance becomes `removed`, LiveKit `RemoveParticipant` is called, M3's pass stops working, and M3 is out of the call within 2 seconds (measured); others stay

### TC-F15-71: Removal while ringing
- **Covers:** AC-F15-25
- **Level:** integration
- **Given** M3 ringing in G3; or the caller removed from the chat meanwhile
- **When** M3 is removed; in another run the caller is removed
- **Then** M3's ring is `cancelled`, `ring_stop` is sent, no missed note is shown to M3 after removal; when the caller is removed all their rings are cancelled

### TC-F15-72: Data kept, cascade and export
- **Covers:** AC-F15-28
- **Level:** integration
- **Given** an ended call with attendances and rings
- **When** rows are read; the chat is deleted; a person's account is deleted and a data export is made
- **Then** only starter, chat, joined/left times, rings and length are stored (no audio, video, recording or transcript column or object); the chat's deletion removes calls, attendances and rings; the export of a person includes their call data

### TC-F15-73: Malicious input in rings and Add people
- **Covers:** AC-F15-13, AC-F15-20, AC-F15-23
- **Level:** security
- **Given** a caller whose name is `<img src=x onerror=alert(1)>`; Add people with duplicate ids, 1000 ids, wrong types, ids from another workspace
- **When** the ring is sent and shown; Add people is called
- **Then** the name is shown as plain text; invalid or foreign ids are refused (422/404) and nothing is rung; the request size is capped; duplicates ring once

### TC-F15-74: Only the starter can cancel; others can't end
- **Covers:** AC-F15-20, AC-F15-09
- **Level:** security
- **Given** a group call ringing, M2 a member
- **When** M2 calls `DELETE /calls/:id/ring`, F02's end-for-all route, and decline for M3's ring
- **Then** all refused (404); M3's ring is untouched; a user can only answer their own ring row

### TC-F15-75: Chat calls and meetings kept apart
- **Covers:** AC-F15-20, AC-F15-12
- **Level:** security
- **Given** a meeting and a chat call
- **When** a meeting ticket or lobby path is used for the chat call, and the chat call routes for a meeting id; and a call row with both or neither of `meeting_id` and `conversation_id` is inserted
- **Then** all refused; the database check allows exactly one of the two

### Performance

### TC-F15-76: Twenty-person call
- **Covers:** AC-F15-14, AC-F15-12
- **Level:** performance
- **Given** the load test with 20 simulated people in a chat call (the 25-person case reused)
- **When** they join, publish audio and some video, and leave
- **Then** join times, audio quality and server load stay inside the F02 targets (quality-targets.md); the 21st is refused

### TC-F15-77: Ring speed under load
- **Covers:** AC-F15-05, AC-F15-06, AC-F15-34
- **Level:** performance
- **Given** 250 connected simulated people, 20 groups of 20 calling at once
- **When** every group starts a call
- **Then** 95% of rings are delivered in under 2 seconds and accepts return in under 3 seconds

### TC-F15-78: Background effect speed
- **Covers:** AC-F15-30, AC-F15-31
- **Level:** performance
- **Given** the reference Mac with a 720p camera
- **When** blur and a picture are on for 60 seconds
- **Then** at least 15 frames a second are kept (no fallback); the switch between effects takes under 1 second and does not flicker

### Regression

### TC-F15-79: Earlier suites keep passing
- **Covers:** AC-F15-12, AC-F15-16
- **Level:** integration
- **Given** the F02 meeting suite and the F14 chat suite
- **When** they run with migration `0009_chat_calls` applied (rows made before it keep their meeting)
- **Then** all pass unchanged (only the F14 status wording is updated, TC-F15-39); the migration adds columns, the table and the index without locking rewrites

## Coverage table

| AC | Test cases |
|---|---|
| AC-F15-01 | TC-F15-01, 02 |
| AC-F15-02 | TC-F15-03, 04, 68 |
| AC-F15-03 | TC-F15-05, 06 |
| AC-F15-04 | TC-F15-07, 08, 35 |
| AC-F15-05 | TC-F15-09, 10, 11, 54, 77 |
| AC-F15-06 | TC-F15-12, 13, 14, 17, 77 |
| AC-F15-07 | TC-F15-15, 16, 17, 23 |
| AC-F15-08 | TC-F15-17, 18, 19, 20, 23 |
| AC-F15-09 | TC-F15-17, 21, 22, 23, 74 |
| AC-F15-10 | TC-F15-24, 25 |
| AC-F15-11 | TC-F15-26 |
| AC-F15-12 | TC-F15-27, 28, 75, 76, 79 |
| AC-F15-13 | TC-F15-29, 30, 73 |
| AC-F15-14 | TC-F15-08, 31, 32, 76 |
| AC-F15-15 | TC-F15-33, 34, 35, 36, 37 |
| AC-F15-16 | TC-F15-38, 39, 79 |
| AC-F15-17 | TC-F15-55 |
| AC-F15-18 | TC-F15-56, 57, 58 |
| AC-F15-19 | TC-F15-18, 57, 61, 62 |
| AC-F15-20 | TC-F15-63, 64, 73, 74, 75 |
| AC-F15-21 | TC-F15-65 |
| AC-F15-22 | TC-F15-66 |
| AC-F15-23 | TC-F15-67, 73 |
| AC-F15-24 | TC-F15-68, 69 |
| AC-F15-25 | TC-F15-70, 71 |
| AC-F15-26 | TC-F15-59 |
| AC-F15-27 | TC-F15-60 |
| AC-F15-28 | TC-F15-72 |
| AC-F15-29 | TC-F15-46, 47 |
| AC-F15-30 | TC-F15-48, 49, 51, 78 |
| AC-F15-31 | TC-F15-50, 78 |
| AC-F15-32 | TC-F15-52, 53, 54 |
| AC-F15-33 | TC-F15-40, 41, 42, 43 |
| AC-F15-34 | TC-F15-10, 13, 44, 45, 77 |

Security rules (security.md and design "Security & privacy"): S1/S2 membership and workspace checks on every new route (TC-63, 64, 74, 75), S4 call-server pass rules (TC-65), S5 rate limit on starts and Add people (TC-66), S10 logs and error reports (TC-67), blocks (TC-68, 69), removal from the chat or workspace during a call (TC-70, 71), malicious input (TC-73), data kept and removed (TC-72), backgrounds never leave the computer (TC-49), settings isolation between users (TC-52).
