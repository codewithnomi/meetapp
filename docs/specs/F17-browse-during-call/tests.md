---
feature: F17
title: Browse during a call
status: approved
updated: 2026-11-14
---

# F17 Browse during a call: Test Cases

Written **before** the code. Each test case becomes an automated test.
Levels: unit, component (React, Vitest), integration, e2e (real Electron windows, Playwright), screenshot (component pictures at verification), security, performance.

Test names must include the TC and AC IDs, e.g. `TC-F17-08 [AC-F17-03] the call page is the same instance after browsing`.

**Set-up:**
- Nothing new on the server, so there are no API tests. TC-F17-48 proves that.
- Unit and component tests use fakes for the call store, the router, the clock and the desktop bridge. File locations: `apps/web/src/app/*.test.tsx`, `apps/web/src/features/calls/*.test.ts(x)`, `packages/ui/src/organisms/SmallCallView/*`.
- Desktop e2e uses 2 or 3 Electron windows (F02/F15/F16 style), each with its own profile, fake camera and microphone. Files: `apps/desktop/e2e/f17-*.spec.ts`. "Not in front" = main window hidden, minimized or another app focused. Links are sent as in F04 tests (`second-instance`, `open-url`, `argv`).
- The F02, F04, F15 and F16 suites must keep passing. The F04 test for AC-F04-10 is changed for signed-in people (TC-F17-29) and stays for guests.

## Test cases

### Leaving the call screen without leaving the call

### TC-F17-01: Browsing does not disturb the call
- **Covers:** AC-F17-01
- **Level:** e2e
- **File:** `tests/e2e/desktop/browse.spec.ts`
- **Given** two people in a meeting, A and B, B watching A's video and sound
- **When** A clicks Chat in the left menu and stays there 5 seconds
- **Then** B still sees A's video, hears A's sound, A's mute state is unchanged, and B's screen never shows "left" or "joined" for A

### TC-F17-02: Every menu item keeps the call
- **Covers:** AC-F17-01
- **Level:** e2e
- **File:** `tests/e2e/desktop/browse.spec.ts`
- **Given** A in a meeting (also once in a chat call)
- **When** A opens, one after the other, Home, Chat, Meetings, People, Requests, Workspace settings, Settings, and the picture's menu entries
- **Then** each screen opens, the small call view shows on each, and the call never drops

### TC-F17-03: Small call view shows the right things
- **Covers:** AC-F17-02
- **Level:** unit
- **File:** `packages/ui/src/organisms/SmallCallView/SmallCallView.test.tsx`
- **Given** the view with a speaker name, video slot, title and elapsed time
- **When** it renders, then again with the camera off, then with a shared screen
- **Then** it shows the name, call name and time; video, or picture or initials when the camera is off, or the shared screen; and has mute, camera and Leave, but no share, raise hand or people count

### TC-F17-04: "You're sharing"
- **Covers:** AC-F17-02
- **Level:** unit
- **File:** `packages/ui/src/organisms/SmallCallView/SmallCallView.test.tsx`
- **Given** the sharing flag is on
- **When** the view renders
- **Then** it says "You're sharing"; with the flag off it does not

### TC-F17-05: Not allowed to unmute
- **Covers:** AC-F17-02
- **Level:** unit
- **File:** `packages/ui/src/organisms/SmallCallView/SmallCallView.test.tsx`
- **Given** the organizer turned an attendee's microphone off (mic not allowed)
- **When** the view renders and the attendee presses the mute button
- **Then** the button is disabled and no callback runs

### TC-F17-06: Shortcuts work on other screens
- **Covers:** AC-F17-02
- **Level:** e2e
- **File:** `tests/e2e/desktop/browse.spec.ts`
- **Given** A in a call, on the Chat screen
- **When** A presses the mute shortcut, then the camera shortcut
- **Then** the other window sees A muted, then camera off, and the small call view shows both states

