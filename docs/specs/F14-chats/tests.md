---
feature: F14
title: Chats (one to one and groups)
status: draft
updated: 2026-10-21
---

# F14 Chats: Test Cases

Written **before** the code. Each test case becomes an automated test.
Levels: unit · integration · security (integration-style attempts to break rules) · e2e (desktop: real Electron windows, Playwright) · load · visual (Storybook screenshots).

Test names must include the TC and AC IDs, e.g. `TC-F14-19 [AC-F14-11] Delete hides the request and starts a 30-day wait`.

**Test set-up (design.md "Test approach"):**
- Integration and security tests use real PostgreSQL and Redis (and RustFS for files). The live line is tested with `injectWS`, and with two API server instances for fan-out. The GIF service is the F03 fake local server.
- Seeded people as in F02/F03: workspace W1 (owner, admin A1, members M1, M2, M3) and W2 (member X1, owner of W2). Everyone also has a Personal workspace (P-M1, P-X1, ...). External person E1 (account, member of W2 only). Y1: an account with no workspace except Personal. Outsider = signed-in user not in the chat. "Same answer" = same status code, body shape and message as "not found".
- Time rules (30-day expiry, 30-day cooldown, daily limit, 5-minute links, 30-day deletion, typing 5 s) use a fake clock on the server and in unit tests.
- Desktop e2e uses 2 or 3 Electron windows with Playwright (as F02/F03).
- Load cases run with `pnpm test:load`. Visual cases run with `pnpm test:visual`.
- F03's fixtures in `apps/api/test/fixtures/chat/` are reused.
- The whole F03 chat test suite must keep passing unchanged (TC-F14-35, TC-F14-80).

## Test cases

### Chat list

### TC-F14-01: List content, order and names
- **Covers:** AC-F14-01
- **Level:** integration
- **Given** M1 has a one-to-one chat with M2, an unnamed group with M2 and M3, a group named "Launch", and chats with different last-message times in W1 and one chat in W2
- **When** M1 loads the list of W1
- **Then** only W1 chats show, newest activity first; names are the other person, the group name, or the members' names when unnamed; the last line is the first line of the last message with its sender ("You:" for M1's own); a group's avatar data holds its members' initials; the W2 chat is absent from W1 and present in W2's list

### TC-F14-02: Date and time label
- **Covers:** AC-F14-01
- **Level:** unit
- **Given** the label function with a fixed clock
- **When** given a time today, 3 days ago (this week), and 10 days ago
- **Then** it returns the time, the weekday name, and the date; labels come from the translation file and the locale

### TC-F14-03: Unread counts and the Chat badge
- **Covers:** AC-F14-02
- **Level:** integration
- **Given** M1 has 3 chats: A with 2 unseen messages from others, B fully read, C with 120 unseen
- **When** M1 loads the list, then reads A through `PUT /read`
- **Then** A shows count 2, C shows its count, B none; the "chats with unread" total is 2 (3 chats with unread would show "99+" only when above 99); after reading A the total is 1; M1's own messages never count as unread; with 100 chats unread the badge value is "99+"

### TC-F14-04: Unread look and badge
- **Covers:** AC-F14-02
- **Level:** e2e
- **Given** M1 and M2 in two windows, M1 on the Home page
- **When** M2 sends M1 a message, then M1 opens the chat
- **Then** the Chat item in M1's side menu shows 1, M1's list row is bold with the count 1; after opening the chat the bold and the badge disappear

### TC-F14-05: Filters
- **Covers:** AC-F14-03
- **Level:** integration
- **Given** M1 has a direct chat with unread, a read group, a W1 meeting chat M1 attended, and a meeting chat M1 did not attend
- **When** M1 lists with no filter, `unread`, `chats`, `meetings`
- **Then** no filter shows the three allowed chats (not the unattended meeting); Unread shows only chats with unseen messages (any kind); Chats shows direct and groups only; Meeting chats shows only the attended meeting

### TC-F14-06: Name search ignores case and accents
- **Covers:** AC-F14-04
- **Level:** unit
- **Given** the name matcher and a chat with members "José Álvarez" and "Anna Lee"
- **When** searching "jose", "ALVAREZ jose", "lee anna", "jose lee", "joseph"
- **Then** the first four match (every word must be contained, any order, accents and case ignored); "joseph" does not

### TC-F14-07: Search covers names only
- **Covers:** AC-F14-04
- **Level:** integration
- **Given** a chat with M2 whose message text contains "budget", and a group named "Café team"
- **When** M1 searches `q=budget` and `q=cafe`
- **Then** "budget" finds nothing; "cafe" finds the group; the search runs with `unaccent` in the database

### TC-F14-08: Pin, unpin and the 15-pin limit
- **Covers:** AC-F14-05
- **Level:** integration
- **Given** M1 has 16 chats
- **When** M1 pins 15 chats one by one, tries a 16th, unpins one and pins another
- **Then** the 16th is refused with `CHAT_PIN_LIMIT`; pinned chats come first in the order pinned (unpinning removes it, the new pin goes last); other chats follow by last activity

