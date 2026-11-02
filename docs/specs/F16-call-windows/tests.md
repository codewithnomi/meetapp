---
feature: F16
title: Calls while MeetApp isn't in front
status: approved
updated: 2026-11-02
---

# F16 Calls while MeetApp isn't in front: Test Cases

Written **before** the code. Each test case becomes an automated test, except those marked manual.
Levels: unit, ui (component + Storybook, screenshots at verification), integration, security, desktop e2e (real Electron windows, Playwright), manual.

Test names must include the TC and AC IDs, e.g. `TC-F16-07 [AC-F16-03] Video accepts and opens the call within 3 s`.

**Set-up (design.md "Test approach"):**
- No backend change, so no new server tests. Rules in `call-windows.ts` are pure and unit-tested with fake screens, fake focus and a fake clock. The Electron wiring uses a fake `Notification` and fake `BrowserWindow` in unit tests.
- Desktop e2e uses 2 or 3 Electron windows (F02/F15 style: caller M1, receiver M2, a second caller M3). Camera and microphone are fake devices. "Not in front" = main window minimized or another (non-MeetApp) window focused.
- **Platforms:** the desktop cases run on the owner's Mac. What only a person can confirm (over a full-screen app, absent from a screen share) is in the hand checks TC-F16-47 and TC-F16-57; the flags themselves are unit-tested. Cases marked "(skip on Linux CI)" depend on macOS/Windows features; on GitHub's Linux computers they may need a skip (see D077 for those runs).
- **D080:** notification cases are unit-tested with a fake `Notification`; the real macOS notification and permission question are manual (TC-F16-28) once the app is signed.
- The F02 and F15 suites must keep passing.

## Test cases

### Ring window shows

### TC-F16-01: Ring window only while no MeetApp window is in front
- **Covers:** AC-F16-01, AC-F16-05
- **Level:** unit
- **Given** a report with one ring
- **When** focus is: none, another app, all minimized, then a MeetApp window focused
- **Then** the ring window is wanted (after the 150 ms wait) in the first three cases and not in the last; it is created with `showInactive()` and never `focus()`

### TC-F16-02: Placement in the corner of the last-used MeetApp screen
- **Covers:** AC-F16-01
- **Level:** unit
- **Given** two screens; the MeetApp window used last is on screen 2
- **When** a ring window is placed with no remembered place
- **Then** it is at the bottom-right of screen 2's work area, 16 px from the edges

### TC-F16-03: Ring window appears over another app and stays unfocused
- **Covers:** AC-F16-01, AC-F16-26
- **Level:** desktop e2e (skip on Linux CI)
- **Given** M2's main window minimized
- **When** M1 calls M2
- **Then** a ring window exists, is visible, `isFocused()` is false, and is always-on-top

### TC-F16-04: Ring window content
- **Covers:** AC-F16-02
- **Level:** ui
- **Given** `RingWindow` with a video call, an audio call, a caller with and without a photo, and a group call
- **When** rendered
- **Then** it shows picture or initials, name, "Video call" or "Audio call", the chat name for a group, and buttons Video, Audio, Decline, ×

### Answer, decline, hide

### TC-F16-05: Accept action goes to the main window and brings it forward
- **Covers:** AC-F16-03
- **Level:** unit
- **Given** a shown ring `c1`
- **When** the ring window sends `accept {callId:c1, video:true}` and later `video:false`
- **Then** the action is forwarded to the main window used last, that window is shown and focused, and the ring window closes

### TC-F16-06: Accept leaves the current call first (web)
- **Covers:** AC-F16-03, AC-F16-07
- **Level:** unit
- **Given** the main window is in call B and a ring A arrives
- **When** the `accept` action arrives
- **Then** the same code as the in-app Accept runs: B is left, A is accepted with the chosen camera setting

### TC-F16-07: Video and Audio accept opens the call within 3 s
- **Covers:** AC-F16-03
- **Level:** desktop e2e
- **Given** M2 minimized, M1 rings
- **When** M2 presses **Video** in the ring window; repeat with **Audio**
- **Then** the ring window closes, M2's main window is in front and in the call within 3 s; camera on for Video, off for Audio

### TC-F16-08: Decline
- **Covers:** AC-F16-04
- **Level:** unit
- **Given** a shown ring
- **When** `decline {callId}` arrives
- **Then** the main window runs F15's decline and the ring window closes

