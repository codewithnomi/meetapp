---
feature: F16
title: Calls while MeetApp isn't in front
status: approved
updated: 2026-11-02
---

# F16 Calls while MeetApp isn't in front: Design (HOW)

## Summary (plain English)
The main MeetApp window stays in charge, as today. It is already connected to the call and the live line, it plays the ringtone and it holds the sign-in. F16 adds two kinds of **small extra windows** that the desktop app's main process opens: one **ring window** per incoming call and one **mini call window**. They show only what the main window tells them, and when a button is pressed they pass it back to the main window, which does the work exactly as if it had been pressed there. The small windows never talk to the internet and hold no sign-in.

The main process knows whether any MeetApp window is in front, so it decides when the small windows show or hide. It places them in the corner, stacks them and remembers where they were dragged. It also shows the **missed-call notification** through the Mac's own notification system. For the mini window's **live video**, the main window sends the speaker's picture to it about 15 times a second over a private direct line between the two windows.

**Note on notifications (D080):** since Electron 42, macOS shows notifications only for a **signed** app. Our development app is signed only "ad hoc" (on this Mac). Whether that is enough is checked in T1. If not, the missed-call notification can only be seen once real signing is set up (Apple Developer, $99 a year, already listed in infrastructure.md, decided with F04). Until then the app behaves as AC-F16-13 says: no error, and the "Missed call" note is in the chat.

## 1. What gets created
**Desktop (apps/desktop):**
- `src/main/call-windows.ts`: pure rules, no Electron. When each window shows or hides (in front or not, AC-01, 05, 14). Corner placement, stacking and gap closing (AC-08, 09). Remembered places and the off-screen fallback (AC-19, 20). Merging reports from several MeetApp windows into one ring per call, one mini window and one notification per call (AC-24).
- `src/main/call-windows-bridge.ts`: Electron wiring. Creates and destroys the small windows, tracks focus (`browser-window-focus` / `blur`, minimize, hide), keeps places in `userData/call-windows.json`, and shows notifications (`Notification`).
- `src/preload/call-window-preload.ts`: the small windows' only bridge, `window.meetappCallWindow`: `onState(listener)`, `act(action)` and `onFrame(listener)`. Nothing else: no auth, media, files or deviceKey.
- `src/preload/preload.ts`: the main window gains `window.meetapp.callWindows`: `report(state)`, `onAction(listener)` and `sendFrame(frame)`. This is the design change the desktop rules require for anything new in the preload.

**Screens (apps/web):**
- A second small page, `call-window.html` (its own Vite entry: `src/app/call-window-main.tsx` renders `pages/CallWindowPage`, which uses `features/call-windows`). It shows the ring window or the mini call window from the state it receives, using the same `@meetapp/ui` components and translations. It has no router, no sign-in and no API client.
- **Shared shapes** (`packages/contracts/src/call-windows.ts`, types only): the report, the view sent to a small window and the actions. The desktop app checks them with its own small validators, so no schema library is added to its preloads.
- `features/call-windows/`, in the main window: builds the `report` from the incoming calls (F15 `incoming-calls.ts`) and the current call (F02/F15 call state), carries out the actions that come back, and sends the speaker frames.

**UI (packages/ui):** organisms `RingWindow` and `MiniCallWindow`, each with a story and tests, drawn as on the approved canvas board. `RingWindow` reuses `IncomingCall`'s parts.

## 2. Screens and user flow (approved board "Calls while MeetApp isn't in front")
1. **The person is in another app and a call rings.** The main window rings as in F15, and `report` lists the ring. Main sees no MeetApp window in front, so it opens a ring window with `showInactive()`: the keyboard stays in the other app. It sits in the corner of the screen holding the MeetApp window used last.
   - Pressing **Video** or **Audio** sends the action; the main window accepts as in F15, comes to the front and opens the call.
   - **Decline** works as in F15.
   - **×** closes the window and silences the ringtone on this computer, while the main window keeps showing the call silently.
2. **Several calls ring.** Main stacks one window per call upwards from the remembered place, newest on top, above the mini call window if one shows. When one closes, the others move down.
3. **Nobody answers.** The ring ends as "missed". The main window reports it. If no MeetApp window was in front at that moment, main shows the notification "Missed call from Sara" (or "… in Release team") with **Call back**. Call back brings MeetApp to the front and starts the same kind of call; clicking the notification opens the chat.
4. **In a call, the person switches to another app.** Main opens the mini call window, also with `showInactive()`. It shows the speaker's live video (a picture when their camera is off, the screen when someone shares), name, call name, timer and people count, and the buttons from AC-15. A button press goes to the main window. **Back to the call** brings MeetApp to the front. When MeetApp comes to the front, the mini window hides.

