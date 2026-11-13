---
feature: F17
title: Browse during a call
status: approved
updated: 2026-11-13
---

# F17 Browse during a call: Requirements (WHAT)

## Goal
As in Microsoft Teams, a person in a call or meeting can open the rest of MeetApp (Chat, Meetings, People, Settings and so on) without leaving the call. The call keeps running in a small call view inside the MeetApp window; one click brings the full call back. A meeting link clicked during a call shows that meeting's pre-join, and joining it leaves the current call (MeetApp has no hold). Decided in D088; the screens are drawn on the canvas board "Browse during a call (F17)".

## Who uses it
Anyone in a call or meeting in the **desktop app**: F02 meetings (organizer, attendee, guest) and F15 calls from chat. Guests have no other screens to open: their call screen stays as it is, and a `meetapp://` link clicked by a guest during a call keeps the AC-F04-10 behaviour (the call screen stays).

## Terms
- **Full call:** the call screen as it is today (F02, F15).
- **Small call view:** the small panel inside the MeetApp window that shows the call while the person is on another screen.
- **Mini call window:** F16's separate window above other apps, shown when MeetApp isn't in front. Unchanged by this feature.

## User stories
- As someone in a call, I want to open a chat or my meetings list without hanging up, so that I can find something while the call goes on.
- As someone browsing during a call, I want to see who is talking and to mute or leave with one click, so that I stay in control.
- As someone in a call who clicks a link to another meeting, I want to see that meeting first and choose whether to leave my call for it.

## Acceptance criteria

### Leaving the call screen without leaving the call
- **AC-F17-01:** WHEN a signed-in person in a call or meeting clicks an item in the left menu (Home, Chat, Meetings, People, Requests, Workspace settings, Settings) or their picture's menu, THEN that screen opens and the call keeps running: sound and video continue without a break, and for the other participants the person's video, sound and mute state stay as they were, with no leave or join shown.
- **AC-F17-02:** WHEN the person is on any screen other than the full call, THEN the small call view shows at the bottom right of the MeetApp window, above the screen's content, without covering the left menu. It shows who is talking (their live video, or picture or initials when their camera is off, or the shared screen while someone shares) with their name, the call or meeting name, and the time since joining. It has: mute or unmute, camera on or off, and **Leave**. Unlike F16's mini call window it has no share, raise hand or people count (those are one click away on the full call). A screen the person is sharing keeps being shared, and the view says "You're sharing". The keyboard shortcuts for mute and camera (F02) work on every screen during a call. The person's rights apply as in F02 (for example, an attendee whose microphone the organizer turned off can't unmute).
- **AC-F17-03:** WHEN the person clicks the video in the small call view (or its **Go back** label), THEN the full call shows again within 1 second, in the same state it was in (layout, open panel such as chat or people list, shared screen).
- **AC-F17-04:** WHEN a button in the small call view is used, THEN the call behaves exactly as if the same button were pressed on the full call, and the full call, the small call view and the F16 mini call window show the same state within 1 second.
- **AC-F17-05:** WHEN the person presses Leave in the small call view, THEN they leave as from the full call (an organizer gets the same choices as there), the small call view closes, and the person stays on the screen they were on.
- **AC-F17-06:** WHEN the call ends, or the person is removed, or reconnecting gives up, THEN the small call view closes and the message the full call would give (for example "You were removed from the meeting") shows as a banner at the top of the current screen; the person stays on that screen. WHEN the connection drops, THEN the small call view shows "Reconnecting…".
- **AC-F17-07:** WHEN the person is waiting in a meeting's lobby (F02) or a chat call is still ringing the other side (F15 "Calling…"), THEN they can browse too, and the small call view shows that state with Leave or Cancel. WHEN they are let in or the other side answers, THEN the small call view shows the call.