### TC-F16-09: Hide (×) silences only this computer
- **Covers:** AC-F16-04
- **Level:** unit
- **Given** a ring with the tone playing
- **When** `hide {callId}` arrives
- **Then** the ring window closes, the tone for that ring is muted, no decline is sent, the incoming call stays shown silently in the main window, and the window does not reopen while the ring lasts

### TC-F16-10: Decline and × in real windows
- **Covers:** AC-F16-04
- **Level:** desktop e2e
- **Given** M2 minimized and rung by M1; M2 has a second device session
- **When** M2 presses **Decline**; then on a new call presses **×**
- **Then** Decline: M1 sees declined and the window closes. ×: the window closes, no tone, M2's main window shows the call silently after restoring, the second device still rings

### TC-F16-11: Ring window closes when MeetApp comes to the front, tone continues
- **Covers:** AC-F16-05
- **Level:** desktop e2e
- **Given** a ring window showing and the tone playing
- **When** M2's main window is restored and focused
- **Then** the ring window closes, the in-app incoming call shows, and the tone's audio element was never paused or restarted

### TC-F16-12: Ring window closes when the ring ends
- **Covers:** AC-F16-06
- **Level:** unit
- **Given** a shown ring
- **When** a report no longer lists it (caller cancels, answered elsewhere, 30 s, call ended: four runs, fake clock)
- **Then** the window closes within 2 s of that report

### TC-F16-13: Ring window closes when the caller cancels (real windows)
- **Covers:** AC-F16-06
- **Level:** desktop e2e
- **Given** a ring window showing
- **When** M1 cancels; separately another device of M2 answers; separately 30 s pass (fake clock where available)
- **Then** the ring window is gone within 2 s each time

### TC-F16-14: Busy wording and buttons
- **Covers:** AC-F16-07
- **Level:** ui
- **Given** `RingWindow` with `busyIn="Release team"`, video and audio
- **When** rendered
- **Then** it says "You're in Release team. Accepting leaves it." and buttons "Leave current call and accept" with video or audio

### TC-F16-15: Busy report and quieter tone (web)
- **Covers:** AC-F16-07
- **Level:** unit
- **Given** the user is in a meeting "Release team" and a call rings
- **When** the report builder runs
- **Then** the ring has `busyIn:"Release team"` and the quieter tone (AC-F15-10) is chosen; with no current call `busyIn` is absent

### Several calls

### TC-F16-16: Stacking, newest on top, no overlap with the mini window
- **Covers:** AC-F16-08
- **Level:** unit
- **Given** three rings and a mini window at the corner, remembered or default place
- **When** positions are computed
- **Then** rings stack upwards with an 8 px gap, newest on top, and no rectangle intersects another or the mini window (the stack starts above it)

### TC-F16-17: One ringtone for several rings (web)
- **Covers:** AC-F16-08
- **Level:** unit
- **Given** two rings at once
- **When** the report is built and the tone is driven
- **Then** one tone plays; two ring entries are reported

### TC-F16-18: Gap closing
- **Covers:** AC-F16-09
- **Level:** unit
- **Given** three stacked rings
- **When** the middle one ends, then the bottom one
- **Then** the others move down so there is no gap each time

### TC-F16-19: Two callers at once (real windows)
- **Covers:** AC-F16-08, AC-F16-09
- **Level:** desktop e2e
- **Given** M2 minimized; M1 and M3 call M2
- **When** both ring, then the lower one is declined
- **Then** two ring windows stacked without overlap, newest on top; after the decline the other moves down

### Missed call notification

### TC-F16-20: Notification for a missed call when not in front
- **Covers:** AC-F16-10, AC-F16-23
- **Level:** unit
- **Given** fake `Notification`; no main window in front at `endedAt`
- **When** a `missed` entry arrives for a DM and for a group "Release team"
- **Then** one notification each: "Missed call" with "from Sara" and "from Sara in Release team", one action `Call back`, and no message text

### TC-F16-21: Judged by focus at the time the ring ended
- **Covers:** AC-F16-10, AC-F16-12
- **Level:** unit
- **Given** focus history: not in front at 10:00:30, MeetApp focused at 10:00:32; and the reverse
- **When** a late report with `endedAt` 10:00:31 arrives
- **Then** the first case notifies (not in front at that moment), the reverse case does not

### TC-F16-22: No notification for answered, declined, cancelled or seen-in-front
- **Covers:** AC-F16-12
- **Level:** unit
- **Given** reports for answered and declined rings, rings ended by removal (no "Missed call" note), and a missed ring that ended while a MeetApp window was in front
- **When** processed
- **Then** no notification is created in any case