### TC-F17-07: Small call view position
- **Covers:** AC-F17-02, AC-F17-21
- **Level:** component
- **File:** `packages/ui/src/templates/AppLayout/AppLayout.test.tsx`
- **Given** `AppLayout` with `reserveCorner` on, and the host with the small view
- **When** it renders
- **Then** the view is fixed bottom right (300 px wide, 16 px from the edges), is not inside the left menu area, and the content area has bottom padding of the view's height + 16 px; with it off there is no padding

### TC-F17-08: The call page survives navigation
- **Covers:** AC-F17-03
- **Level:** component
- **File:** `apps/web/src/app/CallHost.test.tsx`
- **Given** the host showing the call page with the people panel open
- **When** the route changes to `/chat` and back to `/meeting/call`
- **Then** it is the same page instance (not remounted), the panel is still open, and while on `/chat` the wrapper is `hidden` and `inert`

### TC-F17-09: Back to the full call within 1 second
- **Covers:** AC-F17-03
- **Level:** e2e
- **File:** `tests/e2e/desktop/browse.spec.ts`
- **Given** A browsing on Chat during a call, with chat panel open and a screen shared on the full call
- **When** A clicks the video in the small view, and again later the Go back label
- **Then** the full call shows within 1 second, in the same layout, with the same panel open and the shared screen still shared

### TC-F17-10: Small view buttons act like the full call
- **Covers:** AC-F17-04
- **Level:** e2e
- **File:** `tests/e2e/desktop/browse.spec.ts`
- **Given** A browsing on Chat during a call, with the F16 mini window available
- **When** A presses mute in the small view
- **Then** within 1 second the full call, the small view and the mini window all show muted, and the other window sees A muted

### TC-F17-11: Camera button from the small view
- **Covers:** AC-F17-04
- **Level:** e2e
- **File:** `tests/e2e/desktop/browse.spec.ts`
- **Given** A browsing during a call
- **When** A turns the camera off and on in the small view
- **Then** the full call and the other window follow within 1 second each time

### TC-F17-12: Leave for a member
- **Covers:** AC-F17-05
- **Level:** unit
- **File:** `apps/web/src/features/call-windows/small-call-view.test.tsx`
- **Given** `leaveChoices` is false
- **When** Leave is pressed
- **Then** `controls.leave` runs once and the full call is not shown

### TC-F17-13: Leave for an organizer
- **Covers:** AC-F17-05
- **Level:** unit
- **File:** `apps/web/src/features/call-windows/small-call-view.test.tsx`
- **Given** `leaveChoices` is true (organizer or co-organizer)
- **When** Leave is pressed
- **Then** the full call shows (where Leave has "End meeting for everyone") and `controls.leave` does not run

### TC-F17-14: Leave from Chat stays on Chat
- **Covers:** AC-F17-05
- **Level:** e2e
- **File:** `tests/e2e/desktop/browse.spec.ts`
- **Given** an attendee browsing on Chat during a meeting
- **When** they press Leave in the small view
- **Then** the other window shows them leaving, the small view closes, and the attendee is still on Chat

### TC-F17-15: Call ends while browsing
- **Covers:** AC-F17-06
- **Level:** component
- **File:** `apps/web/src/app/CallHost.test.tsx`
- **Given** the host hidden (person on Meetings) and a call in progress
- **When** the call reports "removed", then in another run "ended", then "lost"
- **Then** the outcome goes into the outcome store, the host becomes inactive, a banner with the full call's message shows at the top of the current screen, the route does not change, and Rejoin shows only when a rejoin is possible (same rule as `EndedRoute`); × closes the banner

### TC-F17-16: Reconnecting state
- **Covers:** AC-F17-06, AC-F17-18
- **Level:** unit
- **File:** `packages/ui/src/organisms/SmallCallView/SmallCallView.test.tsx`
- **Given** state `in_call`
- **When** the state changes to `reconnecting`
- **Then** "Reconnecting…" shows, and the polite live region announces it