### TC-F14-09: Mute keeps unread, no notification flag
- **Covers:** AC-F14-05, AC-F14-22
- **Level:** integration
- **Given** M1 muted a chat with M2
- **When** M2 sends a normal message, then a message that mentions M1
- **Then** both count as unread for M1; the list item says `muted`; the app's sound/alert hook is not called for the first (notifications themselves arrive with F04); the mention is marked as a mention for M1

### TC-F14-10: Empty list
- **Covers:** AC-F14-06
- **Level:** e2e
- **Given** a new member with no chats
- **When** they open Chat
- **Then** the list says "No chats yet" with a **New chat** button that opens the New chat screen

### Starting a chat

### TC-F14-11: Suggestions in To:
- **Covers:** AC-F14-07
- **Level:** integration
- **Given** W1 with M1, M2, M3 (title "Designer"), and E1 outside
- **When** M1 asks `people?q=des` and `q=m2name`
- **Then** members matching by name come back with title and status; E1 and people of W2 do not appear for a name search; an outsider's name is never listed

### TC-F14-12: One person opens the direct chat, two or more make a group
- **Covers:** AC-F14-07, AC-F14-09
- **Level:** integration
- **Given** M1 and M2 with no chat
- **When** M1 posts `{userIds:[M2]}` twice, then `{userIds:[M2, M3]}` with and without a name
- **Then** the first two calls return the same direct conversation (second marked existing); the third makes a group (named or unnamed) of 3 members; the two-person call never makes a group

### TC-F14-13: Email with no account, invite on confirmation
- **Covers:** AC-F14-08
- **Level:** integration
- **Given** an email nobody uses
- **When** M1 (in W1) looks it up, then confirms the invite; and the same in M1's Personal workspace
- **Then** the lookup says no account and nothing is sent; only on confirmation F01's invitation is created in W1 (and F01's rule about who may invite applies: a plain member without invite rights is refused as in F01); in Personal `POST /me/invitations` sends the "Join me on MeetApp" email; 20 a day per person, the 21st is refused

### TC-F14-14: Email lookup returns one account only and is limited
- **Covers:** AC-F14-08, AC-F14-31
- **Level:** security
- **Given** several accounts
- **When** M1 types partial emails ("ann", "@gmail.com", "a*"), then an exact email, then makes 31 exact lookups in a minute
- **Then** partial emails return nothing; an exact email returns only that account's name and picture (no email list, no ids of others, same-looking shape for a blocker); the 31st lookup in a minute is refused with 429; after the window it works again; the lookup is logged as the searcher's id and a count, never the email

### TC-F14-15: Direct chat is unique under a race
- **Covers:** AC-F14-09
- **Level:** integration
- **Given** M1 and M2 with no chat
- **When** both start a chat with each other at the same moment, 20 times in parallel
- **Then** exactly one conversation exists per pair per workspace (unique `direct_key`), both get the same id; the same pair in W2 or Personal gets a different conversation

### Chat requests and blocking

### TC-F14-16: External start creates a pending request
- **Covers:** AC-F14-10
- **Level:** integration
- **Given** E1 (not in W1) and M1 in W1
- **When** M1 starts a chat with E1's email and sends a message
- **Then** M1 is `accepted`, E1 `pending` with `external=true`; E1's `GET /me/chat-requests` shows the sender's name, email, "external" and a preview of the messages; M1's chat state is "waiting for E1"; E1 gets a `list` news item on their personal channel; the chat shows in E1's Personal list only

### TC-F14-17: Request flow on screen
- **Covers:** AC-F14-10, AC-F14-11
- **Level:** e2e
- **Given** M1 (W1) and E1 in two windows
- **When** M1 messages E1; E1 opens Chat requests, uses Preview, then Accept
- **Then** E1 sees the name, email, "(External)" and the messages before accepting; M1's chat says "Waiting for <name> to accept"; after Accept both chat normally and see each other's status

### TC-F14-18: Accept
- **Covers:** AC-F14-11, AC-F14-26
- **Level:** integration
- **Given** a pending request from M1 to E1
- **When** E1 accepts
- **Then** E1's membership is `accepted`, both can send; the status of each becomes visible to the other; an outsider cannot accept (same answer as not found)

### TC-F14-19: Delete, sender sees nothing, 30-day wait
- **Covers:** AC-F14-11
- **Level:** integration
- **Given** a pending request from M1 to E1
- **When** E1 deletes it, then M1 tries a new request after 29 days and after 31 days (fake clock)
- **Then** the request is gone for E1; M1's chat shows no change (no "declined" text); the new request after 29 days is refused as not found, after 31 days it is allowed

### TC-F14-20: Delete with Block
- **Covers:** AC-F14-11, AC-F14-13
- **Level:** integration
- **Given** a pending request from M1 to E1
- **When** E1 deletes with `{block:true}`
- **Then** a `chat_blocks` row exists (E1 blocks M1) and the request is declined; M1 can't start or send any more, and is not told

