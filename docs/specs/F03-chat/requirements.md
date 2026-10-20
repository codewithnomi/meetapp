---
feature: F03
title: In-meeting chat
status: draft
updated: 2026-10-20
---

# F03 In-meeting chat: Requirements (WHAT)

## Goal
People in a meeting can write to everyone in it and share files and pictures, without leaving the call. The chat is kept with the meeting, so people can read it again afterwards and the AI features (F06, F07) can use it later.

## Who uses it
Everyone in a meeting, with the meeting roles and groups from F02 (organizer, co-organizer, presenter, attendee; workspace members, external people, guests).

## How it works, following Microsoft Teams (D053, D057)
- A **Chat** button in the meeting controls opens a chat panel at the side of the videos. A number on the button shows unread messages.
- **Meeting chat setting** (organizer or co-organizer, in Meeting options from F02, before or during the meeting): **On** (default), **In-meeting only** (people can chat only while the call is going on), or **Off**.
- **No private messages inside the meeting chat**, as in Teams (there, private one-to-one chat lives in the separate Chat tab; for us that is the "later" item in features.md). Owner's choice, 2026-10-20 (D057).
- **Guests** can read and write messages during the meeting but can't attach files, as in Teams (owner's choice, D057).
- **Files and pictures:** attach a file or picture (safe types only, up to 25 MB). Pictures show a small preview; other files show name, size and a Download button.
- **After the meeting:** workspace members and external people who took part can open the meeting's chat again from their meetings list, read-only (the full meetings library is F06). Guests lose access when they leave.

## User stories
- As a participant, I want to type a message to everyone, so that I can share a link or a comment without interrupting the speaker.
- As a participant, I want to send a file or picture, so that everyone can see the document we're talking about.
- As an organizer, I want to turn chat off or limit it to the meeting time, so that I keep control of my meeting.
- As a participant, I want to read the chat after the meeting, so that I don't lose links and files shared in it.

## Acceptance criteria

### Sending and seeing messages
- **AC-F03-01:** WHEN a person in the meeting sends a message, THEN every person in the meeting sees it within 1 second (95th percentile, including the 100-person load test; connections under 200 ms delay), with the sender's name (plus "(External)" or "(Guest)" as in F02), their picture or initials, and the time.
- **AC-F03-02:** WHEN someone joins (or a guest rejoins) a meeting that already has chat messages, THEN they see the meeting chat so far, oldest at the top, including messages sent before they joined: the newest 50 appear within 2 seconds and older ones load when scrolling up.
- **AC-F03-03:** WHEN a message is empty or only spaces, THEN it can't be sent; WHEN a message is longer than 4,000 characters, THEN it can't be sent and the person sees how many characters are too many.
- **AC-F03-04:** WHEN a message contains http or https web addresses, THEN they show as links that open in the normal web browser, never inside the app; other kinds of address (file:, javascript:, meetapp: and others) and all other text, including HTML and script code, show as plain text exactly as typed.
- **AC-F03-05:** WHEN a message doesn't reach the server within 10 seconds, THEN it stays in the chat marked "Not sent" with a **Retry** button; retrying or reconnecting never creates a second copy. WHEN a file upload is cut off, THEN it shows "Upload failed" with **Retry**, and no partial file is kept.
- **AC-F03-06:** WHEN a person sends more than 10 messages in 10 seconds, THEN further messages are refused for 10 seconds and the person sees "You're sending messages too fast. Try again in a few seconds."
- **AC-F03-07:** WHEN the chat panel is closed and a new message arrives, THEN the Chat button shows the number of unread messages (up to "99+"); WHEN the person opens the panel, THEN the number goes away.
- **AC-F03-08:** WHEN the chat panel is open and the person has scrolled up to older messages, THEN new messages don't jump the view; a "New messages" button takes them to the newest one.
- **AC-F03-09:** WHEN a meeting has no messages yet, THEN the panel shows "No messages yet".

### Editing and deleting
- **AC-F03-10:** WHEN, during the meeting, the sender edits their own message, THEN everyone sees the new text with "Edited". WHEN they delete it (after a confirmation), THEN everyone sees "This message was deleted" in its place, and its text and attachment are no longer stored. After the meeting ends, people can't edit or delete their messages.
- **AC-F03-11:** WHEN the organizer or a co-organizer deletes someone else's message (during or after the meeting, after a confirmation), THEN it is removed the same way as in AC-F03-10. Nobody can edit someone else's message.

