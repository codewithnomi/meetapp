---
feature: F17
title: Browse during a call
status: draft
updated: 2026-11-14
---

# F17 Browse during a call: Design (HOW)

## Summary (plain English)
Today the call lives inside the call screen: leaving that screen ends the call. F17 moves the call one level up, into a **call host** that stays in place while the person moves between screens. The call screen is the same code as now; when the person opens another screen, the host keeps it running out of sight and shows a **small call view** at the bottom right instead. Clicking it shows the full call again, exactly as it was. Nothing changes on the server; this is all in the app's screens (apps/web).

## Screens / user flow
Approved canvas board "Browse during a call (F17)" (2026-11-13).
1. In a call (meeting, lobby, or chat call) the person clicks Chat in the left menu. The Chat screen opens; the call keeps running; the small call view appears at the bottom right.
2. They click the small call view's video or **Go back**: the full call shows again. The full call fills the window as today (no left menu), so it looks exactly as before F17.
3. On Meetings, the meeting they are in shows **Go back** instead of Join; Meet now asks "Starting this leaves it."
4. A link to another meeting opens its pre-join with the note "Joining this meeting leaves it."; **Leave call and join** leaves, then joins; **Cancel** goes back.

## How it is built

### 3.1 The call host (AC-F17-01, 03, 07, 13, 15, 20)
- New `apps/web/src/app/CallHost.tsx`, rendered once by `SignedInScreens` after the routes (not inside them), so navigation never unmounts it.
- **Active** while the person is really in something: the visit is admitted or waiting and its call has not ended (the outcome store below is empty), or the chat call is in the `calling` or `in_call` phase. It is active only while the visit and the chat call agree (a chat call needs both); otherwise it renders nothing.
- While active it renders the existing `LobbyPage`, `MeetingPage` or `ChatCallPage` with a new `hosted` prop: in hosted mode they render nothing instead of `<Navigate>` when their store is empty for a moment (`ChatCallPage.tsx:172`).
- The routes `/meeting/lobby`, `/meeting/call` and `/call` stay, but render nothing themselves: they only mean "show the call full". On those paths the host's wrapper is visible and full-window; on any other path the wrapper gets `hidden` and `inert` (`data-call-host` attribute), and the small call view shows.
- Hidden, the call keeps its LiveKit room, sound, panels and layout (the components stay mounted). Adaptive stream stops downloading videos that aren't visible. The lobby's own camera preview is stopped while hidden (`LobbyPage` gets `previewOn={!hidden}`) so the camera light doesn't stay on for nothing; it restarts when shown.
- Focus: `useFocusOnScreenChange` (router.tsx:54) uses `main:not([data-call-host] *) h1`, so moving between screens never sends focus into the hidden call.
- Guests (signed out) keep today's routes, no host. Only the window that holds the call has a host (AC-F17-20).

### 3.2 Callbacks: who changes screens (AC-F17-05, 06, 07)
The host gives the pages callbacks that change screens **only while the full call is showing**:
- `onAdmitted` (lobby): full → `/meeting/call`; hidden → nothing (the small view switches to the call).
- `onBackToChat`, `Calling` leave (chat call): full → `/chat`; hidden → nothing.
- `onLeft`: full → home as today; hidden → nothing (the person stays where they are).
- `onOutcome` (ended, removed, lost): full → `/meeting/ended` as today; hidden → the outcome goes into a small `useCallOutcome` store. The host then becomes inactive and shows the outcome as a `Notice` banner at the top of the current screen, with **Rejoin** (same `useRejoin` as `EndedRoute`) when a rejoin is possible, and ×. A visit kept for Rejoin no longer counts as active once an outcome is stored.

