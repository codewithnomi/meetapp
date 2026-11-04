---
feature: F04
title: Desktop app
status: approved
updated: 2026-11-03
---

# F04 Desktop app: Requirements (WHAT)

## Goal
MeetApp becomes a real app people install on their Mac or Windows computer and leave running all day, as with Microsoft Teams: it keeps running in the menu bar when the window is closed, starts at login, opens meeting links, shows notifications for messages, mentions and the lobby, lets people set their status by hand, and remembers its window.

## Who uses it
Everyone with the desktop app: members, organizers and presenters, guests joining by link.

## User stories
- As a member, I want to install MeetApp with a normal installer, so that I don't need developer tools.
- As a member, I want MeetApp to keep running when I close its window, so that calls and messages still reach me.
- As a member, I want MeetApp to start when I log in to my computer, so that I never miss a call.
- As a member, I want a notification when someone messages or mentions me, so that I can answer quickly.
- As an organizer, I want to know when someone is waiting in my meeting's lobby, and admit them from the notification.
- As anyone, I want a meeting link to open MeetApp straight at that meeting, so that joining is one click.
- As a member, I want to set my status (Busy, Do not disturb…) myself, so that others know when not to disturb me and I'm not disturbed.
- As a member, I want to choose which notifications I get, so that only what matters reaches me.

## Acceptance criteria

### Installing (owner: unsigned for now, sign later; D017)
- **AC-F04-01:** WHEN the person opens the Mac installer (`.dmg`) or the Windows installer (`.exe`), THEN they can install MeetApp in the usual way for that system and start it from Applications or the Start menu. Because the app isn't signed yet, the system warns once; `docs/getting-started.md` ("Install the app") says in plain words how to get past it.
- **AC-F04-02:** WHEN MeetApp is running and the person starts it again (or clicks a link, AC-10), THEN no second copy starts; the running MeetApp handles it and its window comes to the front.
- **AC-F04-03:** WHEN signing is switched on later (Apple Developer account, Windows certificate), THEN only build settings and secrets change, not app code. Checked by a test build signed with a throwaway certificate.

### Closing, the menu bar and quitting (owner, 2026-11-02)
- **AC-F04-04:** WHEN the person closes the last MeetApp window (red ✕, ⌘W / Ctrl+W), THEN MeetApp keeps running with its icon in the Mac menu bar (Windows: the notification area of the taskbar). Calls still ring (F15, F16) and notifications still arrive. The first time on this computer, a MeetApp corner notification says "MeetApp is still running. You'll find it in the menu bar." (Windows: "…in the taskbar's notification area.")
- **AC-F04-05:** WHEN the person clicks the menu-bar icon, THEN a menu shows: Open MeetApp, their status with the choices of AC-20, Settings, and Quit MeetApp. Not signed in: Open MeetApp, Sign in, Quit.
- **AC-F04-06:** WHEN the person chooses Quit (menu-bar menu, the MeetApp menu, ⌘Q, or on Windows Alt+F4 on the last window then Quit from the tray), THEN MeetApp stops fully. In a call or meeting it asks first: "Quit MeetApp? You'll leave the call." (Quit / Cancel).
- **AC-F04-07:** WHEN a call rings while no MeetApp window is open, THEN the ring window (F16) appears as usual; Video or Audio opens a MeetApp window straight into the call within 3 s.

### Start at login (owner, 2026-11-02)
- **AC-F04-08:** WHEN the person logs in to their computer, THEN MeetApp starts by itself, hidden in the menu bar (no window), signed in as before. If not signed in, or the sign-in has expired, it still starts hidden and its menu offers Sign in. It is on after the first install; an update keeps the person's choice.
- **AC-F04-09:** WHEN the person turns off "Start MeetApp when I log in" in Settings → General, THEN it no longer starts at login; turning it on again brings it back.

