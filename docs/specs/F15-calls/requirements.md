---
feature: F15
title: Calls from chat (audio and video)
status: approved
updated: 2026-10-27
---

# F15 Calls from chat (audio and video): Requirements (WHAT)

## Goal
Let people call each other straight from a one-to-one or group chat, with audio or video, as in Microsoft Teams: the other people's app rings, they accept or decline, and the call shows up in the chat (missed calls, how long it lasted). Calls use everything F02 already built (call server, devices, screen sharing, reactions, quality).

## Who uses it
- **Caller:** anyone who can write in the chat (F14's rules: accepted member, chat not read-only).
- **People called:** the chat's other accepted members.
- **Workspace members and external people** in the same way as in F14 chats (no guests: chats need an account).

## User stories
- As a member, I want to press Video call or Audio call in a chat, so that I can talk to that person or group at once.
- As the person called, I want my app to ring with who is calling and to accept with or without video, or decline, so that I decide.
- As someone who missed a call, I want to see "Missed call" in the chat, so that I can call back.
- As a member of a group chat, I want to join a call that is already running in that chat, so that I don't need a new one.
- As someone in a call, I want to add more people, so that they join the conversation.
- As a colleague, I want to see that someone is "In a call", so that I don't disturb them.

## Acceptance criteria

### Starting a call
- **AC-F15-01:** WHEN a person who may write in a one-to-one or group chat presses **Video call** or **Audio call** in the chat header, THEN a call starts from that chat: the caller joins it at once (camera on for a video call, off for an audio call; microphone on), sees "Calling <name>…" (or the group's name) with **Cancel**, and the other accepted members' apps ring. No meeting link, passcode or lobby is involved.
- **AC-F15-02:** WHEN the chat is read-only (blocked: F14 AC-13; a request not yet accepted: AC-12; outside chat turned off: AC-27; the person left the chat: AC-18; left the workspace or deleted their account: AC-34, AC-33) or is a meeting chat, THEN the call buttons are disabled with a note saying why, and the backend refuses a call started directly.
- **AC-F15-03:** WHEN a call is already running in the chat, THEN the call buttons are replaced by **Join**, and pressing a call button again (from another window) joins that call instead of starting a second one.
- **AC-F15-04:** WHEN a group chat has more than 20 accepted members, THEN starting a call rings no one; the call still starts, the chat shows the "started a call" note with **Join** (and the chat list shows it as the last line, without counting it as unread), and members join from there, as in Teams for large groups. The call still holds at most 20 people (AC-F15-14).

### Ringing
- **AC-F15-05:** WHEN someone is called, THEN every open MeetApp window of theirs shows an incoming-call window within 2 seconds, with the caller's photo and name (and the group's name for a group call), a ringing sound, and **Accept with video**, **Accept with audio** and **Decline**. Ringing works while they are in another screen of the app or the app is behind other windows (a system notification when the app is in the background is part of F04).
- **AC-F15-06:** WHEN the called person accepts in one window, THEN they join the call within 3 seconds with the microphone on and the camera as chosen (on for Accept with video, off for Accept with audio), and ringing stops in all their other windows. Joining the same call again from another window adds that window as a second participant, as in F02 (AC-F02-13).
- **AC-F15-07:** WHEN the called person declines, THEN ringing stops in all their windows; in a one-to-one call the caller sees "<name> declined" and the call ends; in a group call the others keep ringing.
- **AC-F15-08:** WHEN nobody answers within 30 seconds, THEN ringing stops; in a one-to-one call the caller sees "No answer" and the call ends. In a group call, WHEN nobody has joined after 30 seconds, THEN the call ends; everyone called gets a missed call.
- **AC-F15-09:** WHEN the caller presses **Cancel** before anyone accepts, THEN ringing stops for everyone at once and they get a missed call. WHEN the caller leaves a group call before anyone joins, THEN the same happens.
- **AC-F15-10:** WHEN someone is called while already in a meeting or another call, THEN they still see the incoming call (with a quieter tone); accepting leaves the current call first and says so on the button ("Leave current call and accept"). There is no "hold".
- **AC-F15-11:** WHEN someone has no MeetApp window open, THEN nothing rings for them; they see the missed call in the chat later (AC-F15-15).

### In the call
- **AC-F15-12:** WHEN people are in a call from a chat, THEN they have F02's call controls and behaviour (microphone, camera, screen sharing for everyone, reactions, raised hands, devices, noise suppression, reconnecting, connection quality), and the call's chat panel is that same chat: messages sent during the call appear in the chat and stay there. There are no organizer roles, lobby, locking, muting others or removing people: everyone in the call is equal, as in Teams chat calls.
- **AC-F15-13:** WHEN someone in a call chooses **Add people** and picks accepted members of the chat who aren't in the call, THEN those people's apps ring (AC-F15-05). **Add people** is disabled once the call has 20 people. Adding someone who isn't in the chat is not possible from the call (they are added to the group chat first, F14).
- **AC-F15-14:** WHEN a one-to-one call has two people in it and one leaves, THEN the call ends for both. WHEN a group call's last person leaves, THEN it ends. A call has at most 20 people (the 21st to join is told "This call is full") and lasts at most 30 hours, like a meeting (F02), after which it ends with a note to everyone.

### What the chat shows
- **AC-F15-15:** WHEN a call starts, ends, or is missed, THEN the chat shows a note: "<name> started a call" with **Join** while it runs; "Call ended · 12m 30s" when it ends ("1h 05m" for an hour or more); and for each person called who never joined (including one who declined), "Missed call from <name>" (with **Call back**) in their view, as in Teams. The chat list's last line shows these notes and a missed call counts as unread.
- **AC-F15-16:** WHEN a person is in a call (from a chat or a meeting), THEN their status shows **In a call** to the people who may see their status (F14 AC-26), and changes back to Available or Away (F14 AC-26) within 30 seconds of leaving. If the app closes or the connection drops during a call, D068 applies (Away for 30 seconds, then Offline). This replaces F14's "In a meeting" with one status, **In a call**, for meetings and chat calls (D070).

### Other devices and transfer (owner, 2026-10-27, as in Teams)
- **AC-F15-33:** WHEN a person is in a call and opens MeetApp on another device (for now another desktop window or computer), THEN that device shows "You're in a call on another device" with **Join on this device** and **Transfer to this device**. Transfer connects the new device first and only then takes the old one out of the call (within 3 seconds, without the others seeing them leave and rejoin as a new person); Join adds the device as a second participant (F02 AC-13).
- **AC-F15-34:** WHEN a person is called, THEN the ring reaches every device they are signed in on that can ring (for now: open desktop windows), and answering or declining on one stops it on all. Mobile devices join this list in F11 (push ringing) without changing how ringing works.

### Settings: devices, backgrounds and ringtone (owner request, 2026-10-27)
- **AC-F15-29:** WHEN a person opens **Settings → Devices**, THEN they can choose their **microphone**, **speaker** and **camera** from the devices on that computer, see a live **camera preview**, a microphone level meter, play a **Test speakers** sound, and turn noise suppression on or off. Their choices are remembered on that computer and used for every call and meeting (pre-join screen, in-call device settings and incoming calls start from them). A chosen device that is unplugged falls back to the computer's default and says so (F02 AC-31).
- **AC-F15-30:** WHEN a person chooses a **background effect** (in Settings → Devices with the camera preview, on the pre-join screen, or during a call or meeting from the camera menu), THEN they can pick **None**, **Blur**, or one of at least **8 built-in pictures** (for example an office, a living room, a bookshelf, a café, nature, a city view and two calm abstract styles), as in Google Meet and Teams. They see it on their own preview before others do; the choice is remembered on that computer and applies in calls and meetings. The effect is made on their own computer: the video sent already has it, and no picture or video goes to any other service.
- **AC-F15-31:** WHEN a background effect is on and the computer can't keep the video smooth (under 15 frames a second for 5 seconds), THEN the app turns the effect off by itself and says why, so the call keeps working.
- **AC-F15-32:** WHEN a person opens **Settings → Calls**, THEN they can choose the **ringtone** for incoming calls from **5 ringtones** (each with a play button to hear it) and its volume; the choice is kept with their account (the same on every computer) and used by AC-F15-05. The default is the first ringtone.

### Screens and quality
- **AC-F15-17:** WHEN the screens of this feature are built (call buttons, calling screen, incoming call, Add people, chat notes, Settings → Devices with the preview and backgrounds, Settings → Calls with ringtones), THEN they match screen designs approved by the owner before the design stage (D029), follow Teams, and use the design system.
- **AC-F15-18:** WHEN those screens are used with the keyboard alone or a screen reader, THEN everything works: the incoming call takes focus and is announced, **Accept** and **Decline** are reachable without a mouse, and focus returns where it was when it closes. All text comes from the translation file; loading and error states are shown ("Couldn't start the call", with Retry).
- **AC-F15-26:** WHEN both people in a one-to-one chat start a call at the same moment, THEN only one call is created and both are joined to it, without ringing each other.
- **AC-F15-27:** WHEN the camera or microphone is missing, in use by another app or not allowed when starting or accepting a call, THEN the call still starts or is accepted with that device off, and the person sees F02's device message saying which one and how to fix it (AC-F02-10).
- **AC-F15-19:** WHEN the backend or call server can't be reached while starting, accepting or during a call, THEN the app says so within 10 seconds (F02 AC-46) and never leaves anyone ringing forever: ringing stops after at most 30 seconds even if the caller's app closed or lost its connection (the backend ends the ringing itself).

## Security & privacy
- **AC-F15-20 (S1, S2):** WHEN someone who isn't an accepted member of the chat tries to start, join, ring, add to or end a call of that chat through the backend, THEN they are refused like "not found", and they learn nothing about the call. Joining a chat's call needs the chat membership checked at that moment.
- **AC-F15-21 (S4):** WHEN someone joins a chat call, THEN their call-server permission is for that one call only, short-lived, and stops working when they leave, are removed from the chat, or the call ends (as F02 AC-49).
- **AC-F15-22 (S5):** WHEN a person starts, joins or answers calls, moves a call to another device, or rings people with Add people, THEN at most 10 a minute are allowed (clarified 2026-10-29: joining, answering and moving count too, so one person can't open seats over and over) (to stop someone ringing people over and over); further tries are refused with how long to wait.
- **AC-F15-23 (S10):** WHEN calls run, THEN logs and error reports never contain call-server permissions, audio, video or chat text; only ids and timings.
- **AC-F15-24:** WHEN a person has blocked an external person (F14 AC-13), THEN the blocked person can't start a call in their one-to-one chat (it is read-only, AC-F15-02) and the blocker's app never rings for a one-to-one call from them. In a group chat they share, group calls work for both as normal (as in Teams), and the blocked person is never told about the block.
- **AC-F15-25:** WHEN a person is removed from the chat, or leaves it or the workspace, during its call, THEN they are taken out of the call within 2 seconds (as F14 AC-18, 34).
- Encryption between the app and the call server and the desktop's camera/microphone/screen permission rules are the same as F02 (AC-F02-53, 54).
- **AC-F15-28:** WHEN a call ends, THEN only who started it, in which chat, who joined and left and when, and its length are kept (for the notes); no audio, video or recording (that is F05/F06). This is removed with the chat's messages (F14 AC-33, 35) and included in a person's data export (privacy-legal.md).

## Decisions made (following Teams, owner's standing instruction "match MS Teams if confused"; recorded as D070, D071)
- Ring for **30 seconds**; groups of **more than 20** don't ring (members join from the chat); a call from a chat holds at most **20 people** (larger groups use a meeting, F02, up to 100).
- Everyone in a chat call is equal (no organizer controls); one-to-one calls end when either person leaves.
- Being called during another call: you can accept, which leaves the other call (no hold).
- Status during any call: **In a call** (F14 showed "In a meeting"; one status for both from now on, D070).
- Backgrounds and blur run on the person's own computer with a free library (chosen in the design), so they cost nothing and send no video elsewhere; they apply to meetings too (F02 had left them out).
- Cost: none (the same call server and backend, D017). Load: the existing 25-person meeting load test covers a 20-person call.

## Out of scope
- Desktop/system notifications for incoming calls when the app is hidden or minimised, and ringing on a closed app: **F04 Desktop app**.
- Uploading one's own background picture: later (the built-in pictures and blur come now).
- Decline with a quick message ("I'm busy, will call back"): later.
- Phone numbers, voicemail, call transfer, hold, call history page ("Calls" app): later, if wanted.
- Recording, live captions and transcripts of calls: **F05/F06**.
- Calling people who aren't in a chat with you (from a contact card): later; for now start a chat first.
- Calls on web and mobile: **F10/F11**. F11 adds phone ringing (push) and transfer to and from the phone using AC-F15-33 and AC-F15-34 as they are (D075).

## Open questions
None.