### TC-F16-23: Call back starts the same kind of call
- **Covers:** AC-F16-11
- **Level:** unit
- **Given** a notification for a video missed call in chat `conv1`
- **When** **Call back** is pressed (video, then audio)
- **Then** the main window is brought forward and receives `callBack {conversationId, video}` which runs the chat call button code

### TC-F16-24: Call back when the call can't start (web)
- **Covers:** AC-F16-11
- **Level:** unit
- **Given** the chat is read-only, or the person left it, or the call limit is reached
- **When** `callBack` runs
- **Then** the chat opens and shows the same message the call button would; no call is created

### TC-F16-25: Clicking the notification opens the chat
- **Covers:** AC-F16-11
- **Level:** unit
- **Given** a shown notification
- **When** it is clicked
- **Then** the window used last is brought forward and gets `openChat {conversationId}`

### TC-F16-26: Notifications off or failing
- **Covers:** AC-F16-13
- **Level:** unit
- **Given** a fake `Notification` that emits `failed` or reports unsupported
- **When** a missed call is processed
- **Then** no exception, no dialog, one log line without names, the app keeps working, and the report still lists the "Missed call" note data

### TC-F16-27: Permission question asked once
- **Covers:** AC-F16-13b
- **Level:** unit
- **Given** a fake `Notification` and a stored "asked" flag
- **When** the first missed call shows, then the system reports refused, then a second missed call arrives
- **Then** MeetApp shows the first notification (which triggers the macOS question), never opens its own prompt, and does not retry in a loop after refusal

### TC-F16-28: Mac notification by hand
- **Covers:** AC-F16-10, AC-F16-11, AC-F16-13, AC-F16-13b, AC-F16-23
- **Level:** manual (when signed, D080)
- **Given** a signed build, MeetApp behind another app, second user calls and hangs up
- **When** checked: first-time macOS permission question; notification text; lock screen text; Call back; clicking the body; then Do Not Disturb on and again with notifications refused
- **Then** all as in the ACs; with notifications off there is no error and the chat has the "Missed call" note

### Mini call window

### TC-F16-29: Mini window show and hide rules
- **Covers:** AC-F16-14
- **Level:** unit
- **Given** reports with `call` phase lobby, calling, in-call and reconnecting
- **When** focus changes between MeetApp and another app
- **Then** the mini window is wanted for every phase while no MeetApp window is in front (within 1 s, 150 ms wait included) and hidden when one comes to the front; it is wanted with no `call` never

### TC-F16-30: Mini window in a real call, lobby and calling
- **Covers:** AC-F16-14, AC-F16-26
- **Level:** desktop e2e (skip on Linux CI)
- **Given** M2 in a meeting; M1 "Calling"; M3 waiting in the lobby
- **When** each minimizes the main window
- **Then** the mini window shows within 1 s with Leave or Cancel in the lobby and calling states, is not focused, and hides when the main window is restored

### TC-F16-31: Mini window content
- **Covers:** AC-F16-15
- **Level:** ui
- **Given** `MiniCallWindow` with speaker video, speaker camera off, sharing, lobby and calling states
- **When** rendered
- **Then** it shows the speaker's video or picture or initials or shared screen, name, call name, timer, people count, and buttons mute, camera, share, raise hand, Leave, back to the call (label text matches state)

### TC-F16-32: Report builder (web)
- **Covers:** AC-F16-15, AC-F16-18
- **Level:** unit
- **Given** call states: lobby, calling, in-call, reconnecting, sharing, camera off, `canUnmute` false, none
- **When** the report is built
- **Then** the `call` object has the right phase, speaker, flags and `joinedAt`; none gives `call: null`; reports are sent at most every 200 ms, ring changes immediately

### TC-F16-33: Live frames start and stop (web)
- **Covers:** AC-F16-15
- **Level:** unit
- **Given** a fake MessagePort and canvas
- **When** the mini window opens, the speaker changes, the camera turns off, then the window hides
- **Then** JPEG frames go at about 15/s at 320x180; none when the speaker has no video; sending stops when hidden

### TC-F16-34: Live video in the real mini window
- **Covers:** AC-F16-15
- **Level:** desktop e2e (skip on Linux CI)
- **Given** M1 and M2 in a call with fake cameras; M2 minimized
- **When** the mini window shows
- **Then** its `<img>` gets new `blob:` sources over time; when M1's camera is off it shows M1's initials