### Where the call shows in the app
- **AC-F17-08:** WHEN the person is in a call, THEN the chat it belongs to (a chat call, or a meeting's chat) shows "Call in progress" in the chat list, and the Meetings screen marks the meeting the person is in with **Go back** instead of Join. Go back shows the full call.
- **AC-F17-09:** WHEN the person is in a call and presses Meet now, a call button in a chat, or **Join** on a chat's "started a call" note (AC-F15-04), THEN MeetApp asks "You're in <call or meeting name>. Starting this leaves it." with **Leave call and start** (or **Leave call and join**) and **Cancel**. Leave first leaves the current call, then starts or joins; Cancel changes nothing.
- **AC-F17-10:** WHEN an incoming call rings during a call (F15), THEN it works as today (accepting leaves the current call), whichever screen the person is on.

### Another meeting during a call
- **AC-F17-11:** WHEN the person, during a call, clicks a link to another meeting (a `meetapp://` link from anywhere, or a meeting in the Meetings screen, or Join with an ID), THEN MeetApp comes to the front and shows that meeting's pre-join within 3 seconds, with the note "You're in <call or meeting name>. Joining this meeting leaves it." The current call keeps running in the small call view. This also applies while waiting in a lobby or while "Calling…" (AC-F17-07); Leave call and join then leaves the lobby or cancels the call. The pre-join's camera preview uses the same camera without interrupting the current call's video; if it can't, the preview says "Camera in use by your current call" and the camera choice still applies when joining. This replaces the F04 rule where the link waited until Meetings was opened (AC-F04-10).
- **AC-F17-12:** WHEN the person presses **Leave call and join** on that pre-join, THEN they leave the current call (as with Leave) and join the new meeting with the camera and microphone choices made on the pre-join. WHEN they press **Cancel**, THEN the pre-join closes, the screen they were on before shows again, and the call is untouched.
- **AC-F17-13:** WHEN the link is for the meeting the person is already in, THEN the full call shows; no pre-join.

### The F16 windows
- **AC-F17-14:** WHEN MeetApp is not in front, THEN F16's mini call window behaves as today, whatever screen MeetApp was on. WHEN MeetApp comes to the front, THEN the mini call window hides and the person sees the screen they left (full call or another screen with the small call view). Its **back to the call** button shows the full call (the small call view says **Go back**, the same action).

### Speed and stability
- **AC-F17-15:** WHEN the person moves between the full call and other screens 20 times in a row, THEN the call never drops, sound has no gap longer than 500 ms (measured by the automated audio check in the desktop tests), and each switch completes within 1 second.
- **AC-F17-19:** WHEN the person closes the MeetApp window during a call, THEN the call continues (F04: MeetApp keeps running in the menu bar) and F16's mini call window shows.
- **AC-F17-20:** WHEN the person has several MeetApp windows, THEN the small call view shows only in the window that holds the call; other windows show only the "Call in progress" and Go back marks.
- **AC-F17-21:** WHEN the MeetApp window is at its smallest size (F04), THEN the small call view never covers the current screen's main button or the message box.

### Look and accessibility
- **AC-F17-17:** WHEN the small call view, the "leaves your call" notes and the "Call in progress" / Go back marks are built, THEN they match the screen designs the owner approved before the design stage (D029), follow Teams, and use the design system.
- **AC-F17-18:** WHEN the new screens are used, THEN every text comes from the translation file; every button in the small call view has a name for screen readers, can be reached with Tab, pressed with Enter or Space, and shows focus; screen readers announce when the small call view appears and when it changes to "Reconnecting…".

## Security & privacy
- Nothing new is sent to the server; the call's rules (F02, F15) are unchanged. The small call view shows only what the full call shows.
- A meeting link during a call is checked exactly like any other link (AC-F04-11); a bad link changes nothing and the call continues.
- **AC-F17-16:** WHEN the person signs out during a call, THEN they leave the call first (as with Leave), and the small call view and the F16 windows close.

## Out of scope
- Holding a call, or being in two calls at once (MeetApp has no hold).
- Moving or resizing the small call view (it stays at the bottom right). Can come later.
- The web app (F10) and the mobile app (F11).
- Picture-in-picture outside MeetApp: that is F16's mini call window.

## Open questions
None.
