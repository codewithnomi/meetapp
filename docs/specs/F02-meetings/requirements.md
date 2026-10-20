---
feature: F02
title: Meetings & calling
status: done
updated: 2026-10-14
---

# F02 Meetings & calling: Requirements (WHAT)

## Goal
People can start a video meeting at once or make a meeting link to share, and others join by link or by meeting ID and passcode. Inside the meeting they talk, see each other and share their screen, and the organizer keeps control: lobby, roles, mute, remove, lock and end. Up to 100 people per meeting, in the desktop app. This is the base for chat (F03), transcripts (F05) and minutes (F06).

## Who uses it
In a meeting everyone has one **meeting role**, as in Microsoft Teams:
- **Organizer:** the person who created the meeting (one per meeting).
- **Co-organizer:** has almost all the organizer's controls. Only the organizer can name co-organizers: up to 10, and only people in the meeting's workspace.
- **Presenter:** can share their screen and help run the meeting (see the table below). By default **everyone** joins as a presenter, as in Teams.
- **Attendee:** can talk, show video, raise a hand and react; can't share or manage others.

People who join belong to one of three groups:
- **Workspace members:** signed in and in the workspace the meeting belongs to.
- **External people:** signed in to MeetApp, but not in that workspace. Everyone sees "(External)" after their name.
- **Guests:** no account; they join with a link, or the ID and passcode, and type a name. Everyone sees "(Guest)" after their name (glossary).

## How it works, following Microsoft Teams (owner's choice, 2026-10-14)
The owner asked for meetings to work like Microsoft Teams, so people coming from Teams find nothing new. A Teams "organization" is a MeetApp workspace. Facts come from Microsoft's documentation ("Limits and specifications for Microsoft Teams", "Roles in Microsoft Teams meetings", "Manage lobby options"); see D053.
- **Two ways to make a meeting:**
  - **Meet now** starts a meeting at once.
  - **Get a meeting link** makes a meeting to join later and gives a link to share.
  - Meetings with a date and time are F13.
- **Join** with the link, or with the **meeting ID and passcode** shown under it.
- **Lobby:**
  - By default, workspace members join directly. External people and guests wait in the lobby until the organizer, a co-organizer or a presenter lets them in.
  - The organizer or a co-organizer can change who skips the lobby for each meeting.
- **Guests** can join unless the workspace's owner or an admin has turned guests off for the workspace. They wait in the lobby unless the meeting lets everyone skip it. Even then they can't start a meeting on their own: until someone with an account is in it, they wait in the lobby.
- **Expiry:**
  - A **Meet now** meeting stops working **60 days after it was created**.
  - A **link** meeting stops working **60 days after it was last joined or changed**; each join or change adds another 60 days.
  - After that, its link, ID and passcode no longer work.
- **A meeting lasts at most 30 hours.** It goes on when the organizer leaves, and ends when the last person leaves, or when the organizer or a co-organizer chooses **End meeting** for everyone.
- **After the meeting**, the people who took part (and the organizer and co-organizers) can see its record, as in Teams, where the meeting's details and recap belong to its participants.

## User stories
- As a workspace member, I want to start a meeting with one click and send the link, so that we can talk right now.
- As an organizer, I want a meeting link I can share for later, so that people can join when it is time.
- As a participant, I want to check my camera, microphone and speakers before joining and choose which ones to use, so that I don't join with the wrong device.
- As a participant, I want to see everyone in a grid, or the person speaking in large, and to pin someone, so that I can follow the conversation.
- As a presenter, I want to share my whole screen or one window, so that others see what I'm talking about.
- As an organizer, I want people from outside my workspace to wait until I let them in, and I want to mute, remove, lock and end, so that the meeting stays under control.
- As a guest without an account, I want to join with the link and my name, so that I can take part without signing up.
- As anyone on a weak connection, I want the call to recover by itself and show me my connection quality, so that a short drop doesn't throw me out.