### TC-F17-17: Removed while browsing
- **Covers:** AC-F17-06
- **Level:** e2e
- **File:** `tests/e2e/desktop/browse.spec.ts`
- **Given** attendee A browsing on People, the organizer in the other window
- **When** the organizer removes A
- **Then** the small view closes, "You were removed from the meeting" shows as a banner on People, and A stays on People

### TC-F17-18: Lobby and "Calling…" while browsing
- **Covers:** AC-F17-07
- **Level:** e2e
- **File:** `tests/e2e/desktop/browse.spec.ts`
- **Given** A waiting in a lobby, and in a second run A calling someone from a chat
- **When** A opens Meetings, then the organizer lets A in (or the other side answers)
- **Then** the small view first shows the waiting or "Calling…" state with Leave or Cancel, then shows the call; A stays on Meetings and is not moved to the call screen

### TC-F17-19: Small view states
- **Covers:** AC-F17-07
- **Level:** unit
- **File:** `packages/ui/src/organisms/SmallCallView/SmallCallView.test.tsx`
- **Given** each state `lobby`, `calling`, `connecting`, `in_call`
- **When** it renders
- **Then** lobby shows Leave, calling shows Cancel, and in_call shows mute, camera and Leave

### TC-F17-20: Page callbacks only move the screen when the call is full
- **Covers:** AC-F17-05, AC-F17-06, AC-F17-07
- **Level:** component
- **File:** `apps/web/src/app/CallHost.test.tsx`
- **Given** the host in full mode, then hidden
- **When** `onAdmitted`, `onBackToChat`, `onLeft` and `onOutcome` fire
- **Then** full: go to `/meeting/call`, `/chat`, home, `/meeting/ended`; hidden: the route never changes

### Where the call shows in the app

### TC-F17-21: useCurrentCall
- **Covers:** AC-F17-08
- **Level:** unit
- **File:** `apps/web/src/features/calls/current-call.test.ts`
- **Given** a meeting visit, a lobby visit, a chat call, and no call
- **When** the hook is read
- **Then** it returns kind, ids, title and `fullPath` (`/meeting/call`, `/meeting/lobby`, `/call`), and nothing when there is no call

### TC-F17-22: Marks in the chat list and Meetings
- **Covers:** AC-F17-08
- **Level:** component
- **File:** `apps/web/src/pages/ChatsPage/chat-entries.test.ts`, `apps/web/src/pages/MeetingsPage/MeetingsPage.test.tsx`
- **Given** the person is in a chat call, then in a meeting that has a chat
- **When** the chat list and Meetings screen render
- **Then** the call's chat row says "Call in progress"; Meetings shows "You're in <title>" with Go back (Meetings lists no upcoming meetings to mark yet, F13), and Go back navigates to `fullPath`

### TC-F17-23: Leave-first rule
- **Covers:** AC-F17-09
- **Level:** unit
- **File:** `apps/web/src/features/calls/useLeaveFirst.test.ts`
- **Given** an active call and a next action
- **When** the person confirms, in other runs cancels, and in another the host never becomes inactive
- **Then** confirm: leave runs, then the action runs after the host is inactive; cancel: nothing changes; no leave within 5 s: "Couldn't leave the call. Try again." shows and the action never runs; buttons are disabled while leaving; with no active call the action runs at once with no dialog

### TC-F17-24: Meet now during a call
- **Covers:** AC-F17-09
- **Level:** e2e
- **File:** `tests/e2e/desktop/switch.spec.ts`
- **Given** A in a call
- **When** A presses Meet now and chooses Cancel, then presses it again and chooses Leave call and start
- **Then** the dialog says "You're in <name>. Starting this leaves it."; Cancel changes nothing; Leave leaves the call first, then starts the new meeting

### TC-F17-25: Call button and "started a call" Join
- **Covers:** AC-F17-09
- **Level:** e2e
- **File:** `tests/e2e/desktop/switch.spec.ts`
- **Given** A in a meeting, a chat with a call button, and a chat with a "started a call" note
- **When** A presses the call button, then Join on the note, and confirms
- **Then** each asks first (with "Leave call and start" and "Leave call and join"), leaves the current call, and then starts or joins

