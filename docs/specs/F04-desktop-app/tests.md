---
feature: F04
title: Desktop app
status: approved
updated: 2026-11-03
---

# F04 Desktop app: Test Cases

Written **before** the code. Each test case becomes an automated test, except those marked manual.
Levels: unit, ui (component + Storybook, screenshots at verification), integration, security, desktop e2e (real Electron windows, Playwright), performance, manual.

Test names must include the TC and AC IDs, e.g. `TC-F04-12 [AC-F04-02] a second start brings the running window to the front`.

**Set-up (design.md "Test approach"):**
- Rules without Electron (`app-life`, `links`, `window-state`, notice rules, card layout, `system-quiet` interface, updater switch) are pure and unit-tested with fakes (fake screens, clock, `Notification`, `BrowserWindow`, system-quiet).
- API tests run against the real database and Redis (integration). The delayed job for status expiry uses a fake clock or short delay.
- Desktop e2e uses 2 or 3 Electron windows (F02/F15/F16 style), each with its own profile, fake camera and microphone. "Not in front" = main window hidden, minimized or another app focused. Links are sent by the test as `second-instance`, `open-url` (Mac) or `argv` (Windows).
- **Platforms (AC-61):** automatic tests run on the owner's Mac; the Windows run is nightly on GitHub's computers. Cases marked "(Windows too)" run there. Cases marked manual are done by hand and written in `docs/progress.md`.
- **T1 spike (before the notice and login-item tasks):** TC-F04-80 to TC-F04-82 are checks done by hand during T1. Their result decides D086 (how AC-37 is built) and the Mac login-start fallback.
- The F02, F14, F15 and F16 suites must keep passing (F16's missed-call test, AC-F04-35, runs unchanged).

## Test cases

### Installing

### TC-F04-01: Both installers build in CI
- **Covers:** AC-F04-01, AC-F04-60
- **Level:** integration
- **Given** the CI build job
- **When** electron-builder runs for Mac (`dmg`, universal) and Windows (`nsis`, x64 and arm64)
- **Then** the `.dmg` and the `.exe` files exist, carry the app id `app.meetapp.desktop` and the name and icons from `app-identity.ts`, and the `meetapp` link scheme is registered in both

### TC-F04-02: Install, open, and get past the unsigned warning (Mac)
- **Covers:** AC-F04-01, AC-F04-61
- **Level:** manual
- **Given** a clean Mac and the `.dmg`
- **When** the owner drags MeetApp to Applications and opens it, following "Install the app" in `docs/getting-started.md` word for word
- **Then** the system warns once, the guide's steps get past it, and MeetApp starts from Applications; the second start gives no warning

### TC-F04-03: Install, open, and get past the unsigned warning (Windows)
- **Covers:** AC-F04-01, AC-F04-61, AC-F04-60
- **Level:** manual
- **Given** a Windows computer and the `.exe`
- **When** the person runs it, then "More info" and "Run anyway" as the guide says, and starts MeetApp from the Start menu
- **Then** MeetApp is installed, starts, and the guide's words match what the screen showed

### TC-F04-04: The getting-started guide has the install steps
- **Covers:** AC-F04-01
- **Level:** unit
- **Given** `docs/getting-started.md`
- **When** a docs check reads it
- **Then** an "Install the app" section exists and names the Mac warning and the Windows "Windows protected your PC" step

### TC-F04-05: Signing is only settings
- **Covers:** AC-F04-03
- **Level:** integration
- **Given** a throwaway certificate set through the signing environment variables (`CSC_LINK`, password)
- **When** the CI test build runs with and without them
- **Then** the build with them is signed (verified by the platform's check), the one without is unsigned, and `git diff` of app code between the two runs is empty; only `electron-builder.config.ts` reads the variables

### One copy

### TC-F04-06: A second start brings the running window forward
- **Covers:** AC-F04-02
- **Level:** desktop e2e (Windows too)
- **Given** MeetApp running with its window minimized
- **When** the same packaged profile is started again
- **Then** no second process stays alive, the first window is shown and focused

### TC-F04-07: Separate profiles don't block each other
- **Covers:** AC-F04-02
- **Level:** desktop e2e
- **Given** two MeetApp copies with different profile folders (`pnpm dev:window` style)
- **When** both start
- **Then** both run side by side; the lock is per profile folder

### Closing, tray and quit

### TC-F04-08: Closing the last window hides it and MeetApp keeps running
- **Covers:** AC-F04-04
- **Level:** unit
- **Given** the `app-life` rules, `quitting` false
- **When** a window `close` happens (✕, ⌘W / Ctrl+W)
- **Then** the close is prevented, the window is hidden, `app.quit` is not called, the tray icon stays

### TC-F04-09: Close hides, live line and ring keep working
- **Covers:** AC-F04-04, AC-F04-07
- **Level:** desktop e2e (Windows too)
- **Given** M2 signed in; M2's window closed with ✕
- **When** M1 sends a chat message, then M1 calls M2
- **Then** M2's process and tray stay alive, the message is received (unread count rises), and the ring window shows

### TC-F04-10: First-close card appears once, with the right words per system
- **Covers:** AC-F04-04, AC-F04-60
- **Level:** desktop e2e
- **Given** a fresh profile (`app-state.json` has no "first close seen")
- **When** the window is closed, shown again, and closed again
- **Then** one corner card says "MeetApp is still running. You'll find it in the menu bar." (Windows: "…in the taskbar's notification area."), only the first time; `app-state.json` records it

### TC-F04-11: Tray menu signed in and signed out
- **Covers:** AC-F04-05, AC-F04-60
- **Level:** unit
- **Given** the tray menu builder with signed-in and signed-out state
- **When** the menu is built
- **Then** signed in: Open MeetApp, status choices, Settings, Quit MeetApp; signed out: Open MeetApp, Sign in, Quit; Mac uses a template image, Windows left-click opens the window and right-click the menu

### TC-F04-12: Tray menu items act
- **Covers:** AC-F04-05
- **Level:** desktop e2e
- **Given** a signed-in app with the window hidden
- **When** the tests click Open MeetApp, Settings, and a status choice in the tray menu
- **Then** the window shows, opens Settings, and the status changes to the chosen one ("until changed")

### TC-F04-13: Sign in from the tray when signed out
- **Covers:** AC-F04-05, AC-F04-08
- **Level:** desktop e2e
- **Given** a started app with no stored sign-in
- **When** the tray's Sign in is chosen
- **Then** the window shows the sign-in screen

### TC-F04-14: Quit stops everything when not in a call
- **Covers:** AC-F04-06
- **Level:** desktop e2e (Windows too)
- **Given** a signed-in app, no call
- **When** Quit is chosen from the tray, then again from the MeetApp menu, then ⌘Q / Ctrl+Q (separate runs)
- **Then** each time the process ends with no question and the tray icon disappears

### TC-F04-15: Quit during a call asks first
- **Covers:** AC-F04-06
- **Level:** desktop e2e
- **Given** M2 in a call with M1
- **When** M2 chooses Quit
- **Then** a dialog says "Quit MeetApp? You'll leave the call."; Cancel keeps the call and the app; Quit leaves the call cleanly (M1 sees M2 leave) and stops the app

### TC-F04-16: Windows quit path
- **Covers:** AC-F04-06, AC-F04-60
- **Level:** manual
- **Given** MeetApp on Windows
- **When** the person presses Alt+F4 on the last window, then chooses Quit from the tray
- **Then** the first only hides the window; the second stops MeetApp

### TC-F04-17: Shutdown and logout never wait for a question
- **Covers:** AC-F04-06
- **Level:** unit
- **Given** the `app-life` rules, a call running
- **When** the system sends `shutdown` (Mac) or `query-session-end` / `session-end` (Windows)
- **Then** `quitting` becomes true, no dialog is shown, the call is left cleanly, and the quit goes ahead

### TC-F04-18: Ring with no window open, Video opens the call within 3 s
- **Covers:** AC-F04-07
- **Level:** desktop e2e (Windows too)
- **Given** M2's window closed (hidden), M2 not in a call
- **When** M1 calls M2 and M2 presses Video on the ring window
- **Then** a MeetApp window shows straight in the call, within 3 s; same with Audio

### Start at login

### TC-F04-19: Login item rules
- **Covers:** AC-F04-08, AC-F04-09
- **Level:** unit
- **Given** a fake Electron `app` and an `app-state.json`
- **When** the first start after install, a later start (update), and the switch off and on happen
- **Then** first start sets `openAtLogin: true` with `args: ["--hidden"]` once and records the flag; later starts leave the stored choice alone; off sets `openAtLogin: false`; on sets it true again

### TC-F04-20: A hidden start shows no window
- **Covers:** AC-F04-08
- **Level:** desktop e2e
- **Given** a profile with a stored sign-in
- **When** MeetApp is started with `--hidden`
- **Then** no window is visible, the tray icon exists, the live line is connected (signed in as before), and Open MeetApp shows the chat list

### TC-F04-21: Hidden start with no or expired sign-in
- **Covers:** AC-F04-08
- **Level:** desktop e2e
- **Given** one profile with no sign-in and one with an expired one
- **When** each is started with `--hidden`
- **Then** neither shows a window, both have the tray menu with Sign in

### TC-F04-22: Settings → General start-at-login switch
- **Covers:** AC-F04-09
- **Level:** desktop e2e
- **Given** Settings → General
- **When** the switch is turned off, the app restarted, then turned on
- **Then** the switch shows the real state each time and the login item calls match (fake login-item store in the test build)

### TC-F04-23: Login really starts MeetApp hidden (Mac and Windows)
- **Covers:** AC-F04-08, AC-F04-09, AC-F04-61
- **Level:** manual
- **Given** MeetApp installed in Applications (Mac) or by the installer (Windows), start at login on
- **When** the person logs out and in again; then turns the switch off and repeats
- **Then** on: MeetApp is in the menu bar or tray with no window; off: it doesn't start. An update keeps the choice (check after installing a newer build)

### Meeting links

### TC-F04-24: Strict link reading
- **Covers:** AC-F04-10, AC-F04-11
- **Level:** unit
- **Given** `links.ts`
- **When** it reads `meetapp://m/<good code>`, upper/lower case scheme, a trailing slash, and many bad inputs: wrong code shape, extra path (`/m/abc/x`), query or fragment, user info (`meetapp://u@m/abc`), a port, `meetapp://x/abc`, `meetapp://m/`, `https://...`, `javascript:`, a very long string, control characters, encoded slashes and `..`
- **Then** only an exact good link returns `{code}`; every other input returns "ignore" (front only); nothing throws

### TC-F04-25: Link opens the pre-join screen (running app)
- **Covers:** AC-F04-10
- **Level:** desktop e2e (Windows too)
- **Given** M2 signed in, window hidden or minimized, and a real meeting from M1
- **When** the test sends the link as `second-instance` (Windows) and as `open-url` (Mac)
- **Then** M2's window shows at that meeting's pre-join screen within 3 s; nothing is joined (M1 sees no new participant)

### TC-F04-26: Link that starts MeetApp
- **Covers:** AC-F04-10
- **Level:** desktop e2e
- **Given** MeetApp not running
- **When** it is started with the link in `process.argv` (Windows), and with `open-url` sent before the app is ready (Mac)
- **Then** after sign-in loads, the pre-join screen of that meeting shows; the link is not lost

### TC-F04-27: Link while signed out
- **Covers:** AC-F04-10
- **Level:** desktop e2e
- **Given** MeetApp running, signed out
- **When** a valid link arrives, then the person signs in (second run: stays a guest)
- **Then** the link is kept; after sign-in the pre-join screen opens; as a guest the guest join screen shows the meeting's title (AC-F02-08)

### TC-F04-28: Link while in a call
- **Covers:** AC-F04-10
- **Level:** desktop e2e
- **Given** M2 in a call
- **When** a link to another meeting arrives
- **Then** the pre-join screen says joining leaves the current call; the call goes on until M2 clicks Join

### TC-F04-29: Wrong, unknown or expired link shows F02's messages
- **Covers:** AC-F04-11
- **Level:** desktop e2e
- **Given** a link with a well-shaped but unknown code, one with an expired code, and a malformed one
- **When** each arrives
- **Then** unknown and expired show the same messages as typing them under Join a meeting; malformed only brings MeetApp to the front and shows nothing new

### TC-F04-30: A link never joins, sends or changes anything, security
- **Covers:** AC-F04-11
- **Level:** security
- **Given** M2 signed in, a meeting with a passcode, and a lobby
- **When** many links arrive: good, repeated 20 times, with extra text, with a `?join=1` query, and a link to a meeting where M2 is not allowed
- **Then** no request to join, send, admit or change anything leaves the app (server log and request recording show none); the server still checks the code with S5 limits

### TC-F04-31: Other `meetapp://` addresses are ignored, security
- **Covers:** AC-F04-11
- **Level:** security
- **Given** running MeetApp
- **When** `meetapp://settings`, `meetapp://call/<id>`, `meetapp://m/<code>/../admin`, `meetapp://m/<code>?x=<script>` and a 10 000 character link arrive
- **Then** MeetApp only comes to the front; no navigation, no setting, no call is started; the page never receives the raw text

### TC-F04-32: Link from Mail
- **Covers:** AC-F04-10, AC-F04-61
- **Level:** manual
- **Given** MeetApp installed (Mac), then once on Windows
- **When** the person clicks a `meetapp://m/<code>` link in Mail, a browser page or a calendar
- **Then** MeetApp opens or comes to the front at that meeting's pre-join screen, whether it was running, hidden or closed

### TC-F04-33: Copy link gives the clickable link
- **Covers:** AC-F04-12
- **Level:** unit
- **Given** the F02 copy-link function and a meeting
- **When** Copy link is used
- **Then** the text holds `meetapp://m/<code>` (built from the scheme in `app-identity.ts`), plus the meeting ID and passcode as before; the code matches the shared link's code

### TC-F04-34: Copied link opens the same meeting
- **Covers:** AC-F04-12, AC-F04-10
- **Level:** desktop e2e
- **Given** M1 copies the link of a meeting
- **When** the copied text is sent to M2 as a link event
- **Then** M2 lands on that meeting's pre-join screen

### Status set by hand

### TC-F04-35: Set a status
- **Covers:** AC-F04-20
- **Level:** integration
- **Given** a signed-in user
- **When** `PUT /api/v1/me/status` is called with each of `available`, `busy`, `dnd`, `brb`, `away`, then with `null`
- **Then** 200 with `{status, until}` each time; Reset clears both `manual_status` and `manual_status_until`; the stored values match

### TC-F04-36: Others see the status within 5 s
- **Covers:** AC-F04-20
- **Level:** integration
- **Given** user B connected on the live line and sharing a chat with A
- **When** A sets Busy
- **Then** B receives a `status` message with `busy` within 5 s, and B's people list/chat read shows it; an older client ignores the new values without error

### TC-F04-37: Picture menu and tray menu offer the choices
- **Covers:** AC-F04-20, AC-F04-21
- **Level:** ui
- **Given** `StatusMenu` in both forms
- **When** rendered
- **Then** the picture menu lists Available, Busy, Do not disturb, Be right back, Appear away, Reset status, and "for how long" (30 minutes, 1 hour, 2 hours, Today, This week, Until I change it); the tray form has the same statuses with no duration; keyboard and screen-reader labels are present

### TC-F04-38: Duration maths in the person's time zone
- **Covers:** AC-F04-21
- **Level:** unit
- **Given** a fake clock and time zones (a +5, a -8, a daylight-saving change day), including Sunday itself
- **When** the app works out `until` for 30 minutes, 1 hour, 2 hours, Today, This week, until changed
- **Then** minutes and hours add exactly; Today = 23:59:59 local; This week = Sunday 23:59:59 local (this Sunday, not next, when today is Sunday); until changed = null; all sent as ISO times

### TC-F04-39: Status runs out and goes back to automatic
- **Covers:** AC-F04-21
- **Level:** integration
- **Given** a status set for a short time with a fake clock
- **When** the time passes
- **Then** the delayed job clears it and announces the change on the live line; others see the automatic status

### TC-F04-40: Expired status is never shown even if the job is lost
- **Covers:** AC-F04-21
- **Level:** integration
- **Given** `manual_status_until` in the past and Redis jobs flushed
- **When** presence is read (chat list, people list)
- **Then** the automatic status is returned, not the old manual one

### TC-F04-41: Bad status input is refused
- **Covers:** AC-F04-20, AC-F04-21
- **Level:** security
- **Given** a signed-in user
- **When** they send an unknown status, `until` in the past, `until` more than 8 days ahead, a non-date string, a number, extra keys, an `until` with `status: null` set to a future time
- **Then** 400 each time and the stored status is unchanged

### TC-F04-42: Presence rule order
- **Covers:** AC-F04-23, AC-F04-20
- **Level:** unit
- **Given** the presence function
- **When** it gets combinations: hand-set Busy/DND/BRB/Away unexpired; in a call; hand-set Available unexpired; idle; expired hand-set
- **Then** the order is: unexpired hand-set Busy/DND/BRB/Away, then "In a call", then hand-set Available, then automatic; a hand-set Available stays Available when idle; expired values are ignored

### TC-F04-43: In a call shows "In a call" unless set by hand
- **Covers:** AC-F04-23
- **Level:** desktop e2e
- **Given** M1 and M2 with M2 having no hand-set status, then another run with Busy set
- **When** M2 joins a call
- **Then** M1 sees "In a call" in the first run and "Busy" in the second; after the call the first returns to automatic

### TC-F04-44: Status menu in the app sets and resets
- **Covers:** AC-F04-20, AC-F04-21
- **Level:** desktop e2e
- **Given** M2's window
- **When** M2 picks Do not disturb for 30 minutes from the picture menu, then Reset status
- **Then** M1 sees Do not disturb within 5 s, then the automatic status within 5 s

### Do not disturb

### TC-F04-45: Do not disturb silences cards, unread still counts
- **Covers:** AC-F04-22
- **Level:** desktop e2e
- **Given** M2 set to Do not disturb and the chat not in front
- **When** M1 sends a message, an @mention of M2, and M2 is the organizer with a guest in the lobby
- **Then** no card shows for any of them, the unread count rises, the lobby list shows the guest when M2 looks

### TC-F04-46: Calls still ring and missed calls are noted under Do not disturb
- **Covers:** AC-F04-22
- **Level:** desktop e2e
- **Given** M2 on Do not disturb, window hidden
- **When** M1 calls M2, M2 lets it ring out
- **Then** the ring window showed; after it ended the missed call is noted in the chat and F16's Mac notification rule (fake Notification) is called as before

### TC-F04-47: Do not disturb is checked on the server's value, not the screen
- **Covers:** AC-F04-22
- **Level:** unit
- **Given** the notice rules and status values
- **When** the status is dnd, busy, brb, away, available, and a status that expired a second ago
- **Then** only unexpired `dnd` silences message, mention and lobby cards; the others do not

### Notification cards

### TC-F04-48: Card window rules
- **Covers:** AC-F04-30
- **Level:** unit
- **Given** F16's controller with the new "notice" kind and fake screens
- **When** cards are placed with 0 to 5 cards, ring windows and the mini window present, and cards added and removed
- **Then** cards sit bottom-right stacked, never over rings or the mini window; at most 3 at once and the oldest goes when a fourth comes; created with `showInactive()`, always on top, never `focus()`

### TC-F04-49: Card timing
- **Covers:** AC-F04-30
- **Level:** unit
- **Given** a fake clock and a shown card
- **When** 8 s pass; the pointer enters at 5 s and leaves at 20 s; × is clicked
- **Then** it closes at 8 s when the pointer was never on it; with the pointer on it, the timer pauses and it closes 8 s after leaving; × closes at once

### TC-F04-50: Card is above other apps without taking the keyboard
- **Covers:** AC-F04-30
- **Level:** desktop e2e (skip on Linux CI, Windows too)
- **Given** another (non-MeetApp) window focused and typing
- **When** a card shows
- **Then** it is visible and always-on-top, `isFocused()` is false, and the other window keeps the keyboard

### TC-F04-51: NoticeCard look
- **Covers:** AC-F04-30, AC-F04-31, AC-F04-33, AC-F04-34
- **Level:** ui
- **Given** `NoticeCard` stories: message (with and without photo), "mentioned you", lobby (one person, guest, "n people are waiting"), "still running", "n new messages", long names
- **When** rendered
- **Then** each shows its words, ×, and the right buttons (Admit and View lobby only on lobby); long names and text are cut; contrast and keyboard checks pass; screenshots match

### TC-F04-52: Message card content
- **Covers:** AC-F04-31
- **Level:** unit
- **Given** the notice rules, a new message from B in chat C not in front, not muted
- **When** a 300-character message arrives; then a short one; then preview off
- **Then** the card has B's picture and name, chat C's name, the first 100 characters, and sound; with preview off the text is "New message"

### TC-F04-53: Message card skip rules
- **Covers:** AC-F04-31
- **Level:** unit
- **Given** the notice rules
- **When** the message is: the person's own; in the chat shown in a front window; in a muted chat without a mention; with chat messages switched off; older than 5 minutes by the server's clock offset (computer clock set wrong in the test)
- **Then** no card in any case; a message from a chat that is only open in a hidden or minimized window still shows a card

### TC-F04-54: Message card, click, end to end
- **Covers:** AC-F04-31, AC-F04-30
- **Level:** desktop e2e (Windows too)
- **Given** M2 viewing chat X; M1 messages M2 in chat Y
- **When** M1's message arrives, M2 clicks the card
- **Then** a card shows picture, name, chat and text; clicking it opens chat Y in M2's window and closes the card; a message in chat X shows no card

### TC-F04-55: Preview off hides the text everywhere
- **Covers:** AC-F04-31, AC-F04-36
- **Level:** desktop e2e
- **Given** M2 with "Show message preview" off
- **When** M1 sends a message, a mention and (merged) two more messages
- **Then** every card says "New message" (the mention card says "mentioned you" without the text), and the card's page content and window title carry none of the message text

### TC-F04-56: Several messages merge into one card
- **Covers:** AC-F04-32
- **Level:** unit
- **Given** a card for chat Y still showing
- **When** 2, then 3, more messages arrive in Y, and one in chat Z
- **Then** the Y card becomes "<n> new messages" with the latest sender and the sound plays once for the group; Z gets its own card; after the Y card closed a new message makes a new card with a sound

### TC-F04-57: Merged card, end to end
- **Covers:** AC-F04-32
- **Level:** desktop e2e
- **Given** M2 not viewing chat Y
- **When** M1 sends 3 messages quickly
- **Then** M2 sees one card saying "3 new messages", and the chime was requested once

### TC-F04-58: Mention card, even in a muted chat
- **Covers:** AC-F04-33
- **Level:** unit
- **Given** a muted chat; a mention of the person; mentions on, then mentions off
- **When** the message arrives
- **Then** with mentions on: one "mentioned you" card and no plain message card; with mentions off: no mention card (and no plain card either; a mention is not turned into a message card); someone else's mention gives none

### TC-F04-59: Mention card, end to end
- **Covers:** AC-F04-33
- **Level:** desktop e2e
- **Given** M2 muted the chat
- **When** M1 @mentions M2 there
- **Then** exactly one card marked "mentioned you" shows; a normal message in the same muted chat shows none

### TC-F04-60: Lobby card for those who can admit
- **Covers:** AC-F04-34
- **Level:** unit
- **Given** the lobby rules with roles organizer, presenter, attendee, and a meeting that is / is not the window in front
- **When** a person joins the lobby
- **Then** organizer and presenter get "<name> is waiting in the lobby" with Admit and View lobby (guest: typed name marked "Guest"); attendees get nothing; no card when that meeting is the window in front; lobby switch off gives nothing

### TC-F04-61: Lobby grouping
- **Covers:** AC-F04-34
- **Level:** unit
- **Given** a lobby card showing
- **When** a second, then a third and fourth person join, and one is admitted leaving two
- **Then** one and two give separate cards (within the 3-card limit); three or more become one card "<n> people are waiting" with View lobby only; the count follows the list

### TC-F04-62: Admit from the card
- **Covers:** AC-F04-34
- **Level:** desktop e2e
- **Given** M2 organizer in the meeting with the window behind other apps; guest G waiting
- **When** M2 clicks Admit on the card
- **Then** G enters the meeting, M2's window did not come to the front, the card closes; View lobby instead brings the window to the lobby list

### TC-F04-63: Admit from a card uses the server's rights, security
- **Covers:** AC-F04-34
- **Level:** security
- **Given** a meeting; M2 was organizer but is now demoted to attendee (or removed); an old card with Admit is still showing
- **When** Admit is clicked
- **Then** F02's admit request is refused (403), G stays out, and the card shows nothing misleading; a user who never was a presenter gets no card, and calling the same admit request directly is also refused

### TC-F04-64: Missed calls unchanged
- **Covers:** AC-F04-35
- **Level:** integration
- **Given** F16's missed-call tests
- **When** the suite runs after F04's changes
- **Then** it passes unchanged, and no corner card is created for a missed call (F04 adds none)

### Notification settings

### TC-F04-65: Settings read, save and defaults
- **Covers:** AC-F04-36
- **Level:** integration
- **Given** a new user and an existing one
- **When** `GET /api/v1/me/notification-settings`, then `PUT` with one key, then several, then `GET` again, from a second login
- **Then** all five (`messages`, `mentions`, `lobby`, `sound`, `preview`) are true by default; partial updates change only the keys sent; values follow the account to another session

### TC-F04-66: Settings input checks and limits, security
- **Covers:** AC-F04-36
- **Level:** security
- **Given** a signed-in user and a signed-out caller
- **When** unknown keys, non-boolean values, an empty body, and 25 PUTs in a minute are sent; and a PUT with another user's id in body or path
- **Then** 400 for bad input, 401 signed out, 429 after 20 a minute; only the caller's own row is ever read or changed

### TC-F04-67: Settings → Notifications page applies at once
- **Covers:** AC-F04-36
- **Level:** desktop e2e
- **Given** Settings → Notifications on M2
- **When** each of the five switches is turned off (one at a time), and M1 triggers the matching event
- **Then** messages off: no message card; mentions off: no mention card; lobby off: no lobby card; sound off: cards show with no chime; preview off: "New message"; no restart needed; reload keeps the choices

### TC-F04-68: Settings can't be loaded, defaults apply
- **Covers:** AC-F04-36
- **Level:** unit
- **Given** the settings fetch fails
- **When** a message arrives
- **Then** the defaults (all on) are used, a retry is scheduled, and the real values are applied when the fetch works

### TC-F04-69: Settings migration only adds columns
- **Covers:** AC-F04-20, AC-F04-36
- **Level:** integration
- **Given** a database with existing users
- **When** the F04 migration runs, and its undo
- **Then** only columns are added (`manual_status`, `manual_status_until`, five `notify_*` defaulting to true); old users keep all data; export includes the new fields and account removal deletes them

### Focus and Do Not Disturb of the computer

### TC-F04-70: System quiet silences cards
- **Covers:** AC-F04-37
- **Level:** unit
- **Given** a fake `system-quiet` interface
- **When** it reports on, then off, then "unknown"
- **Then** on: no message, mention or lobby cards; off: cards show; unknown (no helper, error): cards show and the error is logged once; the "still running" card is not a message card and is not silenced by it

### TC-F04-71: System quiet, end to end with the fake (deferred with AC-37, D086)
- **Covers:** AC-F04-37, AC-F04-60
- **Level:** desktop e2e
- **Given** the test build with the fake system-quiet set to on
- **When** M1 messages, mentions M2 and joins M2's lobby
- **Then** no cards show; unread counts rise; with it set off the same events give cards

### TC-F04-72: Real Focus / Do not disturb
- **Covers:** AC-F04-37, AC-F04-60, AC-F04-61
- **Level:** manual
- **Given** the T1 helper chosen, on the owner's Mac and once on Windows
- **When** Focus / Do Not Disturb is switched on, a message arrives; then switched off
- **Then** on: no card; off: a card. If T1 showed no reliable helper, the owner's decision (D086) is recorded and this case is replaced accordingly

### After sleep

### TC-F04-73: Reconnect after sleep within 10 s
- **Covers:** AC-F04-38
- **Level:** desktop e2e
- **Given** M2 connected; the test sends `powerMonitor` `resume` after the server dropped M2's connection
- **When** `resume` fires
- **Then** the live line is back within 10 s and unread counts match the server

### TC-F04-74: Reconnect after the network returns within 10 s
- **Covers:** AC-F04-38
- **Level:** desktop e2e
- **Given** M2's network blocked for 60 s (the retry wait has grown)
- **When** the network returns (page `online` event)
- **Then** the live line is back within 10 s; the retry wait never goes over 8 s in the desktop app

### TC-F04-75: No cards for old messages after catch-up
- **Covers:** AC-F04-38
- **Level:** desktop e2e
- **Given** M2 offline while M1 sent 4 messages 10 minutes ago and 1 message just now (and missed a call)
- **When** M2 reconnects
- **Then** unread counts and the missed-call note catch up; only the new message may give a card; at most 3 cards in any case

### Window and running smoothly

### TC-F04-76: Window state rules
- **Covers:** AC-F04-40
- **Level:** unit
- **Given** `window-state.ts` with fake screens and a fake clock
- **When** the window moves/resizes (writes only 500 ms after it stops), maximized state, a screen that is gone, the file missing, the file corrupt or with huge/negative/NaN values, and a window larger than the screen
- **Then** `{x, y, width, height, maximized, displayId}` is saved; read-back is checked against the screens; any bad or off-screen value opens it centred on the main screen at a safe size; nothing throws

### TC-F04-77: Window comes back where it was
- **Covers:** AC-F04-40
- **Level:** desktop e2e (Windows too)
- **Given** a window moved and resized
- **When** it is hidden and shown, then MeetApp is restarted
- **Then** the same size and place both times (within 1 px); with the saved screen made unavailable (fake screens) it is centred on the main screen

### TC-F04-78: Start-up under 3 s
- **Covers:** AC-F04-41
- **Level:** performance
- **Given** a signed-in profile, a packaged build, the owner's Mac, nothing else heavy running
- **When** the app is started 5 times (double-click equivalent, no `--hidden`)
- **Then** the time from `process.getCreationTime` to the chat list's first paint is under 3 s in each run (median reported); hidden login starts are not counted

### TC-F04-79: A call runs on with the window hidden
- **Covers:** AC-F04-42
- **Level:** performance
- **Given** M1 and M2 in a call with fake devices; M2's window first behind other apps, then minimized, then closed (hidden), each phase for 10 minutes (or one 10-minute run cycling through them)
- **When** audio and video flow
- **Then** M2's received and sent audio have no gap over 500 ms, and M1 keeps receiving M2's video frames the whole time (frame count keeps rising)

### T1 spike checks (by hand, before building)

### TC-F04-80: System quiet helper works on Mac, universal build (done in T1: result in D086; AC-37 deferred)
- **Covers:** AC-F04-37, AC-F04-60
- **Level:** manual
- **Given** the candidate helper package (vetted with `add-dependency`) in a universal Mac build (arm64 and x64) on the owner's Mac
- **When** Focus / Do Not Disturb is toggled on and off several times, including a Focus with a schedule and a Focus with allowed apps
- **Then** the helper reports the right state each time, loads in both architectures, and does not crash the app when it cannot read. The result is written into D086

### TC-F04-81: System quiet helper works on Windows (x64 and arm64) (done in T1: result in D086; AC-37 deferred)
- **Covers:** AC-F04-37, AC-F04-60
- **Level:** manual
- **Given** the same helper in the Windows x64 and arm64 builds
- **When** Windows Do not disturb / Focus assist is toggled, and a full-screen app or presentation is running
- **Then** the state is read right, or the limits are written into D086; the native part loads in the packaged `.exe` on both builds

### TC-F04-82: Hidden login start on macOS 13 and newer
- **Covers:** AC-F04-08
- **Level:** manual
- **Given** MeetApp installed in Applications on macOS 13 or newer
- **When** the login item is set and the person logs in; checked whether `wasOpenedAtLogin` / `args` arrive
- **Then** MeetApp starts hidden. If they do not arrive, the 60-second fallback (no link, no window wanted, shortly after login) starts it hidden, and the choice is recorded in the design

### Updates

### TC-F04-83: Updater is switched off
- **Covers:** AC-F04-50
- **Level:** unit
- **Given** `updates.ts` with the build setting `updates.enabled = false` and a fake `electron-updater`
- **When** the app starts and runs for a while, and the person opens About
- **Then** the updater is never asked to check and no request to GitHub is made; with the setting true (test only) it asks once

### TC-F04-84: About page
- **Covers:** AC-F04-50
- **Level:** desktop e2e
- **Given** Settings → About
- **When** it is opened
- **Then** it shows the real app version and "Updates are turned off"

### Mac and Windows

### TC-F04-85: Words and keys per system
- **Covers:** AC-F04-60
- **Level:** unit
- **Given** the platform words (menu bar / notification area, ⌘ / Ctrl, Focus / Do not disturb)
- **When** each is asked for with platform Mac and Windows
- **Then** the right words and shortcuts come back, and the first-close card, tray labels, and Settings text use them

### TC-F04-86: Desktop tests run on Windows in CI
- **Covers:** AC-F04-60, AC-F04-61
- **Level:** integration
- **Given** the GitHub workflow
- **When** the nightly Windows job runs
- **Then** it runs every desktop case marked "Windows too" (ring and mini windows, corner cards, close/quit, links, window state) and fails the check when one fails; the Mac-only case is the Mac missed-call notification

### TC-F04-87: Tray and cards on Windows
- **Covers:** AC-F04-60, AC-F04-61
- **Level:** manual
- **Given** MeetApp on Windows, once
- **When** the person closes the window, uses the tray (left-click, right-click), and receives a message card and a lobby card
- **Then** the app stays in the notification area, left-click opens the window, right-click shows the menu, and cards appear bottom-right above other apps

### Security and privacy

### TC-F04-88: Notice windows are locked down, security (S17)
- **Covers:** AC-F04-30
- **Level:** security
- **Given** a created notice card window
- **When** its settings are read
- **Then** it has `contextIsolation`, `sandbox`, no Node, its own session, the strict CSP, only the notice preload, `webSecurity` on; navigation and new windows are blocked; no remote content loads; it can't open DevTools in production

### TC-F04-89: Card input is checked by main, security
- **Covers:** AC-F04-30, AC-F04-31
- **Level:** security
- **Given** `window.meetapp.notices.show(card)` and the Zod schema
- **When** a card has an unknown kind, extra keys, text of 5 000 characters, a name of 500, HTML/script text, a photo that isn't PNG/JPEG/WebP, a photo over 400 KB, a `javascript:` or `file:` photo address, an action not belonging to the card's kind, and 50 cards in a second from one window
- **Then** bad cards are refused; text is cut to 100 and names to 80 and shown only as plain text (HTML is never run); photos pass F16's rules; at most 10 cards a second are accepted and the rest are dropped; the app does not crash

### TC-F04-90: Only MeetApp's own windows can act on cards, security
- **Covers:** AC-F04-30, AC-F04-34
- **Level:** security
- **Given** a card showing and another window (a call page, or a window with a different origin)
- **When** the other window sends a card, a click, or an Admit action, or a card sends an action for another window's card
- **Then** main ignores it: only the main window that created the card may send it, and a click goes back only to that window

### TC-F04-91: A card shows only what the person may see, security
- **Covers:** AC-F04-31, AC-F04-33, AC-F04-34
- **Level:** security
- **Given** user A not a member of chat Y; a private meeting A is not part of; A left chat Y a minute ago
- **When** messages arrive in Y, the lobby of that meeting fills, and a mention names A in a chat A can't read
- **Then** A gets no card and no text from them (the server never sends it on the live line); a removed member gets none after leaving

### TC-F04-92: Status and settings endpoints act only on the signed-in person, security
- **Covers:** AC-F04-20, AC-F04-36
- **Level:** security
- **Given** users A and B; one signed-out caller
- **When** the signed-out caller calls the status and settings endpoints; A sends B's id in the path, body and query; a token of A is used on B's data; 25 status calls in a minute
- **Then** 401 for signed out; the server uses only the token's user and ignores any id sent; B's data never changes or shows; 429 after 20 a minute, with a retry hint

### TC-F04-93: No new secrets on disk, security
- **Covers:** AC-F04-08, AC-F04-40
- **Level:** security
- **Given** a profile after login start, window moves, status and settings changes, a link and a card
- **When** `userData` (`window-state.json`, `app-state.json`, `call-windows.json`, logs, login-item data) is searched for tokens, passwords, message text, meeting passcodes and link codes
- **Then** none are found; the sign-in key is only in the system keychain; the files hold only the sizes, places and flags listed in the design

### TC-F04-94: Card text and logs carry no message content, security
- **Covers:** AC-F04-31
- **Level:** security
- **Given** the app logs and crash reports during a run with messages, mentions and lobby events
- **When** the logs are searched
- **Then** no message text, names beyond ids, or photos appear in the log lines

### TC-F04-95: Sign-out stops notices
- **Covers:** AC-F04-31, AC-F04-34
- **Level:** desktop e2e
- **Given** cards showing and the tray menu with status choices
- **When** the person signs out, and M1 then sends a message
- **Then** the cards close, no new card shows, and the tray shows Sign in

## Coverage

| Acceptance criterion | Test cases |
|---|---|
| AC-F04-01 | TC-F04-01, 02, 03, 04 |
| AC-F04-02 | TC-F04-06, 07 |
| AC-F04-03 | TC-F04-05 |
| AC-F04-04 | TC-F04-08, 09, 10 |
| AC-F04-05 | TC-F04-11, 12, 13 |
| AC-F04-06 | TC-F04-14, 15, 16, 17 |
| AC-F04-07 | TC-F04-09, 18 |
| AC-F04-08 | TC-F04-13, 19, 20, 21, 23, 82, 93 |
| AC-F04-09 | TC-F04-19, 22, 23 |
| AC-F04-10 | TC-F04-24, 25, 26, 27, 28, 32, 34 |
| AC-F04-11 | TC-F04-24, 29, 30, 31 |
| AC-F04-12 | TC-F04-33, 34 |
| AC-F04-20 | TC-F04-35, 36, 37, 41, 42, 44, 69, 92 |
| AC-F04-21 | TC-F04-37, 38, 39, 40, 41, 44 |
| AC-F04-22 | TC-F04-45, 46, 47 |
| AC-F04-23 | TC-F04-42, 43 |
| AC-F04-30 | TC-F04-48, 49, 50, 51, 54, 88, 89, 90 |
| AC-F04-31 | TC-F04-51, 52, 53, 54, 55, 89, 91, 94, 95 |
| AC-F04-32 | TC-F04-56, 57 |
| AC-F04-33 | TC-F04-51, 58, 59, 91 |
| AC-F04-34 | TC-F04-51, 60, 61, 62, 63, 90, 91, 95 |
| AC-F04-35 | TC-F04-64 |
| AC-F04-36 | TC-F04-55, 65, 66, 67, 68, 69, 92 |
| AC-F04-37 | TC-F04-70, 71, 72, 80, 81 |
| AC-F04-38 | TC-F04-73, 74, 75 |
| AC-F04-40 | TC-F04-76, 77, 93 |
| AC-F04-41 | TC-F04-78 |
| AC-F04-42 | TC-F04-79 |
| AC-F04-50 | TC-F04-83, 84 |
| AC-F04-60 | TC-F04-01, 03, 10, 11, 16, 71, 72, 80, 81, 85, 86, 87 |
| AC-F04-61 | TC-F04-02, 03, 23, 32, 72, 86, 87 |

No acceptance criterion is left uncovered. Security rules covered: S17 (TC-88, 90), card input checks (TC-89), strict links (TC-24, 30, 31), endpoint rights and rate limits (TC-41, 63, 66, 92), no new secrets on disk (TC-93), preview privacy (TC-55, 94).