### TC-F14-21: 10-message limit while pending
- **Covers:** AC-F14-12
- **Level:** integration
- **Given** a pending request from M1 to E1
- **When** M1 sends 11 messages
- **Then** messages 1 to 10 are accepted; the 11th is refused with "You can send more once <name> accepts"; after E1 accepts, M1 can send again

### TC-F14-22: 20 new requests a day
- **Covers:** AC-F14-12
- **Level:** integration
- **Given** M1 with a fake clock
- **When** M1 starts chats with 21 different external people in one day, then again the next day
- **Then** the 21st is refused; the next day it is allowed; chats with W1 colleagues do not count toward the 20

### TC-F14-23: Request expires after 30 days
- **Covers:** AC-F14-12
- **Level:** integration
- **Given** a request from M1 to E1 not answered
- **When** the clock moves to day 29, day 31, and the daily job runs
- **Then** at day 29 E1 sees it; at day 31 the read hides it even before the job runs; M1's chat says "<name> didn't accept"; the job only cleans up

### TC-F14-24: Personal workspace and everyone external
- **Covers:** AC-F14-10, AC-F14-01
- **Level:** integration
- **Given** Y1 and X1 each in only their Personal workspace
- **When** Y1 starts a chat with X1
- **Then** it is a chat request (X1 must accept); after accepting it works; the Personal workspace of each still has exactly one member (F01 AC-F01-14); a team member M1 who messages Y1 appears as "(External)" to Y1 in Y1's Personal list

### TC-F14-25: Blocking effects
- **Covers:** AC-F14-13
- **Level:** integration
- **Given** an accepted chat between E1 and M1, and E1 blocks M1
- **When** M1 sends, M1 starts a new chat, M1 asks E1's status
- **Then** the old chat is read-only for both (send refused for both); the new start is refused as not found; M1 sees no status for E1; M1 has no signal that they are blocked

### TC-F14-26: Colleagues can't be blocked
- **Covers:** AC-F14-13
- **Level:** integration
- **Given** M1 and M2 in W1
- **When** M1 tries to block M2
- **Then** it is refused; no block row is made; an external person can be blocked

### TC-F14-27: Group chats with a blocked person
- **Covers:** AC-F14-13
- **Level:** integration
- **Given** E1 blocked X1; both are in a group with M1
- **When** each sends a message in the group
- **Then** both still see each other's messages (as in Teams); a direct chat between E1 and X1 stays read-only

### TC-F14-28: Unblock in Settings
- **Covers:** AC-F14-13
- **Level:** e2e
- **Given** E1 blocked M1
- **When** E1 opens Settings, Privacy, Blocked people and chooses Unblock
- **Then** M1 appears in the list before and not after; M1 can send a new request again (the old 30-day wait aside); `GET /me/blocked` and `DELETE /me/blocked/:userId` give the same result

### TC-F14-29: External added to a group
- **Covers:** AC-F14-14
- **Level:** integration
- **Given** a W1 group of M1, M2, M3
- **When** M1 adds E1
- **Then** members see E1 listed with `external=true` ("(External)"); E1 has a pending request for the group; the group stays usable; a note "<name> added <names>" is saved

### TC-F14-30: Group request preview and delete
- **Covers:** AC-F14-14
- **Level:** integration
- **Given** E1 pending in the group, 5 messages sent before E1 was added and 2 after
- **When** E1 previews, then deletes the request
- **Then** the preview shows only the 2 messages after the add; after Delete E1 is not a member, the group shows "<name> didn't join", and E1 can't read anything

### Groups

### TC-F14-31: Group size limits
- **Covers:** AC-F14-15
- **Level:** integration
- **Given** 251 seeded W1 people
- **When** creating groups of 2 (the group path), 3, 250 and 251 people, then adding one person to a full group of 250
- **Then** 3 and 250 work; 251 and "add to 250" are refused with `CHAT_GROUP_FULL` and the limit in the message; two people make a direct chat, not a group

### TC-F14-32: Rename
- **Covers:** AC-F14-16
- **Level:** integration
- **Given** a group of M1, M2, M3
- **When** M2 (not the creator) renames to a 1-char name, an 80-char name, an empty name, and an 81-char name
- **Then** 1 and 80 work; empty and 81 are refused; everyone sees the new name by news; a note "<name> named the group <new name>" is saved; unusual characters and HTML in the name are shown as text

### TC-F14-33: Add people with a history choice
- **Covers:** AC-F14-17
- **Level:** integration
- **Given** a group with messages 400, 100, 10 days old and today
- **When** a member adds N1 with "none", N2 with "last 30 days", N3 with "all" (and default), N4 with 0 and 366 days
- **Then** N1 sees only later messages, N2 sees the last 30 days, N3 sees everything (default is all); 0 and 366 are refused; a note "<name> added <names>" is saved