### TC-F17-26: Ring during a call
- **Covers:** AC-F17-10
- **Level:** e2e
- **File:** `tests/e2e/desktop/switch.spec.ts`
- **Given** A in a call and browsing Chat
- **When** B calls A from a chat
- **Then** the incoming call card shows as in F15; accepting leaves the current call and joins the chat call; also works with A on Meetings

### Another meeting during a call

### TC-F17-27: Link during a call opens the pre-join
- **Covers:** AC-F17-11
- **Level:** e2e
- **File:** `tests/e2e/desktop/switch.spec.ts`
- **Given** signed-in A in call X, MeetApp behind other apps
- **When** a `meetapp://` link for meeting Y arrives
- **Then** within 3 seconds MeetApp is in front and shows Y's pre-join with "You're in <X>. Joining this meeting leaves it."; the small view shows X and X's call continues

### TC-F17-28: Link during lobby or "Calling…"
- **Covers:** AC-F17-11
- **Level:** e2e
- **File:** `tests/e2e/desktop/switch.spec.ts`
- **Given** A waiting in a lobby, and in another run A in "Calling…"
- **When** a link, a meeting row in Meetings, and Join with an ID are used for meeting Y
- **Then** the pre-join of Y shows within 3 s; Leave call and join leaves the lobby or cancels the call, then joins Y

### TC-F17-29: Links no longer wait for signed-in people
- **Covers:** AC-F17-11
- **Level:** unit
- **File:** `apps/web/src/app/desktop-commands.test.ts`
- **Given** signed-in people on `/meeting/call`, `/meeting/lobby` and `/call`
- **When** a meeting link command arrives
- **Then** Meetings opens with the code at once (not held back); the old "waits until Meetings" test for AC-F04-10 is replaced for signed-in people

### TC-F17-30: Camera preview shares the camera
- **Covers:** AC-F17-11
- **Level:** e2e
- **File:** `tests/e2e/desktop/switch.spec.ts`
- **Given** A in a call with camera on, then opens the pre-join of Y
- **When** the preview starts, and in a second run the preview is made to fail
- **Then** run 1: the preview shows and the call's video continues to the other window; run 2: "Camera in use by your current call" shows and the camera choice still applies on joining

### TC-F17-31: Leave call and join
- **Covers:** AC-F17-12
- **Level:** e2e
- **File:** `tests/e2e/desktop/switch.spec.ts`
- **Given** the pre-join of Y during call X, camera off and microphone muted chosen
- **When** A presses Leave call and join
- **Then** A leaves X (the other window sees it), joins Y with camera off and microphone muted

### TC-F17-32: Cancel the pre-join
- **Covers:** AC-F17-12
- **Level:** e2e
- **File:** `tests/e2e/desktop/switch.spec.ts`
- **Given** A on Chat, then opened the pre-join of Y during call X
- **When** A presses Cancel
- **Then** Chat shows again and X was never interrupted (the other window sees no leave or join)

### TC-F17-33: Link to the same meeting
- **Covers:** AC-F17-13
- **Level:** unit
- **File:** `apps/web/src/features/calls/PreJoinRoute.test.tsx`
- **Given** the visit's meeting is X
- **When** the pre-join route opens for X (and for Y in a second case)
- **Then** X: navigates to `fullPath`, no pre-join shown; Y: pre-join shows with the note and "Leave call and join"

### The F16 windows

### TC-F17-34: Mini window while MeetApp is behind
- **Covers:** AC-F17-14
- **Level:** e2e
- **File:** `tests/e2e/desktop/windows.spec.ts`
- **Given** A browsing on Chat during a call
- **When** another app is brought to the front, then MeetApp is brought back
- **Then** the mini call window shows while behind, hides when MeetApp returns, and A sees Chat with the small view