### 3.3 The small call view (AC-F17-02, 04, 05, 06, 18, 21)
- New organism `packages/ui/src/organisms/SmallCallView` (props only: speaker name, video slot, title, elapsed, mic/camera state and whether allowed, sharing flag, state `lobby | calling | connecting | reconnecting | in_call`, labels, callbacks), with stories and tests per frontend.md.
- Data and buttons come from the existing `useCallScreen` store (F16 design 3.1), which the call screen already fills with its state and its own button handlers, so mute and camera do exactly what the full call does and the F16 mini window keeps working (AC-F17-04). The store gains `speakerTrack`, shown with the existing `TrackVideo`, and `leaveChoices: boolean`.
- **Leave:** for an organizer or co-organizer (who get choices on the full call, `MeetingPage.tsx:274`), Leave shows the full call with its leave dialog open (`controls.openLeave`, new). For everyone else it runs `controls.leave`. Lobby: Leave; Calling: Cancel.
- **Shortcuts:** the mute, camera and hand shortcuts already listen on the whole window (`shortcuts.ts:31`), so they work on every screen (AC-F17-02); the file's comment is updated. The hand shortcut working while browsing is intended (Teams does the same).
- **Position:** fixed bottom right of the screen area, 300 px wide, 16 px from the edges, never over the left menu. `AppLayout` (template) gets a `reserveCorner` prop: while the small view shows, it adds bottom padding (the view's height + 16 px) to the content area, so at the smallest window (800×600, F04) the screen's main button and the chat message box stay free.
- **Accessibility:** `role="region"` with a label; its state changes ("Reconnecting…", "Call ended") go to a polite live region; every button has a name, Tab, Enter/Space and focus ring.

### 3.4 Marks in the app (AC-F17-08)
- `useCurrentCall()` (new, `features/calls`): `{ kind: "meeting" | "chat", meetingId?, conversationId?, title, fullPath }` where `fullPath` is `/meeting/call`, `/meeting/lobby` or `/call`.
- Chat list: the call's chat row says "Call in progress" (new key). Meetings: the matching meeting's Join becomes **Go back** (navigates to `fullPath`).

### 3.5 Starting something else during a call (AC-F17-09, 10, 11, 12, 13)
- New `useLeaveFirst()` (`features/calls`): given the next action, it opens a `ConfirmDialog` ("You're in <title>. Starting this leaves it." / "Joining this meeting leaves it.") with **Leave call and start/join** and **Cancel**. Leave runs `controls.leave`, waits until the host is inactive (at most 5 s, then shows an error and does nothing), then runs the action. Its buttons are disabled while leaving.
- Used by: Meet now, the call buttons in chats, Join on a chat's call note, and the pre-join's Join while a call is active. Incoming calls keep F15's own "accepting leaves" flow (AC-F17-10).
- Pre-join during a call: `/meeting/pre-join` opens normally (the call is hidden, the small view shows). It shows the note, and its Join button says "Leave call and join". The camera preview asks for the camera the call already uses; Chromium lets two tracks share one camera, so the call's video continues. If the preview fails, it says "Camera in use by your current call" and the choice still applies. Cancel goes back to the previous screen (`navigate(-1)`).
- Same meeting (AC-F17-13): when the pre-join's meeting is the visit's meeting, it navigates to `fullPath` instead.
- **Desktop links (replaces AC-F04-10's waiting):** `app/desktop-commands.ts` no longer treats the call screens as busy (`BUSY_SCREENS`) for signed-in people. A clicked link opens Meetings with the code, whose Join form looks it up and opens the pre-join, all within 3 s (AC-F17-11). Guests keep `BUSY_SCREENS`.

### 3.6 Window close, sign-out, F16 (AC-F17-14, 16, 19)
- F04 hides the window on close and F16 shows the mini window when MeetApp isn't in front; the host keeps the call, so only tests are new.
- Sign out during a call: first `controls.leave`, wait until the host is inactive (at most 5 s), then sign out.
- F16's "back to the call" (`use-call-windows`, `toCall` from `router.tsx:264`) navigates to `useCurrentCall().fullPath` instead of always `/call`.

## Data stored
None new.

## Backend endpoints / messages
None new. Leaving and joining use the existing F02/F15 calls.

## Edge cases & errors
- Call drops while browsing: small view shows "Reconnecting…"; if it gives up, the banner says the connection was lost, with Rejoin.
- Settings → Devices during a call: works as today; changes apply to the call (F02).
- An F15 ring while browsing: the in-app incoming call card shows as today.
- Leaving takes too long (`useLeaveFirst`, sign-out): after 5 s the person sees "Couldn't leave the call. Try again." and nothing else happens.

## Security & privacy
No new data, no new permissions. The small view shows only what the full call shows. Links are checked as before (AC-F04-11).

## Cost impact
None (no new services).

## Test approach
| AC | Test |
|---|---|
| 01 | e2e (two windows): browse; the other window still shows the person's video, unmuted, with no "left"/"joined" |
| 02 | unit (SmallCallView: speaker, title, time, sharing, not allowed to unmute); e2e: mute shortcut on Chat |
| 03 | component (CallHost: same page instance after navigating, open panel kept); e2e: back within 1 s |
| 04 | e2e: mute from the small view shows on the full call and the F16 mini window within 1 s |
| 05 | unit (organizer → leave choices; member → leave); e2e: Leave from Chat stays on Chat |
| 06 | component (outcome → banner, Rejoin); unit: Reconnecting… |
| 07 | e2e: lobby and Calling… while browsing; admitted → small view shows the call |
| 08 | unit (useCurrentCall, chat row mark, Meetings Go back) |
| 09 | unit (useLeaveFirst); e2e: Meet now during a call |
| 10 | e2e: a ring while on Chat during a call |
| 11 | e2e: a `meetapp://` link during a call opens the pre-join with the note within 3 s |
| 12 | e2e: Leave call and join; Cancel goes back with the call untouched |
| 13 | unit: link to the same meeting → full call |
| 14 | e2e: window behind → mini window; back to the call → full call |
| 15 | e2e: 20 switches; every switch under 1 s; the other window's received-audio counter (`totalSamplesReceived` of the audio track) grows without a pause over 500 ms |
| 16 | e2e: sign out during a call leaves first |
| 17 | screenshots of SmallCallView (light and dark, every state) checked against the board |
| 18 | unit (labels, keyboard, live region); unit: focus skips the hidden call |
| 19 | e2e: close the window during a call → call continues, mini window shows |
| 20 | e2e: second window shows marks only |
| 21 | e2e at 800×600: the small view doesn't cover the Chat message box or Meetings' main button |

## Decisions made here
- D091 (proposed): the call stays mounted in a call host above the routes and is hidden, not unmounted, while browsing.