### TC-F14-34: Remove and leave act at once
- **Covers:** AC-F14-18
- **Level:** integration
- **Given** a group with a live line for M3
- **When** M1 removes M3, and M2 leaves, then new messages arrive
- **Then** M3's line stops getting news within 2 seconds and sends are refused; M3 and M2 can read up to `left_seq` (what they saw) and nothing after; notes say "removed" and "left"

### TC-F14-35: Any member removes anyone; group stays a group; last member leaves
- **Covers:** AC-F14-18
- **Level:** integration
- **Given** a group created by M1
- **When** M2 removes M1 (the creator), the group drops to 2 and then 1, then the last member leaves and the clock goes to day 31
- **Then** removal works; the conversation stays `group` at 2 and 1 members; after the last leaves it is marked and the daily job deletes it, its messages and files within 30 days

### Messages in chats

### TC-F14-36: F03 message features work on conversations
- **Covers:** AC-F14-19, AC-F14-21
- **Level:** integration
- **Given** the F03 integration suite (messages, formatting, links, reactions one per person, replies, edit, delete, 4,000 characters, 10 messages in 10 seconds)
- **When** it runs against direct and group conversations
- **Then** every F03 rule holds; the F03 suite for meeting conversations still passes unchanged

### TC-F14-37: Files in chats
- **Covers:** AC-F14-19
- **Level:** integration
- **Given** F03's fixtures
- **When** files are sent: a 25 MB file, 26 MB, a renamed `.exe`, an image with GPS, 11 files in a minute by one person, and files adding up past 2 GB in one chat
- **Then** 25 MB is allowed, 26 MB refused, the `.exe` refused by content, the GPS data removed, the 11th file in a minute refused, the upload that passes 2 GB refused; download links last 5 minutes; files are served only after the virus scan

### TC-F14-38: Pins, polls and GIFs
- **Covers:** AC-F14-19
- **Level:** integration
- **Given** a group where the GIF setting of W1 is on, then off
- **When** any member pins 4 messages, M2 unpins M1's pin, M2 creates a poll and M3 tries to close it, and GIFs are sent
- **Then** the 4th pin is refused (max 3); any member may pin and unpin; any member may create a poll, only its creator closes it; GIFs work when on and are refused when off

### TC-F14-39: Edit and delete at any time
- **Covers:** AC-F14-21
- **Level:** integration
- **Given** a chat message 2 days old (and a meeting-chat message 2 hours after the meeting ended)
- **When** the sender edits and deletes the chat message, another member tries the same, and the sender tries to edit the meeting-chat message
- **Then** the sender's edit shows "Edited", delete shows "This message was deleted" for everyone; another member is refused; the meeting-chat message keeps F03's rule

### TC-F14-40: Delivery within 1 second
- **Covers:** AC-F14-20
- **Level:** e2e
- **Given** M1, M2, M3 in a group, 200 ms network delay on one window
- **When** each sends 20 messages
- **Then** the others see each within 1 second (95%), without a call running

### TC-F14-41: Offline people catch up in order
- **Covers:** AC-F14-20, AC-F14-29
- **Level:** integration
- **Given** M3's live line closed
- **When** 30 messages (with edits and a delete) are sent, then M3 reconnects and catches up from the last news number
- **Then** M3 gets everything in the right order with no gaps or repeats; the list's unread count is correct

### TC-F14-42: 250-person group load
- **Covers:** AC-F14-20
- **Level:** load
- **Given** a group of 250: 249 simulated people on live lines plus the desktop app
- **When** simulated people send messages for a few minutes
- **Then** delivery to the desktop app is under 1 second for 95% of messages; no line is dropped; the test is added to `pnpm test:load`

### TC-F14-43: Fan-out across two API servers
- **Covers:** AC-F14-20
- **Level:** integration
- **Given** two API instances, M1's line on server A, M2's on server B
- **When** M1 sends through A
- **Then** M2 gets the news on B through Redis `conv:<id>`; one Redis message per news item; each server sends only to its own connected members

### TC-F14-44: Redis down fallback
- **Covers:** AC-F14-20
- **Level:** integration
- **Given** live lines open, then Redis stopped
- **When** a message is sent, and then Redis is started again
- **Then** the live line stays open; while Redis is down the app refreshes the open chat every 10 seconds and the list every 30 seconds (fake timers) and the message appears; when Redis returns normal news resumes and the app stops polling; the status page shows Cache down

### TC-F14-45: Mentions
- **Covers:** AC-F14-22
- **Level:** integration
- **Given** a group with M1, M2 (muted) and E1 (not in the group)
- **When** M1 mentions M2, then tries to mention E1, then types `@` with a name that matches several members
- **Then** the message has a `mention` part with M2's user id; M2's unread counts and the mention is flagged even though muted; the mention of a non-member is sent as plain text (as in Teams); suggestions list only members; the mention shows highlighted for M2 (e2e check in TC-F14-46)