### TC-F17-35: Mini window "back to the call"
- **Covers:** AC-F17-14
- **Level:** e2e
- **File:** `tests/e2e/desktop/windows.spec.ts`
- **Given** A on Meetings, MeetApp behind, in a meeting and in a chat call (two runs)
- **When** A presses "back to the call" in the mini window
- **Then** the full call shows (`/meeting/call` or `/call` by `fullPath`)

### TC-F17-36: Window close keeps the call
- **Covers:** AC-F17-19
- **Level:** e2e
- **File:** `tests/e2e/desktop/windows.spec.ts`
- **Given** A browsing during a call
- **When** A closes the MeetApp window
- **Then** the call continues (the other window still sees and hears A), MeetApp stays in the menu bar, and the mini call window shows

### TC-F17-37: Several windows
- **Covers:** AC-F17-20
- **Level:** e2e
- **File:** `tests/e2e/desktop/windows.spec.ts`
- **Given** A has two MeetApp windows, one holding the call
- **When** both are on Chat
- **Then** only the window with the call shows the small view; the other shows only "Call in progress" and Go back, and Go back there does not start a second call

### Speed and stability

### TC-F17-38: 20 switches in a row
- **Covers:** AC-F17-15
- **Level:** performance
- **File:** `tests/e2e/desktop/performance.spec.ts`
- **Given** A and B in a call, B's received-audio counter (`totalSamplesReceived`) sampled every 100 ms
- **When** A switches between the full call and Chat 20 times
- **Then** each switch takes under 1 second, the call never drops, and the counter grows with no pause over 500 ms

### TC-F17-39: Small view at the smallest window
- **Covers:** AC-F17-21
- **Level:** e2e
- **File:** `tests/e2e/desktop/windows.spec.ts`
- **Given** the window at 800x600, A in a call
- **When** A opens Chat and Meetings (with many chats and meetings listed, scrolled to the end)
- **Then** the small view does not overlap the message box or Meetings' main button (boxes measured)

### Look and accessibility

### TC-F17-40: Small call view pictures
- **Covers:** AC-F17-17
- **Level:** screenshot
- **File:** `packages/ui/src/organisms/SmallCallView/SmallCallView.stories.tsx`
- **Given** the stories for every state (lobby, calling, connecting, in_call, reconnecting, sharing, camera off, not allowed to unmute), light and dark
- **When** `pnpm test:visual` runs
- **Then** the pictures match the saved ones, which were checked against the approved board

### TC-F17-41: Notes and marks pictures
- **Covers:** AC-F17-17
- **Level:** screenshot
- **File:** `packages/ui/src/**/*.stories.tsx` (pre-join note, outcome banner, "Call in progress", Go back, leave-first dialog)
- **Given** each new element in its story, light and dark
- **When** `pnpm test:visual` runs
- **Then** the pictures match the saved ones; only design-system tokens are used (the token check passes)

### TC-F17-42: Keyboard and names
- **Covers:** AC-F17-18
- **Level:** unit
- **File:** `packages/ui/src/organisms/SmallCallView/SmallCallView.test.tsx`
- **Given** the rendered view
- **When** checked with Testing Library and an accessibility check, and driven with Tab, Enter and Space
- **Then** it is a `region` with a label, every button has an accessible name, Tab reaches each, Enter and Space press each, focus shows, and there are no accessibility violations

### TC-F17-43: Translations
- **Covers:** AC-F17-18
- **Level:** unit
- **File:** `apps/web/src/features/calls/i18n.test.ts`
- **Given** the translation file and the new components
- **When** the lint and key check run, and components render with a test language
- **Then** every new text ("Call in progress", Go back, "You're sharing", "Reconnecting…", "Camera in use by your current call", the leave-first texts, "Couldn't leave the call. Try again.") comes from a key that exists, none is hard-coded

### TC-F17-44: Focus skips the hidden call
- **Covers:** AC-F17-18
- **Level:** unit
- **File:** `apps/web/src/app/focus.test.tsx`
- **Given** the call hidden in the host and the person moves to Chat
- **When** focus moves on the screen change
- **Then** focus goes to Chat's heading, never into the hidden call (`[data-call-host]`)