## What each meeting role can do
| Action | Organizer | Co-organizer | Presenter | Attendee |
|---|---|---|---|---|
| Talk, video, raise hand, react, pin for themselves | ✓ | ✓ | ✓ | ✓ |
| Share screen | ✓ | ✓ | ✓ | – |
| Let people in from the lobby, or deny them | ✓ | ✓ | ✓ | – |
| Mute someone or everyone; lower someone's hand | ✓ | ✓ | ✓ | – |
| Remove someone from the meeting | ✓ | ✓ | ✓ | – |
| Make someone a presenter or attendee | ✓ | ✓ | ✓ | – |
| Meeting options (who skips the lobby, who can present, mics and cameras for attendees), lock | ✓ | ✓ | – | – |
| End the meeting for everyone | ✓ | ✓ | – | – |
| Name co-organizers | ✓ | – | – | – |

Nobody can remove the organizer or change their role.

## Acceptance criteria
Times are measured locally (`pnpm dev`) on the reference computer: the owner's MacBook Pro (Apple M4, 16 GB). Meetings with many people use simulated participants on the local call server.

### Making a meeting
- **AC-F02-01:** WHEN a signed-in user chooses **Meet now** in the open workspace, THEN a meeting titled "Meeting with <their name>" is created in that workspace with them as organizer, and they go to its pre-join screen. Inside the meeting, everyone can open **Meeting info** to see and copy the link, ID and passcode.
- **AC-F02-02:** WHEN a signed-in user chooses **Get a meeting link** and optionally types a title of up to 100 characters, THEN a meeting is created with them as organizer, and the app shows the link, meeting ID and passcode with Copy buttons, without joining it. The organizer can open its **Meeting options** before anyone joins.
- **AC-F02-03:** WHEN a meeting is created, THEN:
  - its link contains a random part of at least 128 bits;
  - its meeting ID is 12 digits, and its passcode is 6 letters and digits;
  - the link alone, or the ID and passcode together, lead to that meeting only.
- **AC-F02-04:** WHEN a **Meet now** meeting is 60 days old, or a link meeting hasn't been joined or changed for 60 days, THEN its link, ID and passcode stop working, and anyone using them is told "This meeting has expired". Only getting into the call counts as joining (waiting in the lobby or being denied doesn't). Changing the title or a meeting option counts as a change.
- **AC-F02-05:** WHEN a user creates meetings, THEN they can create at most 50 an hour; after that they are told how long to wait (S5).
- **AC-F02-06:** WHEN a meeting is made in a **personal workspace**, THEN the person whose workspace it is is the only workspace member. Everyone else joins as an external person or guest, through the lobby by default, and nobody can be named co-organizer. The workspace's own user decides whether guests are allowed.
- **AC-F02-07:** WHEN the organizer leaves the meeting's workspace (or is removed from it), THEN their meetings in that workspace stop working, like expired ones.

### Joining
- **AC-F02-08:** WHEN anyone pastes a meeting link, or types a meeting ID and passcode, under **Join a meeting**, THEN they reach the pre-join screen showing the meeting's title. This works signed in, or as a guest from the sign-in screen. A wrong or unknown link, ID or passcode shows "We couldn't find that meeting. Check the link, or the ID and passcode." with no further detail. The right link, or the right ID and passcode, of an expired meeting shows "This meeting has expired" (AC-04); only someone who already has them learns that.
- **AC-F02-09:** WHEN someone is on the pre-join screen, THEN they:
  - see their own camera preview, a microphone level meter and a **Test speakers** sound;
  - can choose the camera, microphone and speakers;
  - can turn the camera and microphone off before joining.

  Their choices are remembered on this computer for next time.
- **AC-F02-10:** WHEN the camera or microphone is missing, in use by another app, or not allowed by the computer, THEN the pre-join screen says which one and how to fix it (for example "MeetApp isn't allowed to use the camera: open System Settings → Privacy & Security → Camera"), and the person can still join without it.
- **AC-F02-11:** WHEN a guest joins, THEN they type a name of 1–60 characters. The pre-join screen says "By joining, you agree to the Terms and the Privacy Policy" (as plain text until those documents exist, D051).
- **AC-F02-12:** WHEN someone presses **Join now** and may enter directly, THEN within 3 seconds they are in the meeting, hearing and seeing the others (quality-targets.md).
- **AC-F02-13:** WHEN the same account joins from two computers, THEN it appears as two participants, as in Teams.