### TC-F14-46: Mention and typing on screen
- **Covers:** AC-F14-22, AC-F14-23
- **Level:** e2e
- **Given** M1, M2 in a group
- **When** M1 types `@` and picks M2, sends; then M2 starts typing and stops
- **Then** M2 sees the mention highlighted; M1 sees "M2 is typing…" within 1 second, and it disappears 5 seconds after M2 stops

### TC-F14-47: Typing timing
- **Covers:** AC-F14-23
- **Level:** unit
- **Given** the typing sender and receiver logic with a fake clock
- **When** a person types continuously for 10 seconds, then stops; and a signal comes from a person who left the chat
- **Then** the sender emits at most one signal every 3 seconds; the receiver shows the name until 5 seconds after the last signal, then hides it; more than 10 signals in 10 seconds from one person are dropped by the server; typing is never stored

### TC-F14-48: Seen rules
- **Covers:** AC-F14-24
- **Level:** unit
- **Given** the Seen decision function
- **When** given direct chats, groups of 20 and 21, and receipts on or off for the reader and the sender
- **Then** Seen shows for direct and groups up to 20 only when both have receipts on; groups of 21 to 250 never show Seen; a person with receipts off shows none and sees none

### TC-F14-49: Seen on the line and who has seen
- **Covers:** AC-F14-24
- **Level:** integration
- **Given** a group of 5 with live lines; M2 has read receipts off
- **When** M3 reads M1's message, then M2 reads it, then M1 calls `GET .../messages/:mid/seen`; and the same on a group of 21
- **Then** M1 gets `read` for M3 only; the list contains M3 only (not M2); M2 receives no `read` marks from others; in the group of 21 the call returns no list and no `read` news is sent; `PATCH /me/settings` toggles it

### TC-F14-50: Not sent, Retry, never twice
- **Covers:** AC-F14-25
- **Level:** e2e
- **Given** M1 in a chat with the connection cut
- **When** M1 sends, sees "Not sent", reconnects, and presses Retry twice quickly
- **Then** the message appears once for everyone (same client message id); the integration level also posts the same client id twice and gets one stored message

### Status

### TC-F14-51: Status rules
- **Covers:** AC-F14-26
- **Level:** unit
- **Given** the status function and a fake clock
- **When** a line has activity 2 minutes ago, 6 minutes ago, the computer locks, the person is in a call, and the last line closed 20 and 40 seconds ago
- **Then** results are Available, Away, Away, In a meeting, Offline (not yet offline at 20 s because of the 30 s grace, offline at 40 s)

### TC-F14-52: Who sees status
- **Covers:** AC-F14-26, AC-F14-13
- **Level:** integration
- **Given** M1, M2 (colleagues), E1 accepted contact of M1, E2 with a pending request from M1, E3 blocked by M1, and X1 an outsider
- **When** each asks for M1's status and listens on their line
- **Then** M2 and E1 see it and get changes; E2, E3 and X1 see none and get no `status` news; after blocking E1 or removing M2 from the workspace the change stops at once

### TC-F14-53: Status on screen
- **Covers:** AC-F14-26
- **Level:** e2e
- **Given** M1 and M2 in two windows
- **When** M1 is active, goes 5 minutes without action (fake time hook), the computer lock event fires, M1 joins a call, closes the app
- **Then** M2's dot and the words change Available, Away, Away, In a meeting, Offline; the dot has a word for screen readers

### Workspace setting

### TC-F14-54: Outside chat off
- **Covers:** AC-F14-27
- **Level:** integration
- **Given** W1 with outside chat on, an accepted chat M1-E1, a group with E1, and a normal chat M1-M2
- **When** A1 turns **Chat with people outside the workspace** off
- **Then** M1 can't start a chat with E1 (not found), E1 can't start one with a W1 member, sends in the M1-E1 chat and the group are refused with `CHAT_OUTSIDE_OFF` and the app shows the read-only note; M1-M2 still works; a plain member can't change the setting

### TC-F14-55: Outside chat back on
- **Covers:** AC-F14-27
- **Level:** e2e
- **Given** the state of the previous case on screen
- **When** the admin turns it back on
- **Then** the read-only notes go away and sending works again in both chats

### TC-F14-56: Outside chat across workspaces
- **Covers:** AC-F14-27
- **Level:** integration
- **Given** X1 in W2 (off) and W3 (on), Y1 in Personal only, and W1 with it off
- **When** M2 in W2 starts a chat with X1; M1 in W1 (on) starts with X1; M1 starts with Y1; a member of W1 (off) starts with Y1
- **Then** the request is refused when the starter's workspace is off or when all of the target's team workspaces are off; it goes to the target's Personal list when at least one allows it or the target has only Personal

### Meeting chats in the list

### TC-F14-57: Meeting chats listed by F03 rules
- **Covers:** AC-F14-28, AC-F14-03
- **Level:** integration
- **Given** a W1 meeting "Weekly sync" that M1 attended, M2 invited but absent, and M3 attended as an external
- **When** each loads the list
- **Then** M1 and M3 see "Weekly sync" with a meeting marker and last message; M2 does not (F03 AC-42); E1 who was never in the meeting does not; an outsider gets not found when opening it