### TC-F16-35: Buttons do the same as the call screen
- **Covers:** AC-F16-16
- **Level:** unit
- **Given** a reported call
- **When** `toggleMic`, `toggleCamera`, `toggleHand`, `leave` arrive (and `canUnmute:false` with `toggleMic`)
- **Then** the main window runs the same handlers as its own buttons; the unmute is refused when `canUnmute` is false

### TC-F16-36: Mini buttons change the call, both ways in 1 s
- **Covers:** AC-F16-16
- **Level:** desktop e2e
- **Given** M2 in a call, minimized, mini window showing; M1 in the call
- **When** M2 presses mute, camera, hand in the mini window; then toggles them in the call screen; and the organizer mutes M2 so M2 can't unmute
- **Then** M1 sees each change, both windows show the same state within 1 s, and the mini unmute does nothing while forced mute

### TC-F16-37: Share screen opens MeetApp's own picker
- **Covers:** AC-F16-17
- **Level:** desktop e2e (skip on Linux CI)
- **Given** the mini window showing
- **When** **share** is pressed
- **Then** the main window comes to the front and F02's share picker opens; nothing is shared until a choice is made there

### TC-F16-38: Share action brings the main window forward first (unit)
- **Covers:** AC-F16-17
- **Level:** unit
- **Given** a reported call
- **When** `share` arrives
- **Then** main shows and focuses the main window, then forwards the action

### TC-F16-39: Reconnecting, ending, removal
- **Covers:** AC-F16-18
- **Level:** unit
- **Given** the mini window showing
- **When** phase becomes reconnecting; then back; then the call ends, the person leaves, is removed, and reconnecting gives up (four runs)
- **Then** the mini window shows "Reconnecting…" while reconnecting and closes (call becomes null) in the other four cases; the removal message is only sent to the main window, which comes to the front

### TC-F16-40: Leave and removal in real windows
- **Covers:** AC-F16-18
- **Level:** desktop e2e
- **Given** M2 in a call, minimized, mini window showing
- **When** M2 presses **Leave**; separately the organizer removes M2
- **Then** the mini window closes; after removal the main window is in front with "You were removed from the meeting"

### Moving and remembering

### TC-F16-41: Remembered places per kind
- **Covers:** AC-F16-19
- **Level:** unit
- **Given** a drag end for a ring window, then for the mini window
- **When** each shows again
- **Then** each uses its own place; stacked rings start at the ring place in the AC-08 order; the file `call-windows.json` holds both places; no account data

### TC-F16-42: Place kept after restart
- **Covers:** AC-F16-19
- **Level:** desktop e2e (skip on Linux CI)
- **Given** a ring window dragged to a new spot
- **When** the app is restarted and rung again
- **Then** the ring window appears at that spot; same check for the mini window

### TC-F16-43: Off-screen fallback
- **Covers:** AC-F16-20
- **Level:** unit
- **Given** remembered places on a screen that is removed, or outside after a resolution change, or partly visible
- **When** the window shows, and when `display-removed` / `display-metrics-changed` fires while it shows
- **Then** a fully-gone place goes to the bottom-right of the main screen (16 px); a place inside a work area is kept; a shown window is moved on the event

### Several MeetApp windows

### TC-F16-44: Merging reports from several windows
- **Covers:** AC-F16-24
- **Level:** unit
- **Given** two main windows reporting the same ring, the same call and the same missed entry
- **When** merged
- **Then** one ring window per `callId`, one mini window, one notification per `callId`; actions go to the window used last; accepting focuses that window

### TC-F16-45: Two windows, one set of small windows (real windows)
- **Covers:** AC-F16-24
- **Level:** desktop e2e
- **Given** M2 with two main windows (both minimized)
- **When** M1 calls M2, M2 accepts
- **Then** exactly one ring window and later one mini window; the window used last is brought to the front

### Over other apps

### TC-F16-46: Window flags for full-screen and all Spaces
- **Covers:** AC-F16-26
- **Level:** unit
- **Given** fake `BrowserWindow`
- **When** the ring and mini windows are created
- **Then** `alwaysOnTop` level `pop-up-menu`, `setVisibleOnAllWorkspaces(true, {visibleOnFullScreen:true})`, `skipTaskbar`, frameless, fixed sizes (ring 320x160, 320x212 with the busy line; mini 320x256)

