---
feature: F16
title: Calls while MeetApp isn't in front
status: approved
updated: 2026-11-02
---

# F16 Calls while MeetApp isn't in front: Requirements (WHAT)

## Goal
As in Microsoft Teams, make sure nobody misses a call because MeetApp is behind other apps or minimized. An incoming call rings in a small window above every app. A missed call shows a Mac notification. During a call or meeting, a mini call window keeps the main controls at hand while the person works in another app.

Agreed with the owner on 2026-10-29 ("as you recommend"); moved here from F04 by D078. The screens are drawn on the canvas board "Calls while MeetApp isn't in front", approved on 2026-10-29.

## Who uses it
Anyone signed in to the **desktop app** (F02 meetings and F15 chat calls). The web app (F10) and the mobile app (F11) are not part of this feature.

## Terms
- **In front:** a MeetApp window is the active window on the computer. **Not in front:** another app is active, or every MeetApp window is minimized or hidden.
- **Ring window:** the small window for an incoming call.
- **Mini call window:** the small window shown during a call or meeting.

## User stories
- As someone working in another app, I want an incoming call to show above that app, so that I can answer without hunting for MeetApp.
- As someone who missed a call, I want a Mac notification with **Call back**, so that I can return the call quickly.
- As someone in a call who switched to another app, I want a small call window with mute, camera, share, raise hand and Leave, so that I stay in control of the call.
- As someone who keeps these windows in a certain spot, I want them to stay where I put them.

## Acceptance criteria

### Ring window (incoming call while MeetApp isn't in front)
- **AC-F16-01:** WHEN a call rings for a person (F15 rules) and no MeetApp window is in front, THEN a ring window appears above every other app, in the bottom-right corner of the screen that holds the MeetApp window used last. It does not take the keyboard away from the app the person is typing in.
- **AC-F16-02:** WHEN the ring window shows, THEN it shows the caller's picture or initials, name, "Video call" or "Audio call", and the chat's name for a group call. It has these buttons: **Video** (accept with camera on), **Audio** (accept with camera off), **Decline**, and a hide **×**.
- **AC-F16-03:** WHEN the person presses Video or Audio, THEN the call is accepted exactly as in F15 (including leaving a current call or meeting first). The ring window closes, the MeetApp window comes to the front and opens the call within 3 seconds.
- **AC-F16-04:** WHEN the person presses Decline, THEN the call is declined as in F15 and the ring window closes. WHEN they press ×, THEN only this ring window closes and the ringtone stops on this computer. The incoming call stays visible, silently, in the main MeetApp window until the ring ends; the person's other devices keep ringing.
- **AC-F16-05:** WHEN a MeetApp window comes to the front while a ring window shows, THEN the ring window closes and the incoming call shows inside the app as in F15. The ringtone continues without a break.
- **AC-F16-06:** WHEN the ring stops for any reason (caller cancels, someone else or another device answers, 30 seconds pass, the call ends), THEN the ring window closes within 2 seconds.
- **AC-F16-07:** WHEN the person is already in a call or meeting and another call rings, THEN the ring window says "You're in <call or meeting name>. Accepting leaves it.", its buttons say "Leave current call and accept" with video or audio, and the quieter tone from AC-F15-10 plays.

### Several calls at once
- **AC-F16-08:** WHEN several calls ring at the same time, THEN each has its own ring window. They are stacked upwards from the corner, the newest on top, and they never cover each other or the mini call window. Only one ringtone plays.
- **AC-F16-09:** WHEN one of several ring windows closes, THEN the others move down to close the gap.

### Missed call notification
- **AC-F16-10:** WHEN a call to the person ends without them answering on any device ("Missed call" note, F15), and no MeetApp window was in front when the ring ended, THEN a Mac notification appears: "Missed call from <name>" (or "… in <group name>"), with a **Call back** button.
- **AC-F16-11:** WHEN the person presses Call back, THEN MeetApp comes to the front and starts a call of the same kind (video or audio) in that chat, as pressing the call button in the chat would. If the call can't start (the chat is now read-only, the person left it, the call limit is reached), MeetApp opens the chat and shows the same message its call button would. WHEN they click the notification itself, THEN MeetApp comes to the front and opens that chat.
- **AC-F16-12:** Answered and declined calls, and calls that end without a "Missed call" note (for example the person was removed from the call), do not create a notification. A caller who hangs up before anyone answers does create one (it is a missed call, AC-F15-09; as in Teams). A call whose ring ended while MeetApp was in front shows no notification either: the "Missed call" note in the chat is enough.
- **AC-F16-13:** WHEN the Mac's notifications for MeetApp are turned off (Mac settings, Focus or Do Not Disturb), THEN MeetApp shows no error, works normally, and the chat still has the "Missed call" note.
- **AC-F16-13b:** WHEN the first missed-call notification is about to show, THEN macOS asks the person once whether MeetApp may show notifications. WHEN they refuse, THEN AC-F16-13 applies and MeetApp doesn't ask again (they can turn it on in the Mac's settings).