### Lobby
- **AC-F02-14:** WHEN people join a meeting with the default lobby setting, THEN workspace members enter directly. External people and guests wait in the lobby with "Someone in the meeting will let you in soon". People in the lobby see only the meeting's title, never who is in it.
- **AC-F02-15:** WHEN people are waiting, THEN the organizer, co-organizers and presenters (only they) see a notice with how many are waiting and their names with "(External)" or "(Guest)". They can **Admit**, **Deny** or **Admit all**.
  - An admitted person enters the meeting.
  - A denied person is told "You've been denied entry" and leaves.
- **AC-F02-16:** WHEN the organizer or a co-organizer changes **Who can skip the lobby**, THEN the change applies to everyone who joins from then on. The choices are:
  - **Everyone**;
  - **People in my workspace** (default);
  - **Only me and co-organizers**.
- **AC-F02-17:** WHEN only guests have come and nobody with an account is in the meeting, THEN the guests wait in the lobby until someone with an account joins, whatever the setting.
- **AC-F02-18:** WHEN someone has waited in the lobby for 15 minutes without being let in, THEN they are told "Nobody let you in" and leave the lobby (as in Teams). When the last person leaves the meeting, people in the lobby keep waiting (AC-F02-17 applies).
- **AC-F02-19:** WHEN a meeting's lobby holds 100 people, THEN further people trying to wait are told "This meeting is full".

### In the meeting
- **AC-F02-20:** WHEN a meeting has 100 participants with cameras on (99 simulated), THEN the tester's app:
  - shows a gallery page of 16 videos that keep moving smoothly (each shows at least 90% of the frames it receives; small tiles receive 15 frames a second, as in Teams, D056), with pages for the rest;
  - hears any speaker with under 250 ms delay (quality-targets.md).

  **Speaker view** shows the person speaking in large. A person can **pin** one participant in large, for themselves only.
- **AC-F02-21:** WHEN someone speaks, THEN their video or picture is highlighted within half a second. The highlight never relies on color alone, and screen readers can hear who is speaking.
- **AC-F02-22:** WHEN someone mutes or unmutes their microphone, or turns their camera on or off, THEN everyone sees the change within 1 second. They can do it with the button or a keyboard shortcut.
- **AC-F02-23:** WHEN someone raises their hand, THEN it shows on their video and in the participant list, in the order hands were raised. They, or an organizer, co-organizer or presenter, can lower it.
- **AC-F02-24:** WHEN someone sends a reaction (like, love, applause, laugh, surprised), THEN it shows on their video for 3 seconds for everyone.
- **AC-F02-25:** WHEN the organizer, a co-organizer or a presenter shares their **whole screen or one window**, THEN everyone sees it large within 2 seconds.
  - Only one person shares at a time: a new share replaces the current one, and the person whose share ended is told.
  - Attendees don't have the Share button.
- **AC-F02-26:** WHEN the participant list is open, THEN it shows everyone in the meeting with their role, microphone and camera state, a raised hand, and "(External)" or "(Guest)" where they apply. The organizer, co-organizers and presenters also see the lobby there.
- **AC-F02-27:** WHEN people from outside a workspace are in its meeting, THEN they see each member's name, but never their email. They see a member's photo only if they share a workspace with that member (F01 AC-25); otherwise they see initials.
- **AC-F02-28:** WHEN a participant's connection is weak (over 5% packet loss or over 300 ms delay for 5 seconds), THEN a connection-quality indicator shows it on their own screen. WHEN their bandwidth drops, THEN video quality is lowered, or video turned off, before audio suffers.
- **AC-F02-29:** WHEN someone's connection drops for up to 30 seconds, THEN the app reconnects by itself, within 10 seconds of the network coming back. They are back in the same meeting with the same role, without going through the lobby again, even if the meeting was locked meanwhile.
  - WHEN the connection is lost for longer, THEN they see "You've lost connection" with **Rejoin**, and the others see them leave.