### TC-F14-58: Live and finished meeting chat from the list
- **Covers:** AC-F14-28
- **Level:** e2e
- **Given** M1 and M2 in a running call, then after the call ends
- **When** M1 opens "Weekly sync" from the Chat list during the call and afterwards
- **Then** during the call it opens the live chat (messages and news through the call server as in F03); afterwards it opens read-only (F03 rules); an edit made during the call still reaches M1 afterwards on the live line

### Quality

### TC-F14-59: Opening and paging
- **Covers:** AC-F14-29
- **Level:** e2e
- **Given** a chat with 120 messages
- **When** M1 opens it (and API-level: first page, then pages with `before`)
- **Then** the newest messages show within 1 second; older ones load 50 at a time on scrolling up with no gaps or repeats; a person added with "last 30 days" never receives older pages

### TC-F14-60: Keyboard only
- **Covers:** AC-F14-30, AC-F14-36
- **Level:** e2e
- **Given** one window and only the keyboard
- **When** the person folds the menu, filters, searches, starts a chat and a group, sends, replies, reacts, accepts and deletes a request, opens group details, adds and removes people, leaves, and mutes/pins
- **Then** every step is reachable with Tab/Enter/Escape/arrows, focus is visible and moves logically, focus returns to the trigger when a dialog closes, and no keyboard trap exists

### TC-F14-61: Screen reader announcements and labels
- **Covers:** AC-F14-30, AC-F14-26, AC-F14-23
- **Level:** e2e
- **Given** the accessibility tree
- **When** a new message arrives in the open chat, a request arrives, someone types, and the status changes
- **Then** the new message is announced in a polite live region (F03 AC-45); status dots, unread counts, "Seen", "is typing", the folded menu buttons and the tooltips have text names; `aria-expanded` is set on the fold button; the axe check finds no serious issues on the Chat screen, New chat, Requests and Group details

### TC-F14-62: Translations
- **Covers:** AC-F14-30
- **Level:** unit
- **Given** the translation files and the new components
- **When** the key check runs
- **Then** every F14 label, note, error and tooltip uses a translation key present in all supported languages; no hard-coded text is found in `features/chats`, `pages/ChatsPage` or the new UI components; messages with names use placeholders

### Security and privacy

### TC-F14-63: Outsider sweep over every route
- **Covers:** AC-F14-31
- **Level:** security
- **Given** a conversation (direct, group, meeting) in W1 with members and files, and outsiders: X1 (other workspace), E1 (external, no chat), Y1 (Personal only), a signed-out caller
- **When** each outsider calls every route in design section 5 (list, messages, send, edit, delete, reactions, pins, polls, attachments, read, accept, decline, members, leave, rename, `me`, seen, download link, status, people)
- **Then** every call returns exactly the same answer as for a conversation id that does not exist (404, same body); signed-out gets 401; nothing about members, files, names or status leaks; the sweep is generated from the route list so a new route without a check fails the test

### TC-F14-64: Outsider and unrelated live line
- **Covers:** AC-F14-31
- **Level:** security
- **Given** M1 and M2 chatting, and X1 with an open live line
- **When** M1 sends, edits, reacts, types, reads, and changes status; X1 sends `typing` with M1's conversation id
- **Then** X1's line receives no `news`, `typing`, `read`, `status` or `list` for them; X1's `typing` is ignored or closes the line and produces nothing for members; X1 receives only X1's own events

### TC-F14-65: State by action permission table
- **Covers:** AC-F14-31, AC-F14-13, AC-F14-18, AC-F14-27, AC-F14-34
- **Level:** unit
- **Given** `chats.permissions.ts`
- **When** every action (read, write, react, reply, pin, poll, add, remove, rename, leave, preview, accept, delete, block) is tried for every state (accepted, pending, declined, left, removed, removed from workspace, blocked, external accepted) and kind, with outside chat on and off
- **Then** results match the table in design 3.2 for every pair (pending: preview only; declined: nothing; left/removed: read up to `left_seq`; removed from workspace: nothing; blocked direct: read-only; outside off with external: read-only); any pair not in the table is denied

### TC-F14-66: Blocked, pending, declined, removed and left access
- **Covers:** AC-F14-31, AC-F14-13, AC-F14-34
- **Level:** security
- **Given** people in each state in the same conversation
- **When** each tries read, write, member list, files, status and live news
- **Then** pending can only preview from `history_from`; declined and removed-from-workspace get nothing (not found); left/removed read only up to `left_seq` and never see later messages, later files or later members; blocked sees nothing of the blocker's status; roles and membership are re-read on every request (a removal takes effect on the very next call with the old token)

### TC-F14-67: Refusals look the same
- **Covers:** AC-F14-31
- **Level:** security
- **Given** a non-existent id, a conversation the caller isn't in, a blocked start, and a start refused by outside-chat-off
- **When** the caller makes the same call for each
- **Then** status code, body shape, message and (within a tolerance) response time are the same

