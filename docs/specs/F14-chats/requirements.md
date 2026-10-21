---
feature: F14
title: Chats (one to one and groups)
status: approved
updated: 2026-10-21
---

# F14 Chats (one to one and groups): Requirements (WHAT)

## Goal
People talk to each other every day in MeetApp, not only in meetings: one-to-one and group chats that stay, a chat list like the Teams **Chat** screen, and meeting chats in the same place (D062). Everything works as in Microsoft Teams (owner, 2026-10-21).

## Who uses it
- **Members of a team workspace** (owner, admins, members): chat with each other, and with people outside the workspace unless an admin turned that off.
- **People in their Personal workspace** (personal use, like Teams Free): chat with anyone who accepts their chat request.
- **People outside a workspace** who receive a chat: they accept or block it first.
- **Workspace owner and admins:** decide whether members may chat with people outside the workspace.
- Guests (no account) don't use chats; they only chat inside meetings (F03).

## How chats fit workspaces (as in Teams)
- A chat belongs to the workspace that is open when it starts, as Teams chats belong to an organization. Switching workspace switches the chat list.
- In a **team workspace**, members chat with each other at once. A person outside the workspace (any MeetApp account, found by email) is **external**: they receive a **chat request** and appear with "(External)".
- In the **Personal** workspace, everyone is external: every new contact starts with a chat request, as in Teams Free.
- Chatting never makes anyone a member of a workspace: the Personal workspace still has only its owner (F01 AC-F01-14).
- **Where outside chats show for the receiver:** chat requests and accepted chats from outside a workspace appear in the receiver's **Personal** workspace chat list (their home, like Teams' home organization). For the sender they stay in the workspace they were started in.

## User stories
- As a member, I want to message a colleague one to one and see their answer at once, so we don't need email.
- As a member, I want a group chat with a name, so a small team can talk in one place.
- As a personal user, I want to message a friend by email, and they decide whether to accept, so strangers can't flood me.
- As anyone, I want a chat list with unread counts, filters and the latest message, so I see what needs my attention.
- As an admin, I want to turn off chat with people outside our workspace, so company talk stays inside.
- As anyone, I want all the meeting-chat tools (formatting, emoji, GIFs, files, reactions, replies, pins, polls) in my chats too.

## Acceptance criteria