## 3. How it works
### 3.1 The report from the main window (AC-02, 06, 07, 15, 16, 18)
Whenever its incoming calls or current call change, the main window sends one `CallWindowsState` (at most every 200 ms; immediately for ring changes):
- `rings`: `[{ callId, caller: { name, initials, photoUrl? }, kind: "video" | "audio", chatName?, busyIn?: string }]`. `busyIn` is the current call's or meeting's name (AC-07).
- `call`: `{ title, joinedAt, people, phase: "lobby" | "calling" | "in-call" | "reconnecting", speaker: { name, initials, hasVideo, sharing }, mic, camera, hand, canUnmute, canShare } | null`
- `missed`: `[{ callId, from, chatName?, kind, conversationId, endedAt }]` (rings that just ended as missed, once each). Answered, declined and cancelled rings never appear here (AC-12).

Rings come only from F15's `incoming-calls`, which already applies F15's rules on who may see a call (AC-23).

A photo reaches the small window as a `data:` picture prepared by the main window, so the small window never loads anything from the backend.

### 3.2 Actions back (AC-03, 04, 11, 16, 17)
`act` accepts only: `accept {callId, video}`, `decline {callId}`, `hide {callId}`, `toggleMic`, `toggleCamera`, `share`, `toggleHand`, `leave`, `backToCall`. Main checks each action against an allow-list (unknown names and wrong arguments are refused, as for the existing bridges). Ring actions are refused unless their `callId` is one it is showing. Call actions are refused unless a call is reported. It then forwards the action to the right main window and brings that window to the front when needed (accept, share, backToCall). The main window runs the same code its own buttons run, so F02 rights (`canUnmute`) and F15 rules apply unchanged. `share` brings the main window to the front first, so F02's own picker opens there (AC-17).

### 3.3 Showing and hiding (AC-01, 05, 06, 14, 18, 24, 26)
Main recomputes after every report and every focus change. "In front" means some MeetApp main window is focused.
- **Ring windows:** one per `callId` found in any main window's report, shown only while none is in front. A ring disappears from the reports when it ends, so its window closes on the next report (within 2 s, AC-06).
- **Mini window:** shown while any main window reports a `call` and none is in front.

Several main windows report the same call; main keeps one window per call and sends actions to the window used last (AC-24). Small windows are created with:
- `alwaysOnTop` at level `pop-up-menu`, so they sit above the Dock and other apps;
- `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`, so they show over full-screen apps and on the Space in use (AC-26);
- `skipTaskbar`, a frameless body and a fixed size that fits the drawn content (ring 320×160, or 320×212 with the busy line, drawn more compact than the in-app card at the owner's request, 2026-11-02; mini 320×256), and a see-through window behind the rounded card (`transparent`).

### 3.4 Places (AC-19, 20)
Each kind keeps one place: `{ ring: {x, y, displayId}, mini: {x, y, displayId} }` in `call-windows.json`, written after a drag ends. On show, the place is used if it still lies inside a connected screen's work area. Otherwise the window goes to the bottom-right corner of the main screen, 16 px from the edges. The mini window sits at its place; ring windows stack upwards from theirs with an 8 px gap and never overlap the mini window. When they would, the stack starts above it.

### 3.5 Live video in the mini window (AC-15, owner's choice)
When the mini window opens, main creates a `MessageChannelMain` and gives one end to the main window and the other to the mini window. The main window draws the speaker's video, or the shared screen, into a 320×180 canvas about 15 times a second. It sends each picture as a JPEG `ArrayBuffer`, about 10–15 KB, so about 200 KB/s that never leaves the computer. The mini window shows it in an `<img>` through a `blob:` address. Sending stops while the mini window is hidden. When the speaker has no video, no pictures are sent and the mini window shows their picture or initials. This keeps the mini window free of the call server and of any sign-in.

### 3.6 Ringtone (AC-04, 05)
The ringtone keeps playing in the main window, as in F15, so a ring window closing or opening never breaks it (AC-05). **×** sends `hide`, and the main window then silences that ring's tone (F15's existing mute-per-ring). Several rings play one tone (AC-08), as F15 already does. When `busyIn` is set, the main window plays F15's quieter tone (AC-07, AC-F15-10).

### 3.7 Missed-call notification (AC-10–13b, 23; D080)
For each `missed` entry, main shows a notification once per `callId` (AC-24), but only if no main window was in front at `endedAt`. Main keeps a short focus history, so a late report is judged by the focus at the moment the ring ended, not when the report arrives.
- **Content:** title "Missed call", body "from <name>" or "from <name> in <group>", and one action, `Call back`.
- **Clicking it** brings the window used last to the front and opens the chat (`openChat {conversationId}`, added to the action list for main only).
- **Call back** sends `callBack {conversationId, video}`, which the main window treats like its chat call button, including its messages when the call can't start (AC-11).

macOS asks for permission with the first notification (AC-13b). A `failed` event, which happens when the app is unsigned or notifications are off, is ignored (AC-13).

### 3.8 Not in screen shares (AC-25)
Both small windows call `setContentProtection(true)` (macOS and Windows), so they are left out of any screen capture, our own share included. On Linux, where this doesn't exist, our own share picker leaves out MeetApp's small windows as window sources, and the small windows hide while the person shares a whole screen. On the owner's Mac it is also checked by hand once, with our own share and one other capture app (tests.md).