### Files and pictures
- **AC-F03-12:** WHEN a person attaches a file of an allowed type up to 25 MB, THEN it is sent with the message; pictures (PNG, JPEG, GIF, WebP) show a small preview, other files show their name, size and a **Download** button. Allowed types: pictures above, PDF, plain text, CSV, and Word, Excel and PowerPoint documents. WHEN a preview can't be shown, THEN the file name and **Download** show instead.
- **AC-F03-13:** WHEN the file is larger than 25 MB, or its real content is not an allowed type (whatever its name says), THEN it is refused with "Files can be up to 25 MB" or "This kind of file can't be sent", and nothing is stored.
- **AC-F03-14:** WHEN someone downloads or previews a file, THEN it works only for people allowed to see that message; a download link copied out of the app stops working within 5 minutes. WHEN a person loses access (removed, guest left), THEN they get no new links. Files are never opened or run by the app; downloaded files are saved where the person chooses.
- **AC-F03-15:** WHEN a picture is shared, THEN the stored copy has its location and camera details removed.
- **AC-F03-16:** WHEN a guest is in the meeting, THEN no attach button is shown to them, and the server refuses any upload from a guest.
- **AC-F03-17:** WHEN a person tries to send more than 10 files in one minute, THEN it is refused with "You can send up to 10 files a minute"; WHEN the files of one meeting reach 500 MB in total, THEN further files are refused with "This meeting has reached its file limit".

### Meeting chat setting
- **AC-F03-18:** WHEN meeting chat is **Off**, THEN nobody can send messages or files, the panel says "Chat is turned off for this meeting", and messages already sent stay readable during and after the meeting.
- **AC-F03-19:** WHEN meeting chat is **In-meeting only** when the meeting ends, THEN afterwards only the organizer and co-organizers can open the chat (read-only); the messages stay stored with the meeting (AC-F03-26). The setting at the moment the meeting ends is the one that counts after it.
- **AC-F03-20:** WHEN the setting changes during a meeting, THEN everyone in the meeting sees it within 2 seconds, with a note in the chat: "<name> turned chat off", "<name> turned chat on" or "<name> limited chat to the meeting".
- **AC-F03-21:** WHEN a person who is not the organizer or a co-organizer tries to change the setting, THEN the server refuses it.

### Who can chat
- **AC-F03-22:** WHEN a person is in the lobby, THEN they can't see or send chat messages. WHEN they are let in, THEN AC-F03-02 applies.
- **AC-F03-23:** WHEN a person is removed from the meeting, THEN within 2 seconds they stop receiving messages and can't send any, and they can't open the chat afterwards.
- **AC-F03-24:** WHEN a guest leaves the meeting, THEN they can no longer see its chat (unless they rejoin while it is still going on, AC-F03-02).

### After the meeting
- **AC-F03-25:** WHEN a meeting has ended and chat was **On** or **Off** at the end, THEN workspace members and external people who were in it (and not removed) can open its chat read-only from their meetings list, including the files.
- **AC-F03-26:** WHEN a meeting record is deleted or expires (whenever F06/F10 deletes meetings), THEN its chat messages and files are deleted with it.
- **AC-F03-27:** WHEN a person deletes their account, THEN within 30 days their message text and files are removed and those messages show "Deleted user · message removed" (privacy-legal). WHEN a person asks for their data, THEN their own chat messages and files are included.

### Accessibility and languages
- **AC-F03-28:** WHEN a screen reader is used, THEN new messages are announced (sender and text), and the whole chat (open, write, send, attach, edit, delete) works with the keyboard only.
- **AC-F03-29:** WHEN the app language changes, THEN every chat label and message from the app is translated; people's own messages are shown as written.

## Security & privacy
- S2: chat and files never cross workspaces or meetings; every request is checked on the server against the person's place in that meeting.
- S11: every message is length-checked and shown only as plain text (only http/https links, opened outside the app).
- S12: files: allowed types checked by their real content, size limit, private storage, short-lived download links, never run.
- S14: chat text is data, not instructions, when F06 minutes and F07 Ask AI use it later; AI answers use only chats the asking person could open themselves.
- Messages and files are encrypted in transit and at rest like other meeting data. Nothing from chat goes to logs except counts and IDs.

## Out of scope
- Private messages and chat outside meetings (Teams' Chat tab), channels (features.md "later").
- Reactions to messages, replies in threads, @mentions with notifications (F04), GIF and sticker pickers, rich text formatting.
- Virus scanning of files: a **must-do before going online** (progress.md).
- Full meetings library and search (F06).

## Open questions
None (owner answered 2026-10-20, D057).