### Mini call window
- **AC-F16-14:** WHEN the person is in a call or meeting and no MeetApp window is in front, THEN a mini call window appears above every other app, within 1 second. This includes the F02 lobby (waiting to be let in) and F15's "Calling <name>…", where it shows that state and Leave or Cancel. WHEN a MeetApp window comes to the front, THEN the mini call window hides.
- **AC-F16-15:** WHEN the mini call window shows, THEN it shows who is speaking: their live video (their picture or initials when their camera is off, or the shared screen while someone shares), with their name; the call or meeting name, the time since joining, and how many people are in it. It has these buttons: mute or unmute, camera on or off, share screen, raise or lower hand, **Leave**, and **back to the call** (brings MeetApp to the front on the call screen). It also has a hide **×** (added by the owner, 2026-11-02): it hides the mini window until the person has been back in MeetApp; the call goes on.
- **AC-F16-16:** WHEN a button in the mini call window is used, THEN the call behaves exactly as if the same button were pressed in the call screen, and both show the same state within 1 second. The person's rights apply as in F02 (for example, an attendee whose microphone the organizer turned off can't unmute).
- **AC-F16-17:** WHEN the person presses share screen in the mini call window, THEN MeetApp's own share picker opens in front (F02 rules: nothing is shared without a choice there).
- **AC-F16-18:** WHEN the connection drops, THEN the mini call window shows "Reconnecting…" as the call screen does. WHEN the call ends, or the person leaves or is removed, or the call screen gives up reconnecting, THEN the mini call window closes. Any message the call screen gives (for example "You were removed from the meeting") shows in the main window, which comes to the front.

### Moving and remembering
- **AC-F16-19:** WHEN the person drags a ring window or the mini call window, THEN it moves, and the next time it shows it appears in the same place. Each kind of window remembers its own place. Stacked ring windows keep the order from AC-F16-08, starting at the remembered place.
- **AC-F16-20:** WHEN the remembered place is no longer on any screen (a screen was unplugged or its size changed), THEN the window appears in the bottom-right corner of the main screen.

### Several MeetApp windows on one computer
- **AC-F16-24:** WHEN a person has several MeetApp windows open on this computer, THEN at most one ring window per call, one mini call window and one missed-call notification per call show on this computer; accepting brings the MeetApp window used last to the front.

### Over other apps and screens
- **AC-F16-26:** The ring window and mini call window show over full-screen apps and on the desktop (Mac Space) in use.

### Accessibility and language
- **AC-F16-21:** All texts in the ring window, mini call window and notification are translatable. Every button has a name for screen readers. Screen readers announce the ring window ("Incoming video call from <name>"). In both windows every button can be reached with Tab and pressed with Enter or Space, focus is visible, and Escape in a ring window declines, as in F15.

## Security & privacy
- **AC-F16-22:** The new windows show only MeetApp's own screens, with the same security settings as the main window (security S17: isolated, sandboxed, no Node, the same security policy). They can't open other web addresses or new windows. They talk to the call only through the main MeetApp window, so they hold no sign-in token.
- **AC-F16-25:** The ring window and mini call window never appear in the person's own screen share.
- **AC-F16-23:** The missed-call notification (also on the lock screen) shows only the caller's name and the group name, never message text. The windows show nothing about a call the person may not see (F15 rules).
- No new data is stored on the server. The windows' places are stored only on this computer, in a small file of MeetApp's (`call-windows.json`).
- No new outside service: notifications go through the Mac's own notification system.

## Out of scope
- Notifications for chat messages, and the choice between "Teams built-in or Mac" notifications: later.
- "Busy on Busy" (refuse calls while in a call): later, with admin settings (F10).
- Putting a call on hold: not planned (accepting leaves the current call, as decided in F15).
- Ringing when MeetApp is completely closed (no window open and the app not running): that needs F04's "keep running in the background".
- Hiding the small windows from screen shares on Linux (AC-F16-25 covers macOS and Windows): later, with F04's Linux work.
- The web and mobile apps; Windows details come with F04 (the windows must not depend on anything Mac-only, except the notification wording).

## Decisions made without asking (technical defaults)
- The windows show only when no MeetApp window is in front, as in Teams.
- The ring window doesn't steal the keyboard, so an answer can't be typed by accident.
- Places are remembered per computer, not per account.

## Owner's choices (2026-11-02)
- The mini call window shows the speaker's live video, as in Teams.
- A missed-call notification shows only when MeetApp wasn't in front.
- The mini call window has a hide × (it stays hidden until MeetApp is in front again; the call goes on).
- A caller hanging up before anyone answers gives a missed-call notification, as in Teams (owner, 2026-11-02, second verification).
- MeetApp's own "Do not disturb" status doesn't silence calls or notifications; only the Mac's settings do (blocking calls can come later with admin settings).

## Open questions
None.