### Chat list (left side, like the Teams Chat screen)
- **AC-F14-01:** WHEN a signed-in person opens **Chat** in the side menu, THEN the list shows their chats in the open workspace, newest activity first, each with the picture or initials (a group shows its members' initials), the name (the other person, or the group's name, or its members' names when unnamed), the last message's first line with its sender ("You:" for their own), and its date or time (time today, weekday this week, date before).
- **AC-F14-02:** WHEN a chat has messages the person hasn't seen, THEN its name and last line show in bold with an unread count, and the side menu's **Chat** item shows the number of chats with unread messages (up to "99+").
- **AC-F14-03:** WHEN the person picks a filter, THEN **Unread** shows only chats with unseen messages, **Chats** shows one-to-one and group chats, and **Meeting chats** shows the chats of meetings they took part in (F03, with F03's reading rules). With no filter, all three kinds show together.
- **AC-F14-04:** WHEN the person types in the list's search box, THEN chats whose name or members' names contain every typed word (ignoring upper/lower case and accents) show (people's names only, not message text).
- **AC-F14-05:** WHEN the person pins a chat (up to 15) or unpins it, THEN pinned chats stay at the top of the list in the order pinned. WHEN they mute a chat, THEN its new messages still count as unread but make no sound or notification (notifications themselves arrive with F04).
- **AC-F14-06:** WHEN the person has no chats yet, THEN the list says "No chats yet" with a **New chat** button.

### Starting a chat
- **AC-F14-07:** WHEN the person chooses **New chat** and types names or emails in **To:**, THEN suggestions show the workspace's members by name, and an exact email of any MeetApp account; choosing one person opens their one-to-one chat (the existing one if it exists), choosing two or more starts a group chat.
- **AC-F14-08:** WHEN the email typed has no MeetApp account, THEN the app says "No one with this email uses MeetApp yet" and offers to **invite them** by email (F01's invitation in a team workspace, with F01's rules on who may invite; a "Join me on MeetApp" email in Personal). Nothing is sent until the person confirms. As in Teams, typing an exact email shows whether it has an account (owner decision D063; limited to 30 lookups a minute per person, and only for an exact email).
- **AC-F14-09:** WHEN a one-to-one chat is opened with someone, THEN there is only ever one one-to-one chat between the same two people in the same workspace.

### Chat requests (people outside the workspace, and Personal)
- **AC-F14-10:** WHEN someone starts a chat with an external person (AC-F14-07), THEN that person sees it under **Chat requests** with the sender's name, email and "(External)", and can **Preview** the messages before deciding. The sender's chat says "Waiting for <name> to accept".
- **AC-F14-11:** WHEN the receiver chooses **Accept**, THEN both can chat normally and see each other's status. WHEN they choose **Delete**, THEN the request disappears for them and the sender sees nothing changed; Delete offers **Block** too; the sender can't send a new request to the same person for 30 days.
- **AC-F14-12:** WHEN a sender's request is not yet accepted, THEN they can send at most 10 messages into it; the 11th is refused with "You can send more once <name> accepts". A person can send at most 20 new chat requests a day. A request not answered within 30 days disappears for the receiver, and the sender's chat says "<name> didn't accept".
- **AC-F14-13:** WHEN a person blocks an external person (as in Teams, colleagues in the same team workspace can't be blocked), THEN the blocked person can't start chats or send messages to them, and doesn't see their status; an accepted chat between them becomes read-only for both; the blocked person is not told. In group chats they share, both still see each other's messages (as in Teams). The blocker can unblock in **Settings → Privacy → Blocked people**.
- **AC-F14-14:** WHEN an external person is added to a group chat, THEN the group's members see "(External)" next to their name, and the external person receives a request for that group; Preview shows only messages sent after they were added; if they delete the request, they are not in the group and members see "<name> didn't join".

### Group chats
- **AC-F14-15:** WHEN a group chat is created, THEN it has 3 to 250 people (including the creator); a 251st can't be added and the app says the limit.
- **AC-F14-16:** WHEN any member names or renames the group (1–80 characters), THEN everyone sees the new name and a note "<name> named the group <new name>".
- **AC-F14-17:** WHEN a member adds people, THEN they choose whether the new people see **no history**, **the last 1 to 365 days**, or **all history** (the default, as in Teams); a note says "<name> added <names>".
- **AC-F14-18:** WHEN a member removes someone, or someone leaves, THEN that person stops receiving messages at once (within 2 seconds), keeps reading what they saw until they were removed, and a note says so. Any member may add or remove anyone, the creator included, as in Teams group chats. A group stays a group when members drop to 2 or 1; WHEN the last member leaves, THEN the group, its messages and files are deleted within 30 days.

### Messages in chats
- **AC-F14-19:** WHEN a person writes in a chat, THEN they have everything meeting chat has (F03): rich text and code, links, emoji, GIFs and stickers (the workspace's GIF setting applies), files (25 MB each, the same safe types, 10 a minute per person, at most 2 GB per chat), reactions (one per person), replies, pins (up to 3; any member can pin or unpin), polls (any member can create one; its creator closes it), and the same limits (4,000 characters, 10 messages in 10 seconds).
- **AC-F14-20:** WHEN a person sends a message, THEN everyone in the chat who has MeetApp open sees it within 1 second (95% of messages, also in a 250-person group); people who are offline see it when they next open the app, in the right order.
- **AC-F14-21:** WHEN a person edits or deletes their own message, THEN it changes for everyone ("Edited", or "This message was deleted"); in chats this works at any time (meeting chats keep F03's rule).
- **AC-F14-22:** WHEN a person types `@` and a name, THEN they can mention a member of the chat; the mentioned person sees the mention highlighted and the chat counts it as unread even if muted.
- **AC-F14-23:** WHEN someone is typing in a chat, THEN the others see "<name> is typing…" within 1 second; it disappears 5 seconds after they stop.
- **AC-F14-24:** WHEN a message has been read, THEN in one-to-one chats and groups of up to 20 people the sender sees "Seen" (in groups, pointing at or focusing "Seen" lists who has seen it; groups of 21–250 show no read receipts), unless the reader turned off **Read receipts** in Settings; then they don't show their own and don't see others' (as in Teams).
- **AC-F14-25:** WHEN a message can't be sent (no connection), THEN it shows "Not sent" with **Retry**, as in F03; it is never sent twice.

### Status (presence)
- **AC-F14-26:** WHEN people are listed (chat list, chat header, To: suggestions), THEN each shows a status dot set automatically: **Available** (a key or mouse action in MeetApp within the last 5 minutes), **Away** (no action for 5 minutes, or the computer locked), **In a meeting** (in a call), **Offline** (app closed or signed out). Status is seen only by colleagues in the same workspace and by accepted external contacts; blocked people and pending requests see none.

### Workspace setting
- **AC-F14-27:** WHEN the owner or an admin turns off **Chat with people outside the workspace** (Workspace settings; on by default, as in Teams), THEN members can't start new chats with external people, external people can't start chats with members in this workspace, and existing external chats (and group chats with external people) become read-only with a note; turning it back on makes them writable again.

### Leaving a workspace, keeping chats
- **AC-F14-34:** WHEN a person is removed from a team workspace or leaves it, THEN within 2 seconds they leave all its chats ("<name> left"), can no longer open them, and their one-to-one chats there become read-only for the other person with "This person is no longer in the workspace".
- **AC-F14-35:** WHEN chats exist, THEN they are kept until their members delete them (a person may **Hide** a chat for themselves; a group is deleted when its last member leaves); WHEN a team workspace is deleted, THEN its chats and files are removed within 30 days.

### Meeting chats in the list
- **AC-F14-28:** WHEN a person took part in a meeting whose chat they may read (F03 AC-42), THEN it appears in the chat list under the meeting's title with a calendar picture; during a running call it opens the live chat, afterwards the read-only chat (F03 rules).

### The side menu
- **AC-F14-36:** WHEN a person presses the menu button at the top of the side menu, THEN the menu folds to icons only (Home, Chat, Meetings, People, Settings, and the workspace's letter), each showing its name in a tooltip when pointed at or focused, with the Chat unread count on its icon; pressing it again unfolds it. The choice is remembered on this computer (owner, 2026-10-21, as in Teams).

### Quality
- **AC-F14-29:** WHEN the person opens a chat, THEN its newest messages show within 1 second, and older ones load while scrolling up (50 at a time), as in F03.
- **AC-F14-30:** WHEN the whole chat feature is used with the keyboard only or a screen reader, THEN every step works and new messages in the open chat are announced (F03 AC-45); every label comes from the translation file.

## Security & privacy
- **AC-F14-31 (S1, S2):** WHEN someone who is not a member of a chat (or not in its workspace, unless external and accepted) uses the backend directly, THEN they can't read it, send to it, see its members, files or status; every refusal looks the same as "not found".
- **AC-F14-32 (S10):** WHEN chats are used, THEN message text, file names and people's emails never appear in logs.
- **AC-F14-33:** WHEN a person deletes their account, THEN their chat messages and files are removed within 30 days ("Deleted user · message removed"), as in F03 AC-44; their pending chat requests are withdrawn at once; they show as "Deleted user" in lists and group members; groups they created keep working; one-to-one chats with them become read-only; WHEN they ask for their data, THEN their own chat messages and files are included.
- Searching a person by email shows only that one exact account (never a list of emails), so emails can't be harvested; at most 30 lookups a minute per person.
- Files follow F03's rules (checked by content, pictures cleaned, 5-minute links, virus scanning before going online).

## Out of scope
- Calls from a chat (audio, video, ringing): **F15**.
- Desktop notifications and sounds: **F04** (F14 shows unread counts inside the app).
- Teams-style **teams and channels**: later (after F14).
- Searching message text across chats: with **Ask AI** (F07).
- AI writing help, reply suggestions ("Any time", "Cheers!") and translation: later AI ideas (features.md).
- Setting a status by hand (Busy, Do not disturb, a status message): later; F14's status is automatic.
- SMS participants and phone numbers: not planned.
- Chatting with people who have no MeetApp account (they are invited instead, AC-F14-08).
- Admins reading or exporting members' chats (compliance tools): later, with F10's admin features.

## Open questions
- None. Owner, 2026-10-21: follow Teams for contacts and outside chat; 250 people per group; read receipts on, each person can turn them off. Decided by following Teams (owner: "we will follow the same flow"): outside chats show in the receiver's Personal list; an exact email shows whether it has an account (D063); only outside people can be blocked; any group member adds or removes anyone; inviting people without an account follows F01's rules; no admin chat export in F14.