### TC-F16-47: Over a full-screen app by hand
- **Covers:** AC-F16-26
- **Level:** manual (owner's Mac)
- **Given** a full-screen app and a second Mac Space
- **When** a call rings, and during a call
- **Then** the ring and mini windows show over the full-screen app and on the Space in use

### Accessibility and language

### TC-F16-48: Names, announcements, keyboard, Escape
- **Covers:** AC-F16-21
- **Level:** ui
- **Given** `RingWindow` and `MiniCallWindow`
- **When** tested with Testing Library and axe
- **Then** every button has an accessible name; the ring window has a live announcement "Incoming video call from <name>"; Tab reaches every button, Enter and Space press it, focus is visible; Escape in the ring window declines; no axe violations

### TC-F16-49: Translations
- **Covers:** AC-F16-21
- **Level:** unit
- **Given** all texts of both windows and the notification
- **When** the translation check runs and the app is set to a second language
- **Then** every text comes from translation keys (none hard-coded), all keys exist in all languages, and the notification text uses them too

### TC-F16-50: Keyboard and Escape in the real ring window
- **Covers:** AC-F16-21
- **Level:** desktop e2e
- **Given** a ring window showing (focused by clicking it)
- **When** Tab, Enter on a button; and Escape on another ring
- **Then** Tab moves between buttons and Enter presses; Escape declines

### Security and privacy

### TC-F16-51: Locked-down window settings
- **Covers:** AC-F16-22
- **Level:** security
- **Given** the options used to create each small window (unit) and the real windows (e2e)
- **When** inspected
- **Then** `contextIsolation` true, `sandbox` true, `nodeIntegration` false, partition `call-windows`, the call-window preload only; in the page `require`, `process` and `window.meetapp` are undefined; only `meetappCallWindow` with `onState`, `act`, `onFrame` exists (no auth, media, files, deviceKey)

### TC-F16-52: Own session refuses everything
- **Covers:** AC-F16-22
- **Level:** security
- **Given** the `call-windows` session
- **When** the page asks for camera, microphone, display media, any permission, a device, or a download
- **Then** all are refused

### TC-F16-53: CSP of the small windows
- **Covers:** AC-F16-22
- **Level:** security
- **Given** responses for `call-window.html` from the app protocol and the dev-server hook
- **When** headers are read
- **Then** `connect-src 'none'`, `img-src 'self' data: blob:`, and the rest as S17; a `fetch` to any address from the page fails

### TC-F16-54: No navigation, no new windows, no token
- **Covers:** AC-F16-22
- **Level:** security (desktop e2e)
- **Given** a ring window and a mini window
- **When** the page tries `location = "https://example.com"`, `window.open`, a link click, and reading cookies, localStorage and auth state
- **Then** all blocked or empty; no new window; no sign-in token present

### TC-F16-55: Action allow-list and sender check
- **Covers:** AC-F16-22, AC-F16-03, AC-F16-16
- **Level:** security
- **Given** a shown ring `c1` and a reported call
- **When** the small window sends unknown action names, wrong argument types, extra fields, `accept` for an unknown or ended `callId`, call actions with no reported call, `openChat`/`callBack` (main-only), and a message from a non-small window on `meetapp:call-window`
- **Then** each is refused and nothing is forwarded; `meetapp:call-windows` `report` from a small window is refused too

### TC-F16-56: Content protection on the small windows
- **Covers:** AC-F16-25
- **Level:** unit and desktop e2e (skip on Linux CI)
- **Given** the real ring and mini windows
- **When** created
- **Then** `setContentProtection(true)` was called (unit) (the e2e checks the windows are on top; the capture itself is the hand check TC-F16-57). On Linux, hiding the small windows from shares is later (design.md 3.8)

### TC-F16-57: Not in the screen share, by hand
- **Covers:** AC-F16-25
- **Level:** manual (owner's Mac)
- **Given** a ring window and a mini window showing
- **When** sharing the whole screen with MeetApp's own share and recording with one other capture app
- **Then** neither window appears in either capture

### TC-F16-58: Notification and windows show no hidden data
- **Covers:** AC-F16-23
- **Level:** security
- **Given** a message with text "secret-text" in the chat, a call in a chat the person left, a call for a chat they may not see (F15 rules), and a caller with a script-like name `<img src=x onerror=alert(1)>`
- **When** reports, notifications and windows are produced
- **Then** no message text anywhere; no ring or notification for calls the person may not see; the hostile name shows as plain text and runs nothing; the photo arrives as a `data:` picture only

### TC-F16-59: No new server data, logs without names
- **Covers:** AC-F16-22, AC-F16-23
- **Level:** security
- **Given** the whole flow run with a spy on network and log output
- **When** rings, mini window and notifications happen
- **Then** the small windows make no network request; no new backend call exists; logs contain no names; the only new file is `userData/call-windows.json`

### Edge cases

### TC-F16-60: Crash or reload drops the report
- **Covers:** AC-F16-06, AC-F16-18
- **Level:** unit
- **Given** a main window with a ring and a call shown in small windows
- **When** `render-process-gone` or `did-start-loading` fires
- **Then** its report is dropped and its small windows close; after reload and a new report they come back as the rules say

### TC-F16-61: Focus flicker
- **Covers:** AC-F16-01, AC-F16-14
- **Level:** unit
- **Given** a fake clock
- **When** focus leaves MeetApp and returns within 150 ms, then stays away 150 ms
- **Then** no window in the first case; windows show in the second

## Coverage table

| AC | Test cases |
|----|-----------|
| AC-F16-01 | TC-F16-01, 02, 03, 61 |
| AC-F16-02 | TC-F16-04 |
| AC-F16-03 | TC-F16-05, 06, 07, 55 |
| AC-F16-04 | TC-F16-08, 09, 10 |
| AC-F16-05 | TC-F16-01, 11 |
| AC-F16-06 | TC-F16-12, 13, 60 |
| AC-F16-07 | TC-F16-06, 14, 15 |
| AC-F16-08 | TC-F16-16, 17, 19 |
| AC-F16-09 | TC-F16-18, 19 |
| AC-F16-10 | TC-F16-20, 21, 28 |
| AC-F16-11 | TC-F16-23, 24, 25, 28 |
| AC-F16-12 | TC-F16-21, 22 |
| AC-F16-13 | TC-F16-26, 28 |
| AC-F16-13b | TC-F16-27, 28 |
| AC-F16-14 | TC-F16-29, 30, 61 |
| AC-F16-15 | TC-F16-31, 32, 33, 34 |
| AC-F16-16 | TC-F16-35, 36, 55 |
| AC-F16-17 | TC-F16-37, 38 |
| AC-F16-18 | TC-F16-32, 39, 40, 60 |
| AC-F16-19 | TC-F16-41, 42 |
| AC-F16-20 | TC-F16-43 |
| AC-F16-21 | TC-F16-48, 49, 50 |
| AC-F16-22 | TC-F16-51, 52, 53, 54, 55, 59 |
| AC-F16-23 | TC-F16-20, 28, 58, 59 |
| AC-F16-24 | TC-F16-44, 45 |
| AC-F16-25 | TC-F16-56, 57 |
| AC-F16-26 | TC-F16-03, 30, 46, 47 |

## Cases added after the first verification (2026-11-02)
| Case | What | Where |
|---|---|---|
| TC-F16-62 | Live pictures keep coming with MeetApp minimized (≥10 different in 2 s) | call-windows.spec.ts (TC-F16-34) |
| TC-F16-63 | Fresh reports while the call screen redraws all the time | use-call-windows.test.tsx (TC-F16-32) |
| TC-F16-64 | The mini window's memory stays within 10 % over 3 minutes of live video | call-windows.spec.ts (T-fix-2) |
| TC-F16-65 | The small session serves only its page and `/assets/`; saved places validated, written owner-only (0600) | call-windows-security.test.ts (T-fix-3) |
| TC-F16-66 | Reports checked entry by entry; long names shortened | call-windows-security.test.ts, report.test.ts (T-fix-4) |
| TC-F16-68 | Caller hangs up before anyone answers: the ring stop is marked as a missed call and gives a notification; removal while ringing isn't marked and gives none (AC-F16-10, 12; D081) | use-call-windows.test.tsx, ring.integration.test.ts, call-security.integration.test.ts (T-fix-8) |
| TC-F16-69 | Many rings never overlap (a second column); a drag always ends; only PNG, JPEG or WebP photos | call-windows.test.ts, call-windows-security.test.ts (T-fix-9) |
| TC-F16-70 | A main window keeps full speed behind other apps only while it has a call (battery); live pictures still flow (TC-F16-62) | call-windows-controller.test.ts, call-windows.spec.ts (T-fix-10) |
| TC-F16-67 | Notifications kept until used; a closed small window is reopened; timer margin; stack clear of the mini window | call-windows-notify.test.ts, call-windows-controller.test.ts, call-windows.test.ts (T-fix-4) |