- **AC-F02-30:** WHEN someone's microphone is on, THEN noise suppression is on by default (the free kind built into the calling engine), and they can turn it off in the meeting's device settings.
- **AC-F02-31:** WHEN the camera, microphone or speakers in use are unplugged or changed during the meeting, THEN within 2 seconds the app moves to the computer's default device and says which one changed. People can choose devices in the meeting's device settings at any time.
- **AC-F02-32:** WHEN someone chooses **Leave**, THEN they leave and the others see it at once. WHEN their app closes or crashes, or their computer sleeps, THEN the others see them leave within 30 seconds. The meeting goes on for everyone else.

### Organizer, co-organizer and presenter controls
- **AC-F02-33:** WHEN the organizer, a co-organizer or a presenter chooses **Mute** for someone, or **Mute all**, THEN those microphones turn off. **Mute all** never mutes the person who chose it. Muted people are told who muted them, and can unmute themselves unless AC-F02-34 applies.
- **AC-F02-34:** WHEN the organizer or a co-organizer turns off **Allow mic for attendees** or **Allow camera for attendees**, THEN attendees can't turn their microphone or camera on until it is turned back on or they are made presenters. It doesn't affect presenters, co-organizers or the organizer.
- **AC-F02-35:** WHEN the organizer, a co-organizer or a presenter chooses **Remove from meeting** for someone, THEN that person leaves the meeting at once and is told. If they join again with the same account (for a guest: from the same app on the same computer), they wait in the lobby whatever the lobby setting.
- **AC-F02-36:** WHEN roles or presenting rights change, THEN the new rights apply at once, and a person who loses presenter rights stops sharing. The changes are:
  - the organizer, a co-organizer or a presenter makes someone a presenter or attendee;
  - the organizer names or un-names a co-organizer (workspace members only, up to 10);
  - the organizer or a co-organizer changes **Who can present** to **Everyone** (default), **People in my workspace** or **Only me and co-organizers**.
- **AC-F02-37:** WHEN the organizer or a co-organizer **locks** the meeting, THEN until someone unlocks it:
  - nobody new can join, and people trying are told "This meeting is locked";
  - people in the lobby are told the same and leave;
  - anyone who leaves can't rejoin, except the organizer and co-organizers.
- **AC-F02-38:** WHEN the organizer or a co-organizer chooses **End meeting** and confirms, THEN everyone, the lobby included, leaves at once and is told "The meeting has ended". A link meeting can be joined again later, until it expires; a new call then starts.
- **AC-F02-39:** WHEN the last person leaves, or a meeting reaches 30 hours, THEN the call ends. Ten minutes before 30 hours, everyone sees a notice.
- **AC-F02-40:** WHEN a workspace's owner or an admin turns off **Allow guests** in the workspace settings, THEN guests can't join its meetings ("This meeting doesn't allow guests"). Organizers can't override it for one meeting. Guests already in the lobby are told the same; guests already inside stay.

### Records, screens and limits
- **AC-F02-41:** WHEN a call ends, THEN the meeting record keeps its title, workspace, organizer, start and end time, and who took part with when they joined and left (only the name for guests).
  - Only the people who took part, the organizer and the co-organizers can see it later; F06 shows it.
  - Audio and video are **not** recorded.
- **AC-F02-42:** WHEN a meeting has 100 people in it, THEN the next person trying to join is told "This meeting is full (100 people)".
- **AC-F02-43:** WHEN the screens of this feature are built, THEN they match screen designs approved by the owner (designed and approved before the design stage, D029). These screens are:
  - Meet now, Get a meeting link and Join a meeting;
  - pre-join, lobby and the meeting itself;
  - the participant list, meeting info and meeting options;
  - the in-meeting device settings;
  - the **Allow guests** switch in workspace settings.
- **AC-F02-44:** WHEN those screens are used with the keyboard alone, THEN everything works, with shortcuts for microphone and camera. Changes such as someone joining, a hand raised or being muted are announced to screen readers.
- **AC-F02-45:** WHEN those screens load or fail, THEN they show loading and error states, and all text comes from the translation file.
- **AC-F02-46:** WHEN the backend or the call server doesn't answer within 10 seconds while creating, joining or during a meeting, THEN the app shows "Can't reach MeetApp. Check your connection." with **Retry**. Pressing a button twice never creates two meetings.
- **AC-F02-47:** WHEN a 25-person video meeting runs on the reference computer, THEN the desktop app uses under 700 MB of memory (quality-targets.md, D056).