### TC-F14-68: No chat text, file names or emails in logs
- **Covers:** AC-F14-32
- **Level:** security
- **Given** the API log output captured while running the integration flows with unique marker strings in message text, file names, group names and emails
- **When** messages, files, requests, lookups, invites, live-line traffic and errors (including failed validation) run
- **Then** no marker appears in any log line, error report or live-line log; the live line logs only ids and counts

### TC-F14-69: Account deletion
- **Covers:** AC-F14-33
- **Level:** integration
- **Given** M1 with direct chats, a group they created, messages, files and requests sent and received
- **When** M1's account is deleted (F10's step `chats.forgetPerson`) and the clock moves 31 days
- **Then** their pending requests are withdrawn at once and received ones removed; their blocks and cooldowns are removed; they show as "Deleted user" in lists and group members; the group keeps working for others; direct chats with them are read-only; messages and files become "Deleted user · message removed" and are gone within 30 days

### TC-F14-70: Data export
- **Covers:** AC-F14-33
- **Level:** integration
- **Given** M1 with messages and files in direct, group and meeting conversations
- **When** M1 requests their data
- **Then** the export includes their own messages and files from every kind and none of other people's messages

### TC-F14-71: Removed from or leaving a workspace
- **Covers:** AC-F14-34
- **Level:** integration
- **Given** M2 in W1 with a direct chat with M1, a group, and a live line
- **When** M2 is removed (and a second time, M3 leaves by choice)
- **Then** within 2 seconds the line drops all W1 conversations, notes "<name> left" are saved, M2 can't open them (not found); M1's direct chat shows "This person is no longer in the workspace" and is read-only; M2's other workspaces' chats are untouched

### TC-F14-72: Keeping, hiding and deleting chats
- **Covers:** AC-F14-35
- **Level:** integration
- **Given** chats and a fake clock
- **When** M1 hides a chat, then M2 writes in it; the clock moves 400 days; W1 is deleted and the clock moves 31 days
- **Then** the hidden chat disappears from M1's list only, and returns with M2's new message; chats are still there after 400 days; after the workspace deletion its conversations, messages and files are removed within 30 days; other workspaces' chats remain

### TC-F14-73: Live line sign-in and session end
- **Covers:** AC-F14-31, AC-F14-20
- **Level:** security
- **Given** the `/api/v1/realtime` WebSocket
- **When** connecting with no token, a bad token, an expired token, a good token; then sign-out, sign-out everywhere, password change and revoke on a connected line
- **Then** the first three are refused before the line opens (no upgrade); a good one opens; after each session end the server closes that person's lines within 2 seconds and the app can reconnect only with a new token

### TC-F14-74: Live line limits and allowed messages
- **Covers:** AC-F14-31, AC-F14-23
- **Level:** security
- **Given** an open line
- **When** the app sends a message of 65 KB, an unknown message type, broken JSON, a `send`/`data`-changing command, 11 typing signals in 10 seconds, a 6th line for the person, and nothing for 2 minutes
- **Then** over-size and unknown/invalid messages close the line; only `typing`, `active`, `ping` are accepted; extra typing is dropped; the 6th line closes the oldest with code 4001; the idle line is closed after 2 minutes without a ping; messages are validated by Zod both ways

### TC-F14-75: Subscriptions change within 2 seconds
- **Covers:** AC-F14-18, AC-F14-34
- **Level:** integration
- **Given** M3's line following a group and its `user:<id>` channel
- **When** M3 is added to a new group, accepts a request, is removed, and blocks someone
- **Then** the line starts or stops following the right channels within 2 seconds each time, a `list` news item arrives for new or lost chats, and the status audience set is updated

### TC-F14-76: Desktop token only to the API host
- **Covers:** AC-F14-31
- **Level:** e2e
- **Given** the real desktop app
- **When** the page opens its live line, and then tries to open a WebSocket and a request to another host
- **Then** the upgrade request to the API address carries `Authorization`; no token is added to any other host or to `ws`/`wss` to another host; the security policy's `connect-src` allows exactly the API's `ws`/`wss` address; the bridge-surface test includes `power.onLockChange`

### Migration

### TC-F14-77: F03 meeting chats keep working after the migration
- **Covers:** AC-F14-28, AC-F14-19
- **Level:** integration
- **Given** a database built with F03's migrations and filled with meetings, calls, messages, reactions, pins, polls and attachments, then migration `0006_chats` applied
- **When** the F03 chat test suite runs (join, send, history, edit, delete, files, export)
- **Then** all F03 tests pass unchanged; each meeting has exactly one conversation (unique `meeting_id`); a meeting with several calls shows one merged chat in the right order; new meetings get their conversation at creation

### TC-F14-78: No message lost while filling
- **Covers:** AC-F14-28
- **Level:** integration
- **Given** a database with 10,000 F03 messages and the code writing both `meeting_id` and `conversation_id`
- **When** step 2 (the fill) runs while messages keep being sent, stopped halfway and re-run
- **Then** a query finds zero rows in `chat_messages`, `chat_events`, `chat_pins`, `chat_polls`, `chat_attachments` without a `conversation_id`; the message count before equals the count after plus the newly sent; the re-run changes nothing; no column is dropped