### Meeting links
- **AC-F04-10:** WHEN the person clicks a MeetApp meeting link (`meetapp://m/<meeting code>`, the same code as the meeting's shared link, F02) anywhere on their computer, THEN MeetApp opens or comes to the front at that meeting's pre-join screen within 3 s. Not signed in: the guest join screen with the meeting's title (AC-F02-08). Already in a call or in a lobby: the call screen stays (leaving it would end the call) and MeetApp comes to the front; the link waits and opens that meeting's pre-join when the person opens Meetings (changed during T6, 2026-11-04: the call lives on its screen).
- **AC-F04-11:** WHEN the link is wrong, unknown or expired, THEN MeetApp shows the same messages as typing it under Join a meeting (AC-F02-08). Any other `meetapp://` address, or anything extra in it, is ignored and MeetApp only comes to the front. A link never joins, sends or changes anything by itself.
- **AC-F04-12:** WHEN the person copies a meeting link in MeetApp, THEN they get the link others can click to open MeetApp (AC-10), and the meeting ID and passcode as today.

### Status set by hand (owner, 2026-11-03; as Teams; was "later" in F14)
- **AC-F04-20:** WHEN the person picks a status from their picture (top of the window) or the menu-bar menu, THEN they can choose Available, Busy, Do not disturb, Be right back, Appear away, or Reset status (back to automatic, F14). Others see it within 5 s in chats and people lists (F14 rules).
- **AC-F04-21:** WHEN they pick a status, THEN they can choose how long: 30 minutes, 1 hour, 2 hours, Today, This week, or until they change it. After that it goes back to automatic.
- **AC-F04-22:** WHEN the person's status is **Do not disturb**, THEN no message, mention or lobby notification shows (they still count as unread). Calls still ring and missed calls are still noted, as decided in F16. (This updates F16's note that MeetApp's own Do not disturb doesn't silence notifications: calls stay as they are; F04's new notifications are silenced.)
- **AC-F04-23:** WHEN the person is in a call or meeting, THEN their automatic status is "In a call" (F14) unless they set one by hand.

### Notifications (owner: as Microsoft Teams does)
- **AC-F04-30:** Every F04 notification is a MeetApp card in the bottom-right corner, above other apps, without taking the keyboard (as AC-F16-01). It stacks with ring windows without covering them or the mini call window (AC-F16-08). It goes away after 8 s unless the pointer is on it; × closes it at once. At most 3 show at once; when a fourth comes, the oldest goes. (Owner, 2026-11-03: MeetApp's own notifications while unsigned.)
- **AC-F04-31:** WHEN a new message arrives in a chat that isn't the chat shown in a MeetApp window in front, and the chat isn't muted (F14), THEN a notification shows the sender's picture and name, the chat's name, and the first 100 characters of the message, with a sound. With "Show message preview" off it shows "New message" instead of the text. Clicking it opens that chat.
- **AC-F04-32:** WHEN 2 or more messages arrive in the same chat while its notification is still showing, THEN that notification changes to "<n> new messages" with the latest sender, and the sound plays once.
- **AC-F04-33:** WHEN someone @mentions the person (F14), THEN a notification marked "mentioned you" shows, even if that chat is muted (as Teams), unless mentions are off in Settings. The same message never also gives a normal message notification.
- **AC-F04-34:** WHEN someone joins the lobby of a meeting where the person can admit (organizer or presenter, F02 rules; attendees never), and that meeting isn't the window in front, THEN a notification says "<name> is waiting in the lobby" (guests: the name they typed, marked "Guest") with **Admit** and **View lobby**. Admit lets them in without opening the meeting. With 3 or more waiting it becomes one notification "<n> people are waiting" with View lobby.
- **AC-F04-35:** Missed calls keep F16's Mac notification (owner, 2026-11-03: Mac-only until signed, D080); F04 doesn't add a corner version.
- **AC-F04-36:** WHEN the person opens Settings → Notifications, THEN they can turn on or off, each on its own: chat messages, mentions, lobby waiting, sound, and "Show message preview". All are on by default. Changes apply at once and are kept on their account, so they follow them to another computer.
- **AC-F04-37 (deferred until signing, D086):** WHEN the Mac's Focus / Do Not Disturb (or Windows' Do not disturb) is on, THEN no message, mention or lobby notification shows, as with AC-22.
- **AC-F04-38:** WHEN the computer wakes from sleep or the network comes back, THEN MeetApp reconnects within 10 s by itself. Unread counts and missed-call notes catch up; no notification shows for messages older than 5 minutes (the unread counts are enough).

### Window and running smoothly
- **AC-F04-40:** WHEN the person moves or resizes the MeetApp window and later opens it again or restarts, THEN it comes back at the same size and place. If that screen is gone, it opens centred on the main screen.
- **AC-F04-41:** WHEN MeetApp starts (double-click to the chat list showing, signed in, on the owner's Mac), THEN it takes under 3 s (quality target).
- **AC-F04-42:** WHEN a call or meeting runs and MeetApp is behind other apps, minimized or its window closed, THEN the call keeps going: no sound gap over 500 ms in 10 minutes, and the other person keeps seeing the video.

### Updates (ready, switched on later)
- **AC-F04-50:** The app contains what it needs to update itself from a GitHub release, but it is switched off until the owner decides to go online. Settings → About shows the version and "Updates are turned off". No cost.

### Mac and Windows
- **AC-F04-60:** Every criterion works on Mac and Windows with each system's usual words and keys: menu bar / taskbar notification area, ⌘ / Ctrl, Mac Focus / Windows Do not disturb. The ring window, mini call window and corner notifications (F16, F04) work on Windows too; Mac-only is only the Mac notification for missed calls (AC-35).
- **AC-F04-61:** The automatic tests run on both (Windows on GitHub's computers). Start at login, a link clicked in another app, the installers and the first-run warning are checked by hand on the owner's Mac and once on Windows.

## Security & privacy
- The sign-in key stays in the system keychain (as today); start at login stores nothing new.
- Meeting links only open a pre-join screen; nothing is joined, sent or changed without the person's click (AC-11). Links are checked strictly.
- Notifications show only what the person may see (F14, F15 rules). "Show message preview" off hides the text everywhere, including the lock screen.
- A notification's Admit is checked by the server like the lobby's own Admit (F02 rights).
- The corner notification windows follow S17 (locked-down small windows, as F16).
- Security rules S1–S18 apply; signed updates (S18) come when updates are switched on.

## Out of scope
- Signing with paid certificates (Apple Developer $99/year, Windows certificate): later, owner's choice (D017). Until then missed-call notifications stay off outside the app (D080).
- The Mac's notification centre as a style for F04 notifications: once signed.
- A status message ("Back at 3"): later.
- Switching updates on and hosting releases: when we go online.
- Meeting-starting reminders: with F13 Scheduling.
- Linux installer: later.
- The web and mobile apps (F10, F11).

## Owner's choices
- 2026-11-02: unsigned now, sign later; keep running in the menu bar on close; start at login (hidden, Settings switch); notifications as in Teams.
- 2026-11-03: MeetApp's own corner notifications while unsigned; message preview on by default with a Settings switch; status set by hand added to F04 (with Do not disturb silencing message, mention and lobby notifications; calls still ring); missed calls stay Mac-only until signing.
- Chosen by Claude as sensible defaults (owner may change): 8 s on screen, at most 3 at once, 100 characters of preview, 3 or more lobby people grouped, 5-minute catch-up limit.

## Open questions
None.