### TC-F17-45: Preview camera stops while hidden
- **Covers:** AC-F17-03, AC-F17-18
- **Level:** component
- **File:** `apps/web/src/app/CallHost.test.tsx`
- **Given** the person waiting in a lobby with the camera preview on
- **When** they open Meetings, then go back
- **Then** the preview stops while hidden (`previewOn` false) and restarts when shown; the screen announcement for the small view appears (polite live region)

### Security and privacy

### TC-F17-46: Sign out during a call, leaves first
- **Covers:** AC-F17-16
- **Level:** e2e
- **File:** `tests/e2e/desktop/switch.spec.ts`
- **Given** A browsing during a call, with the mini window available
- **When** A signs out from the picture's menu
- **Then** the other window sees A leave first, then A is signed out, and the small view and F16 windows are closed

### TC-F17-47: Sign out when leaving is slow
- **Covers:** AC-F17-16
- **Level:** security
- **File:** `apps/web/src/features/calls/useSignOutDuringCall.test.ts`
- **Given** `controls.leave` never finishes (fake clock)
- **When** the person signs out
- **Then** after 5 s "Couldn't leave the call. Try again." shows and the person is not signed out half-way (no open call without a session)

### TC-F17-48: Bad link during a call changes nothing
- **Covers:** AC-F17-11 (Security & privacy)
- **Level:** security
- **File:** `tests/e2e/desktop/security.spec.ts`
- **Given** A in a call and the F04 bad-link cases (wrong scheme, wrong host, bad code, over-long, script text)
- **When** each is sent as a link
- **Then** the same checks as AC-F04-11 refuse it, no pre-join opens, and the call and the small view are unchanged

### TC-F17-49: Guests keep the old rule
- **Covers:** AC-F17-11 (Security & privacy)
- **Level:** unit
- **File:** `apps/web/src/app/desktop-commands.test.ts`
- **Given** a guest (signed out) on the call screen
- **When** a meeting link arrives
- **Then** the link waits (`BUSY_SCREENS`) as in AC-F04-10 and the call screen stays; the guest has no host and no small view

### TC-F17-50: Nothing new to the server, nothing extra shown
- **Covers:** AC-F17-02, AC-F17-04 (Security & privacy)
- **Level:** integration
- **File:** `apps/web/src/app/CallHost.integration.test.tsx`
- **Given** a recorded list of network calls during a call
- **When** the person browses, uses the small view buttons and goes back
- **Then** only existing F02/F15 calls are made (no new endpoint), and the small view's texts and video are only those the full call shows (names, speaker video, title)

## Coverage
| Acceptance criterion | Test cases |
|---|---|
| AC-F17-01 | TC-F17-01, 02 |
| AC-F17-02 | TC-F17-03, 04, 05, 06, 07, 50 |
| AC-F17-03 | TC-F17-08, 09, 45 |
| AC-F17-04 | TC-F17-10, 11, 50 |
| AC-F17-05 | TC-F17-12, 13, 14, 20 |
| AC-F17-06 | TC-F17-15, 16, 17, 20 |
| AC-F17-07 | TC-F17-18, 19, 20 |
| AC-F17-08 | TC-F17-21, 22 |
| AC-F17-09 | TC-F17-23, 24, 25 |
| AC-F17-10 | TC-F17-26 |
| AC-F17-11 | TC-F17-27, 28, 29, 30, 48, 49 |
| AC-F17-12 | TC-F17-31, 32 |
| AC-F17-13 | TC-F17-33 |
| AC-F17-14 | TC-F17-34, 35 |
| AC-F17-15 | TC-F17-38 |
| AC-F17-16 | TC-F17-46, 47 |
| AC-F17-17 | TC-F17-40, 41 |
| AC-F17-18 | TC-F17-16, 42, 43, 44, 45 |
| AC-F17-19 | TC-F17-36 |
| AC-F17-20 | TC-F17-37 |
| AC-F17-21 | TC-F17-07, 39 |