### Visual and component tests

### TC-F14-79: New UI parts: stories, states, screenshots
- **Covers:** AC-F14-36, AC-F14-02, AC-F14-26, AC-F14-30
- **Level:** visual
- **Given** stories for `StatusDot`, `ChatListItem`, `ChatRequestCard`, `PeoplePicker`, `TypingIndicator`, `SeenMark`, `HistoryChoice`, `ChatList`, `ConversationHeader`, `GroupDetails`, `NavRail`
- **When** `pnpm test:visual` runs
- **Then** each state has a screenshot (list item: unread, muted, pinned, group, meeting, pending; status dots: four; NavRail: unfolded, folded, tooltip, badge 99+; PeoplePicker: chips, suggestions, no-account, external; HistoryChoice: all options) matching the baseline in light and dark; component tests check roles, names and props; unit tests assert Atomic Design placement

### TC-F14-80: F03 and earlier suites still pass
- **Covers:** AC-F14-19, AC-F14-28
- **Level:** integration
- **Given** the full F02 and F03 test suites
- **When** they run on the F14 code
- **Then** all pass with no test changed or weakened

### Side menu

### TC-F14-81: NavRail logic
- **Covers:** AC-F14-36
- **Level:** unit
- **Given** the `NavRail` component
- **When** the fold button is pressed twice, and with stored value `meetapp.nav.folded` true/false/garbage
- **Then** it folds to icons (Home, Chat, Meetings, People, Settings, workspace letter) and unfolds; `aria-expanded` follows; each icon has a tooltip name on hover and focus; the Chat unread number stays on its icon (and "99+"); the stored value is used on start and bad values fall back to unfolded

### TC-F14-82: Menu folding on the desktop
- **Covers:** AC-F14-36, AC-F14-02
- **Level:** e2e
- **Given** the real app with an unread chat
- **When** the person folds the menu, points at and tabs to each icon, closes and reopens the app, then unfolds
- **Then** the rail shows icons only with tooltips and the unread count; the choice survives restart on this computer; unfolding restores names

## Coverage table

| AC | Test cases |
|---|---|
| AC-F14-01 | TC-F14-01, 02, 24 |
| AC-F14-02 | TC-F14-03, 04, 79, 82 |
| AC-F14-03 | TC-F14-05, 57 |
| AC-F14-04 | TC-F14-06, 07 |
| AC-F14-05 | TC-F14-08, 09 |
| AC-F14-06 | TC-F14-10 |
| AC-F14-07 | TC-F14-11, 12 |
| AC-F14-08 | TC-F14-13, 14 |
| AC-F14-09 | TC-F14-12, 15 |
| AC-F14-10 | TC-F14-16, 17, 24 |
| AC-F14-11 | TC-F14-17, 18, 19, 20 |
| AC-F14-12 | TC-F14-21, 22, 23 |
| AC-F14-13 | TC-F14-20, 25, 26, 27, 28, 52, 65, 66 |
| AC-F14-14 | TC-F14-29, 30 |
| AC-F14-15 | TC-F14-31 |
| AC-F14-16 | TC-F14-32 |
| AC-F14-17 | TC-F14-33 |
| AC-F14-18 | TC-F14-34, 35, 65, 75 |
| AC-F14-19 | TC-F14-36, 37, 38, 77, 80 |
| AC-F14-20 | TC-F14-40, 41, 42, 43, 44, 73 |
| AC-F14-21 | TC-F14-36, 39 |
| AC-F14-22 | TC-F14-09, 45, 46 |
| AC-F14-23 | TC-F14-46, 47, 61, 74 |
| AC-F14-24 | TC-F14-48, 49 |
| AC-F14-25 | TC-F14-50 |
| AC-F14-26 | TC-F14-18, 51, 52, 53, 61, 79 |
| AC-F14-27 | TC-F14-54, 55, 56, 65 |
| AC-F14-28 | TC-F14-57, 58, 77, 78, 80 |
| AC-F14-29 | TC-F14-41, 59 |
| AC-F14-30 | TC-F14-60, 61, 62, 79 |
| AC-F14-31 | TC-F14-14, 63, 64, 65, 66, 67, 73, 74, 76 |
| AC-F14-32 | TC-F14-68 |
| AC-F14-33 | TC-F14-69, 70 |
| AC-F14-34 | TC-F14-65, 66, 71, 75 |
| AC-F14-35 | TC-F14-72 |
| AC-F14-36 | TC-F14-60, 79, 81, 82 |

Security rules (security.md and design "Security & privacy"): S1/S2 membership and workspace checks (TC-63, 64, 66, 67), live line sign-in and token host (TC-73, 76), live line limits (TC-74), email lookup limits (TC-14), logs (TC-68), account deletion (TC-69), status privacy (TC-52), file rules (TC-37).