## Security & privacy
Rules that apply (docs/architecture/security.md): S1, S2, S3, S4, S5, S6, S10, S11, S17, with D040.
- **AC-F02-48 (S3, S5):** WHEN anyone tries meeting links, IDs or passcodes, THEN at most 20 wrong tries a minute are allowed per person or network address. A wrong one reveals nothing about whether the meeting exists, and a meeting's lobby holds at most 100 people (AC-F02-19).
- **AC-F02-49 (S4):** WHEN someone is let into a meeting, THEN their permission to use the call server:
  - covers that one meeting only, with only their role's rights (an attendee can't share a screen even by calling the call server directly);
  - when they are removed or the meeting ends, disconnects them within 5 seconds, and can't be reused to come back;
  - if never used, stops working after 10 minutes.
- **AC-F02-50 (S1, S2):** WHEN someone who isn't a participant, the organizer or a co-organizer uses the backend directly, THEN they can't see or change the meeting's record, settings or participant list. A person joining sees only the meeting's title and their own lobby status.
- **AC-F02-51 (S11):** WHEN names or titles contain HTML or script, THEN they are shown as plain text everywhere.
- **AC-F02-52 (S10):** WHEN meetings run, THEN logs and error reports never contain:
  - call-server permissions (tokens);
  - passcodes or the secret part of links;
  - audio or video.
- **AC-F02-53 (S6):** WHEN audio, video or screens are sent, THEN they are encrypted between the app and the call server (the standard for calls), and the connection that sets up calls is encrypted everywhere except on this computer during development. End-to-end encryption, where even the call server can't see the media, is not part of F02.
- **AC-F02-54 (S17, D040):** WHEN the app asks for the camera, microphone or screen, THEN the desktop app allows it only for MeetApp's own screens and only those three; the only other permission is writing to the clipboard for MeetApp's own Copy buttons (reading it stays refused). Everything else stays refused, and the desktop's safety settings stay on (context isolation, sandbox, no Node.js in the page). Screen sharing starts only after the person picks a screen or window from MeetApp's own list with previews. A missing macOS screen-recording permission is explained.
- **Privacy:** what F02 stores is added to privacy-legal.md:
  - meeting records with participant names and times, and guests' names;
  - link and passcode, stored so they can't be read back from the database.

  How long records are kept and who can delete them come with F06 and F10 (S9).

## Cost
No paid service. Development and tests use the local call server (LiveKit) with simulated participants. Calls with people on other networks need the call relay and a domain when going online (D023); LiveKit Cloud's free tier is an option for trying that earlier (D025). Noise suppression is the free kind built into the calling engine, not a paid add-on.

## Out of scope
- Chat in meetings (F03); opening `meetapp://` links from the browser, and desktop notifications such as "someone is waiting" (F04); meetings with a date and time, invitations, and the lobby option "People who were invited" (F13).
- Recording, live captions and transcripts (F05); minutes, the meeting library screens, and deleting meeting records (F06, F10).
- Joining from a web browser or a phone (F10, F11), phone dial-in, the call relay for strict firewalls (when going online), and Teams' "trusted organizations".
- Breakout rooms, spotlight for everyone, whiteboard, polls, virtual or blurred backgrounds, sharing computer sound, remote control, webinars, hiding attendee names, and turning reactions off.

## Defaults chosen (the owner may change them)
The owner chose to follow Microsoft Teams for the lobby, guests, link expiry and meeting roles (2026-10-14); these points follow Teams or quality-targets.md:
- lobby, guests, expiry, 30-hour limit, 15-minute lobby wait, roles, co-organizers (up to 10, named by the organizer);
- "Who can present: Everyone" by default (so admitted guests can also let people in and mute others, as in Teams);
- the meeting record visible to its participants.

Claude's sensible defaults are:
- 16 videos per gallery page;
- 50 new meetings an hour;
- 20 wrong join tries a minute;
- 100 people in the lobby;
- the reference computer (the owner's MacBook Pro M4, 16 GB).

## Open questions
None.