## 4. Data stored
- **Server:** nothing new.
- **This computer:** `userData/call-windows.json` (two places, AC-19). Nothing personal.

## 5. Backend endpoints and messages
**No backend change.** New desktop messages, inside the computer only:
- `meetapp:call-windows` (main window ↔ main process): `report`, `action`
- `meetapp:call-window` (small window ↔ main process): `state`, `act`
- one MessagePort per mini window for frames.

## Edge cases & errors
- **The main window crashes or reloads:** on `render-process-gone` or `did-start-loading`, main drops that window's report, so its small windows close. After a reload the window reports again.
- **Main window closed while a small window shows:** the small windows close with it (the app quits when the last main window closes, as today).
- **An action arrives for a ring that has just ended:** main ignores it, because the `callId` is no longer shown.
- **An accept fails:** the main window shows F15's error in front.
- **Screens change while a window shows:** main checks the place on `display-removed` / `display-metrics-changed` and moves the window to the fallback (AC-20).
- **Focus flickers** (for example a menu of the other app): a 150 ms wait before showing avoids flashing windows.
- **Reconnecting:** the mini window shows "Reconnecting…" and closes only when the call screen gives up (AC-18).
- **The lock screen:** the small windows don't show over the lock screen. The notification shows only the name (AC-23).

## Security & privacy
- **The small windows** use the same locked-down settings as the main window (S17: `contextIsolation`, `sandbox`, no `nodeIntegration`; `guardContents` blocks navigation and new windows). They load only `call-window.html` from the app.
- **Their own session:** the small windows use a separate session (`partition: "call-windows"`). `lockDownSession` is applied to it with every permission, device request and display-media request refused, and downloads refused, so they can never use the camera, microphone or screen.
- **Their own security policy:** `call-window.html` gets its own CSP, built in security.ts (`connect-src 'none'`; `img-src 'self' data: blob:`; the rest as S17). It is sent by app-protocol.ts, and by the dev-server header hook for that page's path. This only tightens S17, so AC-22 ("the same security settings") is met. They have no access to the backend, the call server or the sign-in.
- **Main** creates these windows itself; pages still can't open windows. With this design, apps/desktop/CLAUDE.md changes: "no new windows" becomes "pages can't open windows; only main opens the two call-window kinds (D079)". The preload list gains `callWindows`, `meetappCallWindow` and the existing `power`, which is missing from the list today.
- **Messages:** every message from a small window is checked against the allow-list. Only main's own small windows may send on `meetapp:call-window` (checked by sender id).
- **Notification text** is limited to names (AC-23). No message text appears, and the logs don't include names.
- **Content protection** keeps the small windows out of screen shares (AC-25).
- security.md S17 gains one line on the two kinds of small windows.

## Cost impact
- **None now.** Mac notifications are free, but they need a signed app (D080). The Apple Developer account ($99 a year) is already planned for F04; whether to buy it then is the owner's choice.

## Test approach
- **Unit (desktop, `call-windows.ts`):**
  - show and hide rules for every focus and report combination;
  - stacking, gap closing and no overlap with the mini window;
  - remembered places and the off-screen fallback;
  - several windows merged into one per call;
  - the action allow-list and refusals;
  - notifications once per call and only when not in front.
- **Unit (web):**
  - the report builder from incoming-call and call state (busy text, phases, missed list);
  - the action handler running the same code as the screen's buttons;
  - frame sending starts and stops with the mini window.
- **UI tests and stories:** `RingWindow` and `MiniCallWindow` in every state (video or audio, busy, group, speaker with and without video, sharing, reconnecting, lobby, calling). Screen-reader names, keyboard reach and Escape declining. Screenshots, made at verification.
- **Desktop e2e (real windows):**
  - the main window minimized or another window focused, then a call rings, so the ring window shows, isn't focused, and Video, Audio, Decline and × work;
  - bringing MeetApp to the front closes it while the ringtone keeps playing;
  - two callers at once stack and close the gap;
  - a dragged place is kept after a restart;
  - the mini window shows in a call when the window is minimized, its buttons change the call, and Leave closes it;
  - the small windows have content protection and the locked-down settings;
  - small windows can't navigate or send unknown actions.
  These tests skip what Linux can't do (see D077).
- **Notification:** unit-tested with a fake `Notification`. On the owner's Mac, checked by hand once signing allows (D080), including the first-time macOS permission question (AC-13b).
- **Screen-share check (AC-25):** by hand on the owner's Mac, with our own share and one other capture app; the e2e test checks the content-protection flag.
- **Every AC** (AC-F16-01 to 26 and 13b) is mapped to test cases in tests.md.

## Decisions made here
- **D079 (proposed):** small extra windows owned by main, driven by the main window's report; live video as JPEG pictures over a MessagePort.
- **D080 (proposed):** missed-call notifications need a signed app; until real signing (F04), they may not show in development.
