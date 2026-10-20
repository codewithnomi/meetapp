---
feature: F03
title: In-meeting chat
status: approved
updated: 2026-10-20
---

# F03 In-meeting chat: Test Cases

Written **before** the code. Each test case becomes an automated test.
Levels: unit · integration · security (integration-style attempts to break rules) · e2e (desktop: real Electron windows, Playwright) · load · visual (Storybook screenshots).

Test names must include the TC and AC IDs, e.g. `TC-F03-13 [AC-F03-06] 11th message in 10 seconds is refused`.

**Test set-up (design.md "Test approach"):**
- Integration and security tests use real PostgreSQL, Redis, RustFS and the real local LiveKit. A test LiveKit participant listens on topic `meetapp.chat`. The GIF service is a fake local server (no real network in tests).
- Seeded people as in F02: workspace W1 (owner, admin, member M1, M2, presenter P1, co-organizer C1) and W2 (member X1); an external person E1 (account in W2, invited to a W1 meeting); a guest G1 (no account, ticket only). "Outsider" = signed-in user not in the meeting. "Same answer" = same status code, body shape and message.
- Time rules (expiry, 5-minute links, 1-hour clean-up, 1-day events, 30-day deletion) use a fake clock on the server.
- Desktop e2e uses 2 or 3 Electron windows with Playwright (as F02); GIF search points at the fake GIF service.
- **Load** cases run with `pnpm test:load` (as F02).
- Sample files live in `apps/api/test/fixtures/chat/` (real PNG/JPEG/GIF/WebP/PDF/DOCX/XLSX/PPTX/TXT/CSV, plus renamed `.exe`, `.doc`, macro `.docm`, broken UTF-8, an image with GPS, a decompression bomb).

## Test cases

### Sending and seeing messages

### TC-F03-01: Message reaches everyone fast, with name and time
- **Covers:** AC-F03-01
- **Level:** e2e
- **Given** M1 (member), E1 (external) and G1 (guest) in one meeting, with 200 ms network delay on one window
- **When** each sends a message
- **Then** the others see it within 1 second with the sender's name, "(External)" or "(Guest)" where it applies, picture or initials, and the time

### TC-F03-02: 100-person delivery time
- **Covers:** AC-F03-01
- **Level:** load
- **Given** the 100-person load meeting (99 simulated people + the desktop app)
- **When** simulated people send chat messages through the API for a few minutes
- **Then** delivery to the desktop app is under 1 second for 95% of messages

### TC-F03-03: History paging and order
- **Covers:** AC-F03-02
- **Level:** integration
- **Given** a meeting with 120 messages sent before M2 joins
- **When** M2 asks for the first page, then pages with `before`
- **Then** the first page has the newest 50, pages continue without gaps or repeats, order is by time then id (oldest at top when shown), and messages sent before joining are included

### TC-F03-04: Late joiner and guest rejoin see the chat
- **Covers:** AC-F03-02, AC-F03-41
- **Level:** e2e
- **Given** a meeting with 120 messages
- **When** M2 joins late, scrolls to the top, and G1 leaves and rejoins while the call runs
- **Then** the newest 50 show within 2 seconds, older ones load on scrolling up; G1 sees the history again after rejoining

### TC-F03-05: Message limits
- **Covers:** AC-F03-03, AC-F03-17
- **Level:** unit
- **Given** the message checker
- **When** given empty, spaces only, 4,000, 4,001 characters, and a 3,990-character message with a 20-character code block
- **Then** empty and spaces are refused, 4,000 is allowed, 4,001 is refused with "1 too many", and the code block counts toward the limit (10 too many)

### TC-F03-06: Server refuses bad messages
- **Covers:** AC-F03-03
- **Level:** integration
- **Given** M1 in a call
- **When** M1 posts an empty message, spaces only, 4,001 characters, and an attachment-only message
- **Then** the first three get `CHAT_INVALID` and nothing is stored; the attachment-only message is accepted

### TC-F03-07: Counter and disabled Send
- **Covers:** AC-F03-03
- **Level:** e2e
- **Given** the message box
- **When** the person types 4,212 characters, then deletes 212, and tries spaces only
- **Then** "212 characters too many" shows and Send is disabled; after trimming Send works; spaces only keeps Send disabled

### TC-F03-08: Renderer shows text safely and links http/https only
- **Covers:** AC-F03-04, AC-F03-15, AC-F03-17
- **Level:** unit
- **Given** the message renderer
- **When** given text with `https://a.com`, `http://b.com`, `file:///etc/passwd`, `javascript:alert(1)`, `meetapp://x`, `<script>alert(1)</script>`, `<img src=x onerror=…>`, and a link-with-own-text mark whose href is `javascript:`
- **Then** only http/https become links; everything else, including the HTML and script, appears as plain text exactly as typed; no `dangerouslySetInnerHTML` is used (a lint rule check)

### TC-F03-09: Links open in the normal browser
- **Covers:** AC-F03-04
- **Level:** e2e
- **Given** a message with an https link and a formatted link
- **When** a person clicks each
- **Then** the system browser is asked to open it (`shell.openExternal` seen) and no new app window or in-app navigation happens

### TC-F03-10: Sending twice makes one message
- **Covers:** AC-F03-05
- **Level:** integration
- **Given** a message sent with `clientId` C
- **When** the same request is repeated 5 times, also after a reconnect and in parallel
- **Then** one message exists and every answer returns the same saved message; one `message_created` event was broadcast

### TC-F03-11: Not sent and Retry
- **Covers:** AC-F03-05
- **Level:** e2e
- **Given** the API is blocked for the window
- **When** the person sends a message, waits more than 10 seconds, unblocks, and presses Retry
- **Then** the message shows "Not sent" with Retry; after Retry it is sent once and others see exactly one copy

### TC-F03-12: Cut-off upload leaves nothing
- **Covers:** AC-F03-05, AC-F03-30
- **Level:** integration
- **Given** an upload in progress
- **When** the connection is cut halfway
- **Then** no stored object and no `ready` attachment row remain (row removed or `uploading` cleaned after 1 hour with the fake clock); the app test shows "Upload failed" with Retry and Retry succeeds

### TC-F03-13: Message rate limit
- **Covers:** AC-F03-06
- **Level:** integration
- **Given** M1 in a call
- **When** M1 sends 11 messages in 10 seconds, then waits (fake clock) 10 seconds
- **Then** the 11th gets `CHAT_TOO_FAST` with the wait time; after the wait sending works; reactions and votes (30 a minute) are counted separately and aren't blocked by the message limit

### TC-F03-14: Rate-limit message shown
- **Covers:** AC-F03-06
- **Level:** e2e
- **Given** the message box
- **When** the person sends 11 messages quickly
- **Then** "You're sending messages too fast. Try again in a few seconds." shows and the draft stays

### TC-F03-15: Unread badge
- **Covers:** AC-F03-07
- **Level:** e2e
- **Given** M2's chat panel is closed
- **When** M1 sends 3 messages, then 100 more, and M2 opens the panel
- **Then** the Chat button shows 3, then "99+", and the number goes away when the panel opens

### TC-F03-16: No jump while reading old messages
- **Covers:** AC-F03-08
- **Level:** e2e
- **Given** M2 scrolled up to old messages
- **When** M1 sends a message
- **Then** M2's view does not move, a "New messages" button shows, and pressing it goes to the newest message

### TC-F03-17: Empty chat
- **Covers:** AC-F03-09
- **Level:** e2e
- **Given** a meeting with no messages
- **When** the panel opens
- **Then** it shows "No messages yet"

### Editing and deleting

### TC-F03-18: Edit own message only
- **Covers:** AC-F03-10, AC-F03-11
- **Level:** integration
- **Given** a message by M1 in a running call
- **When** M1, then M2, then the organizer, then C1 try to edit it
- **Then** only M1 succeeds (`edited_at` set, `message_edited` broadcast); the others are refused with `NOT_FOUND` and the text is unchanged; editing a deleted message gets `NOT_FOUND`

### TC-F03-19: Delete own message removes content
- **Covers:** AC-F03-10
- **Level:** integration
- **Given** M1's text message, GIF message and a message with a file
- **When** M1 deletes each during the call, and later (call ended) tries to edit or delete another
- **Then** `body`, `plain_text`, `gif`, `sticker` are empty and the file is deleted from storage within a minute (fake clock); `deleted_at` stays; `message_deleted` is broadcast; after the call ends edit and delete give `CHAT_EDIT_ENDED`; in a reused link meeting, messages of the earlier call can't be edited in the new call

### TC-F03-20: Organizer and co-organizer delete others' messages
- **Covers:** AC-F03-11
- **Level:** integration
- **Given** M1's message, a finished call too
- **When** the organizer, C1, M2 (attendee) and P1 (presenter) try to delete it, during and after the meeting (`/meetings/:id/…` route)
- **Then** organizer and C1 succeed the same way as AC-F03-10; others are refused with `NOT_FOUND`; system notes can't be deleted by anyone

### TC-F03-21: Edit and delete in the app
- **Covers:** AC-F03-10, AC-F03-11
- **Level:** e2e
- **Given** M1 and M2 in a meeting, organizer O in a third window
- **When** M1 edits a message, M1 deletes another (confirmation asked), O deletes M2's message (confirmation asked)
- **Then** everyone sees "Edited" on the first, "This message was deleted" on the others; Cancel in the confirmation keeps the message; M2 has no Delete or Edit on others' messages; after the meeting ends no Edit or Delete is offered to M1

### Emoji, reactions, replies

### TC-F03-22: Emoji picker
- **Covers:** AC-F03-12
- **Level:** e2e
- **Given** the message box
- **When** the person opens the picker, searches "smile", picks a skin tone, inserts an emoji, and reopens the picker
- **Then** results match the search, the emoji with the skin tone is inserted, and the recently used one is first

### TC-F03-23: Reactions seen by everyone
- **Covers:** AC-F03-13
- **Level:** e2e
- **Given** M1's message, with M2 and G1 present
- **When** M2 and G1 react with 👍, M2 points at the chip, then M2 chooses 👍 again
- **Then** all windows show 👍 with count within 1 second; pointing shows the names (G1's typed name); the second choice removes M2's reaction (count 1)

### TC-F03-24: Reaction rules
- **Covers:** AC-F03-13
- **Level:** integration
- **Given** a message
- **When** M2 adds 20 different emoji, then a 21st, then text that is not in the emoji list (`"hello"`, `"<b>"`, a non-NFC form of an emoji), and the same emoji twice
- **Then** 20 are accepted, the 21st and non-emoji are refused `CHAT_INVALID`, the non-NFC form is normalised to the same emoji, the repeat does not double count; the guest may react; `reactions_changed` is broadcast

### TC-F03-25: Reply quote built on reading
- **Covers:** AC-F03-14
- **Level:** integration
- **Given** a message A and a reply B with `replyToId` A
- **When** B is read, then A is edited, then A is deleted, and a reply to a message of another meeting is posted
- **Then** the quote has A's sender name and first line, follows the edit, shows "This message was deleted" after delete; the cross-meeting reply is refused `CHAT_INVALID`

### TC-F03-26: Reply in the app
- **Covers:** AC-F03-14
- **Level:** e2e
- **Given** a long chat with the original far above
- **When** M2 chooses Reply, writes, sends, then chooses the quote; later the original is deleted
- **Then** the reply shows the quote; choosing it scrolls to and highlights the original; Esc cancels a reply in progress; the quote shows "This message was deleted" after deletion

### Formatting and code

### TC-F03-27: Document shape checks
- **Covers:** AC-F03-15, AC-F03-17
- **Level:** unit
- **Given** the Zod message document
- **When** given each allowed block and mark, then an unknown block (`image`, `html`), an unknown mark (`color`), a `link` with `javascript:` or `data:`, an `href` of 2,001 characters, lists nested 4 levels, a document over 32 KB, and `v: 2`
- **Then** allowed shapes pass; every other shape is refused

### TC-F03-28: Formatting in the app
- **Covers:** AC-F03-15
- **Level:** e2e
- **Given** the message box with the Format toolbar
- **When** the person writes bold, italic, underline, strikethrough, bulleted and numbered lists, a quote, a link with own text, and inline code, using the buttons and Ctrl/Cmd+B/I/U and `**`, `-` typing
- **Then** everyone sees the message with that formatting

### TC-F03-29: Code block rendering is exact
- **Covers:** AC-F03-16
- **Level:** unit
- **Given** a code block with spaces, tabs, blank lines, `https://x.com`, `<b>x</b>` and a very long line
- **When** rendered
- **Then** the text is shown in a `pre` with monospace font, whitespace unchanged, no link, no HTML, and sideways scroll (not wrapping)

### TC-F03-30: Code block in the app, Copy
- **Covers:** AC-F03-16
- **Level:** e2e
- **Given** the message box
- **When** the person types three backticks, enters code with tabs and long lines, sends, and another person presses Copy
- **Then** the code block is shown as typed, scrolls sideways, and the clipboard holds the code exactly

### TC-F03-31: Pasting cleans content
- **Covers:** AC-F03-17
- **Level:** unit
- **Given** the editor's paste handler
- **When** pasted HTML has bold, a `<script>`, `<style>`, `<img>`, a table, `style="color:red"` and a `javascript:` link
- **Then** bold stays; scripts, styles, pictures, tables and colours become plain text or are dropped as text; the bad link is plain text

### TC-F03-32: Server refuses extra formatting
- **Covers:** AC-F03-17, AC-F03-03
- **Level:** integration
- **Given** M1 in a call
- **When** M1 posts documents with an `image` block, raw `html`, a `color` mark, a `javascript:` href, 32 KB+ of content, and visible text that goes over 4,000 only because of code
- **Then** each is refused `CHAT_INVALID`; nothing is stored or broadcast

### TC-F03-33: Spell check menu
- **Covers:** AC-F03-18
- **Level:** e2e
- **Given** the app in English
- **When** the person types "recieve" and right-clicks it (and again with the keyboard menu key), then switches the app language and types a misspelled word in it
- **Then** the word is underlined; the menu offers corrections and "Add to dictionary"; choosing a correction fixes the word; "Add to dictionary" removes the underline; the dictionary follows the app language

### TC-F03-34: Spell check sends nothing, security
- **Covers:** AC-F03-18
- **Level:** security
- **Given** all network requests of the app recorded (on Mac and, in CI, on Windows)
- **When** the person types misspelled text and opens the menu
- **Then** no request goes to any dictionary or other server; the dictionary download address points to the bundled files

### Pinned messages

### TC-F03-35: Pin rules
- **Covers:** AC-F03-19, AC-F03-20
- **Level:** integration
- **Given** 4 messages
- **When** the organizer and C1 pin 3, M2 and P1 try to pin and unpin, two organizers pin the 4th at once, a pinned message is deleted, one is unpinned
- **Then** only organizer and C1 can pin and unpin (others `NOT_FOUND`); the 4th gets `CHAT_PINS_FULL` (exactly one of the two parallel pins fails when it is the 4th); delete or unpin removes it from the pinned list; `pins_changed` is broadcast with a system note "<name> pinned a message"

### TC-F03-36: Pinned bar in the app
- **Covers:** AC-F03-19, AC-F03-20
- **Level:** e2e
- **Given** organizer O and M2 in a meeting
- **When** O pins a message, then a 2nd and 3rd, then a 4th, then unpins one, then M1 deletes a pinned message
- **Then** M2 sees the pinned bar with the note within 2 seconds ("1 of 2"); choosing it scrolls to the message; the 4th asks which to unpin; M2 has no Pin option; unpinned and deleted messages leave the bar

### Polls

### TC-F03-37: Creating polls
- **Covers:** AC-F03-21, AC-F03-23
- **Level:** integration
- **Given** organizer, C1, P1, M2 (attendee) and G1 (a guest made an attendee; guests are presenters by default, as in Teams, and may then create polls) in a call
- **When** each posts a poll; then polls with a 201-character question, 1 option, 11 options, a 101-character option, and one with `multiple` and `anonymous`
- **Then** organizer, C1 and P1 succeed (poll message and `poll_created` broadcast); M2 and G1 are refused `NOT_FOUND`; the invalid polls get `CHAT_INVALID`; a poll after the meeting ended is refused

### TC-F03-38: Voting rules
- **Covers:** AC-F03-22, AC-F03-23
- **Level:** integration
- **Given** a single-answer poll and a multiple-answer poll
- **When** M2 and G1 vote, vote again for another option, vote twice for the same option, send 2 options to the single poll, and vote after the poll is closed
- **Then** each person counts once; a changed vote replaces the earlier; 2 options on a single poll are refused `CHAT_INVALID`; vote after close gets `CHAT_POLL_CLOSED`; an option from another poll is refused

### TC-F03-39: Who sees results
- **Covers:** AC-F03-22
- **Level:** integration
- **Given** an open poll created by P1 where M2 has not voted and M3 has
- **When** M2, M3, P1, the organizer, C1 and a presenter who is not the creator ask for the result; and `poll_changed` is read by the test LiveKit participant
- **Then** M2 gets no counts; M3, P1, organizer and C1 get counts and percentages; the other presenter gets counts only after voting; `poll_changed` contains only the poll id and version

### TC-F03-40: Anonymous poll can't be linked to people, security
- **Covers:** AC-F03-22
- **Level:** security
- **Given** an anonymous poll with 5 voters including a guest
- **When** every API answer for the poll (as creator, organizer, co-organizer), every broadcast, and every column of the vote rows and logs are searched; a full database dump is searched for user ids, attendance ids, names and vote times
- **Then** no names or ids appear in answers; vote rows hold only `voter_key` (HMAC) with empty `attendance_id` and no time; the same voter gets the same key in the same poll only (not across polls); non-anonymous polls list names

### TC-F03-41: Closing polls and after the meeting
- **Covers:** AC-F03-23, AC-F03-42
- **Level:** integration
- **Given** open polls by P1
- **When** P1, the organizer, C1, M2 try to close; the last call of the meeting ends with a poll still open; a reader opens the chat afterwards
- **Then** P1, organizer and C1 can close (others `NOT_FOUND`); open polls close automatically at the end; no votes after close; the final result is readable after the meeting by allowed readers

### TC-F03-42: Poll in the app
- **Covers:** AC-F03-21, AC-F03-22, AC-F03-23
- **Level:** e2e
- **Given** organizer O, M2, G1
- **When** O creates a poll (3 options), M2 and G1 vote, M2 changes the vote, O closes it
- **Then** the poll shows for all within 2 seconds; before voting M2 sees no results, after voting sees counts and percentages within 2 seconds; O sees them at all times; after closing, voting is disabled and the result stays; M2 has no Create a poll button

### GIFs and stickers

### TC-F03-43: GIF settings for the app's own search
- **Covers:** AC-F03-24, AC-F03-27
- **Level:** integration
- **Given** meeting X in workspace W1 with GIFs allowed, member M1 and guest G1 in the call, and a second meeting Y with M1 in it
- **When** M1 and G1 call `GET /calls/:callId/chat/gif-settings`; M1 calls it again in meeting Y; a person in the lobby, a removed person and an outsider call it; chat is set to Off and M1 calls it; M1 sends GIF messages whose image address is `https://static.klipy.com/…`, `http://static.klipy.com/…` and `https://evil.example/…`
- **Then** M1 and G1 get the KLIPY address, the key and a `customer_id`; M1's `customer_id` differs between X and Y and contains no user, attendance or meeting id in readable form; lobby, removed and outsider get `NOT_FOUND`; chat Off gives `CHAT_OFF`; only the `https://static.klipy.com` GIF is accepted, the others get `CHAT_INVALID`


### TC-F03-44: GIF in the app
- **Covers:** AC-F03-24
- **Level:** e2e
- **Given** the fake GIF service
- **When** the person opens the GIF picker, types words, and sends a result
- **Then** results show within 2 seconds, the chosen GIF is sent as a message and plays for everyone; with the service down the picker shows "GIFs aren't available right now. Try again later."

### TC-F03-45: Reduce motion, pause, descriptions
- **Covers:** AC-F03-25
- **Level:** e2e
- **Given** the system "reduce motion" turned on in one window and off in another
- **When** a GIF and a sticker are sent
- **Then** the first window shows the still picture with a Play button; the second plays and has a Pause button that stops it; both the GIF and the sticker have text descriptions that a screen reader reads

### TC-F03-46: Stickers in the app
- **Covers:** AC-F03-26
- **Level:** e2e
- **Given** the sticker picker
- **When** the person sends a sticker, with all network except the app blocked
- **Then** the sticker shows for everyone and no request went to an outside service

### TC-F03-47: Sticker message checks
- **Covers:** AC-F03-26, AC-F03-24
- **Level:** integration
- **Given** M1 in a call
- **When** M1 sends a known sticker, an unknown sticker name, a GIF whose image address is not on the GIF service's image host, and a GIF with a `javascript:` address
- **Then** only the known sticker (stored as its name only) is accepted; the others get `CHAT_INVALID`

### TC-F03-48: Workspace turns GIFs off
- **Covers:** AC-F03-27
- **Level:** integration
- **Given** W1 `allowGifs` false (changed by the owner and the admin; a member tries and is refused)
- **When** M1 searches GIFs and sends a GIF message
- **Then** both are refused `CHAT_GIFS_OFF`; text, stickers and files still work; setting it back to true allows GIFs; W2's workspace is not affected

### TC-F03-49: GIF button hidden and one-time notice
- **Covers:** AC-F03-27
- **Level:** e2e
- **Given** GIFs on, first use
- **When** the person opens the GIF picker for the first time, taps "Got it", closes and opens again; then the admin turns GIFs off
- **Then** the notice that search words are sent to the GIF service shows once; after GIFs are off the GIF button is hidden in meetings of that workspace

### Files and pictures

### TC-F03-50: File type checks
- **Covers:** AC-F03-28, AC-F03-30
- **Level:** unit
- **Given** the file checker and the sample files
- **When** each is checked: PNG, JPEG, GIF, WebP, PDF, TXT, CSV, DOCX, XLSX, PPTX; and `.exe` renamed `.pdf`, `.doc`, `.xls`, `.ppt`, `.docm` / `.xlsm` / `.pptm`, a ZIP with `vbaProject.bin`, a plain ZIP, TXT with invalid UTF-8, TXT with control characters, an SVG, an HTML file named `.png`
- **Then** the first group is allowed with the right media type; all others are refused by real content, whatever their name says

### TC-F03-51: Upload and send allowed files
- **Covers:** AC-F03-28
- **Level:** integration
- **Given** M1 and E1 in a call
- **When** each uploads every allowed type (up to 25 MB exactly) and sends 10 files in one message, and an 11th file in a message
- **Then** files are stored privately with the checked media type and cleaned names; pictures get a preview up to 480 px; the 11th is refused `CHAT_INVALID`; if a preview can't be made the attachment still downloads; text and CSV are stored as `text/plain; charset=utf-8`

### TC-F03-52: Refused files store nothing
- **Covers:** AC-F03-30
- **Level:** integration
- **Given** M1 in a call
- **When** M1 uploads 25 MB + 1 byte, a renamed `.exe`, a `.doc`, a macro file, a file with a different type than its name, an empty file
- **Then** the first gets `CHAT_FILE_TOO_BIG`, the others `CHAT_FILE_TYPE`; no storage object, no attachment row; the app shows "Files can be up to 25 MB" or "This kind of file can't be sent"

### TC-F03-53: Attach, preview, download in the app
- **Covers:** AC-F03-28, AC-F03-31
- **Level:** e2e
- **Given** M1 and M2 in a meeting
- **When** M1 attaches a picture and a PDF with the Attach button and sends; M2 clicks Download and chooses a place in the Save dialog
- **Then** the picture shows a small preview; the PDF shows name, size and Download; the file is saved where M2 chose; the app never opens or runs it; a broken preview shows name and Download

### TC-F03-54: Drop area counting
- **Covers:** AC-F03-29
- **Level:** unit
- **Given** the drop area logic
- **When** `dragenter` and `dragleave` fire across child elements in many orders, then `drop`
- **Then** the area shows while the drag is inside and hides only when the drag has really left; `drop` hides it

### TC-F03-55: Drag, drop and paste in the app
- **Covers:** AC-F03-29, AC-F03-33
- **Level:** e2e
- **Given** M1 (panel closed) and G1
- **When** M1 drags 2 files over the window, drags back out, drags in again and drops; pastes a picture; drops an `.exe`; G1 drags a file
- **Then** "Drop files to share in chat" shows over the panel (panel opens), disappears on drag out; dropped and pasted files appear as chips ready to send; the `.exe` is refused with the type message; G1 sees no drop area

### TC-F03-56: Download links
- **Covers:** AC-F03-31
- **Level:** integration
- **Given** a file in M1's message
- **When** M2 asks for a link, the link is used right away, after 4 minutes and after 6 minutes (fake clock); an outsider, a person removed, a guest who left, and a person in the lobby ask for links
- **Then** M2's link works up to 5 minutes and stops after; others get `NOT_FOUND` and no link; after the meeting a member and an external reader get links; the link has `Content-Disposition: attachment`

### TC-F03-57: Picture details removed
- **Covers:** AC-F03-32
- **Level:** integration
- **Given** a JPEG with GPS, camera model, and a sideways orientation flag
- **When** it is uploaded and sent, and read back from storage with sharp
- **Then** the stored copy and the preview have no GPS, camera or other metadata, and are turned the right way up; an animated GIF keeps its animation

### TC-F03-58: Guest upload refused
- **Covers:** AC-F03-33
- **Level:** integration
- **Given** G1 in a call
- **When** G1 posts an upload, sends a message with `attachmentIds` of another person's file, and asks for a link to a file
- **Then** the upload is refused `NOT_FOUND` and nothing is stored; the message is refused; G1 may read allowed messages but gets no file link

### TC-F03-59: Guest has no attach button
- **Covers:** AC-F03-33
- **Level:** e2e
- **Given** a guest window
- **When** the composer is shown and a file is pasted
- **Then** there is no Attach button and pasting a file does nothing

### TC-F03-60: File limits
- **Covers:** AC-F03-34
- **Level:** integration
- **Given** M1 in a call
- **When** M1 uploads 11 files within a minute; uploads (many people, in parallel) until the meeting has 500 MB, including unsent ones; then a file is deleted
- **Then** the 11th gets `CHAT_FILE_RATE`; the file that would pass 500 MB gets `CHAT_MEETING_FILES_FULL` even when two uploads race; deleting frees space; unsent files are deleted after 1 hour (fake clock)

### TC-F03-61: File limit messages
- **Covers:** AC-F03-34
- **Level:** e2e
- **Given** the limits made small in test settings
- **When** the person sends too many files, then the meeting is full
- **Then** "You can send up to 10 files a minute" and "This meeting has reached its file limit" show

### Meeting chat setting

### TC-F03-62: Chat Off blocks every writing route
- **Covers:** AC-F03-35
- **Level:** integration
- **Given** chat mode `off`
- **When** M1 tries message, edit, upload, GIF, sticker, reaction, poll create and vote, and tries to read
- **Then** every writing route gives `CHAT_OFF`; reading works during and after the meeting; the organizer's delete and pin still work (moderation)

### TC-F03-63: Chat Off in the app
- **Covers:** AC-F03-35, AC-F03-37
- **Level:** e2e
- **Given** organizer O and M2 in a meeting with messages
- **When** O sets chat to Off in Meeting options, then On, then "In-meeting only"
- **Then** M2 sees the note ("<name> turned chat off" and the others) within 2 seconds, the composer is replaced by "Chat is turned off for this meeting" while off, and earlier messages stay readable

### TC-F03-64: In-meeting only readers
- **Covers:** AC-F03-36
- **Level:** integration
- **Given** meetings ended with mode `on`, `off` and `in_meeting`, and a link meeting with two calls (first `in_meeting`, second `on`)
- **When** member M2, external E1, the organizer and C1 read afterwards; the mode is changed between calls and after the end
- **Then** for `in_meeting` only organizer and C1 can read (others `NOT_FOUND`); for `on` and `off` M2 and E1 can; the most recent ended call's value counts; changing the mode after the end does not change who reads that call

### TC-F03-65: Changing the setting
- **Covers:** AC-F03-37, AC-F03-38
- **Level:** integration
- **Given** a running call
- **When** the organizer, C1, P1, M2 and G1 change `chatMode` through `PATCH /meetings/:id/options`
- **Then** organizer and C1 succeed (room metadata updated, system note saved, `chat_mode_changed` received by the test participant within 2 seconds); the others get 403 or `NOT_FOUND` as in F02 and nothing changes

### TC-F03-66: Setting named in the notes
- **Covers:** AC-F03-37
- **Level:** unit
- **Given** the system note renderer
- **When** given each mode change
- **Then** the text is "<name> turned chat off", "<name> turned chat on" or "<name> limited chat to the meeting"

### Who can chat

### TC-F03-67: Lobby sees nothing
- **Covers:** AC-F03-39
- **Level:** integration
- **Given** M2 waiting in the lobby, then admitted
- **When** M2 reads, sends, reacts and asks for files while waiting, and again after admission
- **Then** every call while waiting is `NOT_FOUND`, and no `meetapp.chat` data reaches M2's pass; after admission M2 gets the history as in AC-F03-02

### TC-F03-68: Removed person loses chat
- **Covers:** AC-F03-40
- **Level:** integration
- **Given** M2 in a call, then removed by the organizer
- **When** new messages are sent and M2 tries to read, send, ask for file links, and open the chat after the meeting through the meeting route
- **Then** M2 gets nothing and every attempt is `NOT_FOUND` within 2 seconds of removal; the removed person's earlier messages stay for others

### TC-F03-69: Removed window stops receiving
- **Covers:** AC-F03-40
- **Level:** e2e
- **Given** organizer O, M2 and M3
- **When** O removes M2 and M3 sends a message
- **Then** M2's window leaves the meeting, clears chat, file links and previews in memory within 2 seconds, and M2 has no Open chat for this meeting afterwards

### TC-F03-70: Guest who left
- **Covers:** AC-F03-41
- **Level:** integration
- **Given** G1 in a call with messages and files
- **When** G1 leaves, then tries to read and get file links with the old ticket, and later rejoins during the call
- **Then** after leaving everything is `NOT_FOUND` and G1 has no after-meeting route; on rejoin a new ticket gives the history again; after the call ended a rejoin is not possible

### After the meeting

### TC-F03-71: After-meeting readers
- **Covers:** AC-F03-42
- **Level:** integration
- **Given** an ended meeting with chat On and messages, files and a poll
- **When** M2 (took part), E1 (external, took part), M4 (workspace member who did not take part), G1 (guest), a removed person, an outsider, and X1 (another workspace) read the chat, files and polls through `/meetings/:id/…`
- **Then** M2 and E1 can read, with files and poll results; the rest get `NOT_FOUND`; nobody (except organizer and C1 deleting) can write or edit

### TC-F03-72: Open chat from the meetings list
- **Covers:** AC-F03-42
- **Level:** e2e
- **Given** an ended meeting
- **When** M2 opens the meetings list (Recent meetings) and chooses Open chat
- **Then** the chat opens read-only (no composer, reactions, reply, edit or delete; Copy text stays), files download, organizer sees Delete on others' messages; a person who may not read it (removed) sees no Open chat

### TC-F03-73: Meeting deletion removes chat
- **Covers:** AC-F03-43
- **Level:** integration
- **Given** a meeting with messages, reactions, polls, pins, events and files
- **When** the meeting record is deleted or expires (fake clock)
- **Then** all its chat rows are gone (cascade) and the clean-up job deletes its files from storage; other meetings' chats are untouched

### TC-F03-74: Account deletion and data export
- **Covers:** AC-F03-44
- **Level:** integration
- **Given** M1 with messages, files, reactions and non-anonymous votes; M2 with a vote in an anonymous poll
- **When** M1 deletes the account and the deletion job runs (within 30 days, fake clock); a data export is run for M2 before
- **Then** M1's `body`, `plain_text` and files are removed, `sender_user_id` empty, name "Deleted user", messages show "Deleted user · message removed", M1's reactions and named votes are removed; others' messages are intact; the export includes the person's own messages and files

### Accessibility and languages

### TC-F03-75: Keyboard-only chat
- **Covers:** AC-F03-45
- **Level:** e2e
- **Given** a window used with keyboard only, and screen reader announcements captured from the live region
- **When** the person opens chat, writes, formats, sends, attaches (file dialog), reacts, replies, pins (organizer), creates and votes in a poll, uses the GIF and sticker pickers, edits and deletes
- **Then** every step works with the keyboard; focus is never lost or trapped; each new message is announced with sender and text

### TC-F03-76: Accessibility checks of components
- **Covers:** AC-F03-45
- **Level:** unit
- **Given** each new component story (ReactionChip, FileChip, ChatMessage, MessageActions, ReplyQuote, CodeBlock, FileCard, ImagePreview, PollOption, SystemNote, PinnedBar, ChatComposer, FormatToolbar, EmojiPicker, GifPicker, StickerPicker, PollCard, PollCreator, DropArea, ChatPanel)
- **When** the axe check and keyboard tests run
- **Then** no accessibility violations; the message list has `role="log"`; every button has a name

### TC-F03-77: Translation keys
- **Covers:** AC-F03-46
- **Level:** unit
- **Given** the translation files for all app languages
- **When** the key check runs
- **Then** every F03 label, error, note and system message exists in every language; no hard-coded text in chat components

### TC-F03-78: Language change in the app
- **Covers:** AC-F03-46
- **Level:** e2e
- **Given** a chat with messages written in English and system notes
- **When** the app language changes
- **Then** buttons, errors, notes ("pinned a message") and the empty state change language; people's own messages stay as written

### Security

### TC-F03-79: Outsider sweep on every new route, security
- **Covers:** AC-F03-39, AC-F03-40, AC-F03-42, AC-F03-31
- **Level:** security
- **Given** an outsider (signed in, other workspace), a person in the same workspace not in the meeting, a lobby person, a removed person, a guest ticket of another meeting, no sign-in, and a valid ticket for another call
- **When** each calls every route in design section 8 (messages list, one message, events, send, edit, delete, reactions add and remove, pins add and remove, polls create, read, vote, close, attachments upload and link, GIFs, the `/meetings/:id/…` routes, and the two settings changes)
- **Then** every route answers `NOT_FOUND` (or 401 when not signed in) with the same status, body shape and message as for a meeting that does not exist; nothing is stored and nothing is broadcast. The route list is generated from the router so a new route without a sweep fails the test

### TC-F03-80: Other workspace and other meeting, security
- **Covers:** AC-F03-31, AC-F03-42
- **Level:** security
- **Given** meetings A (W1) and B (W2), and attachment, message, poll and reply ids from A
- **When** a person of B uses those ids on B's routes (`replyToId`, `attachmentIds`, poll vote, pin `messageId`, reactions, link) and a person of A uses B's ids
- **Then** all are refused with `NOT_FOUND`; no content or existence is revealed; a message cannot quote or pin another meeting's message

### TC-F03-81: Script and HTML in messages, security
- **Covers:** AC-F03-04, AC-F03-17
- **Level:** security
- **Given** M1 sends `<img src=x onerror=window.pwned=1>`, `<script>`, `"><svg onload=…>`, a code block with HTML, a message with a CSS style, and a prompt-style text ("ignore previous instructions")
- **When** M2's window shows each
- **Then** they appear as text exactly as typed; `window.pwned` is never set; no element other than the allowed ones is created in the message (DOM checked); the prompt text is stored as plain data

### TC-F03-82: Script and HTML in names and poll text, security
- **Covers:** AC-F03-28, AC-F03-21, AC-F03-01
- **Level:** security
- **Given** a file named `<img src=x onerror=…>.png`, `../../etc/passwd.pdf`, a name with control characters and 300 characters; a poll question and options with HTML; a guest named `<b>x</b>`; a GIF description with HTML
- **When** they are stored and shown
- **Then** file names are cleaned (no path, no control characters, at most 200); all texts are shown as plain text; nothing runs; the saved file name in the Save dialog is safe

### TC-F03-83: Link schemes, security
- **Covers:** AC-F03-04, AC-F03-15
- **Level:** security
- **Given** messages with `javascript:`, `data:`, `file:`, `vbscript:`, `meetapp:`, `JaVaScRiPt:`, ` javascript:` (leading space or tab or new line), `//evil.com`, and `http://` / `https://` links in text, the Link button and a link mark sent straight to the API
- **When** they are checked by the app and by the server
- **Then** only real http/https links are links; the server refuses a bad `href` with `CHAT_INVALID`; clicking an allowed link opens outside the app only

### TC-F03-84: Content-type spoofing, security
- **Covers:** AC-F03-30
- **Level:** security
- **Given** an `.exe`, an HTML page and an SVG with script, renamed `.png`, `.pdf` and `.txt`, each with a matching `Content-Type` header; a ZIP renamed `.docx`; a valid PNG followed by hidden data
- **When** uploaded
- **Then** all are refused `CHAT_FILE_TYPE` by their real content, except the PNG with trailing data, which is re-saved by sharp so the extra data is gone

### TC-F03-85: Decompression bomb, security
- **Covers:** AC-F03-32, AC-F03-30
- **Level:** security
- **Given** a PNG of 20,000 x 20,000 pixels that is tiny on disk, an animated GIF with 1,000 frames, and a ZIP-based Office file that expands to gigabytes
- **When** uploaded
- **Then** each is refused within a few seconds without the server running out of memory (memory stays under a set limit) and nothing is stored; the API still answers other requests during the test

### TC-F03-86: Safe download headers, security
- **Covers:** AC-F03-31
- **Level:** security
- **Given** stored files of each type, including text and CSV
- **When** each signed link is fetched
- **Then** the answer has `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff` and the stored type (never `text/html` or `image/svg+xml`); the link points to our own backend (`/api/v1/chat-files/:token`), never straight to storage; a link with a changed signature, a changed file id or a passed end time is refused

### TC-F03-87: Logs contain no chat text, security
- **Covers:** AC-F03-01, AC-F03-28, AC-F03-24
- **Level:** security
- **Given** the API's logs captured while the full chat flow runs with unique marker words in message text, edits, file names, poll questions and options, GIF search words, link addresses, GIF descriptions, and a ticket
- **When** all log output (including error cases and rejected requests) is searched
- **Then** none of the marker words, the ticket or file names appear; only ids and counts do; the log-cleaning list contains `body`, `plain_text`, `q`, `question`, option `text`, `href`, `description`, `fileName`

### TC-F03-88: Participant packets on meetapp.chat ignored, security
- **Covers:** AC-F03-01, AC-F03-19
- **Level:** security
- **Given** a test LiveKit participant with an ordinary pass and the desktop app in the same room
- **When** the participant publishes forged `message_created`, `message_deleted`, `pins_changed`, `chat_mode_changed` and `poll_changed` packets on `meetapp.chat` (also with a fake server identity in the payload)
- **Then** the app shows nothing from them and stores nothing; real server packets (no participant identity) are shown

### TC-F03-89: Passes cannot publish chat, security
- **Covers:** AC-F03-01, AC-F03-35
- **Level:** security
- **Given** a decoded LiveKit pass for each role and group
- **When** the pass permissions are checked and a participant tries to publish data on topic `meetapp.chat`
- **Then** the pass has no room admin rights; LiveKit can't limit data by topic (checked in T1), so the app drops every `meetapp.chat` packet sent by a participant; the server remains the only trusted sender on `meetapp.chat`; chat mode Off cannot be bypassed by publishing straight to the room, because nothing published by a participant is shown or stored

### TC-F03-90: GIF search sends no personal data, security
- **Covers:** AC-F03-24, AC-F03-27
- **Level:** security (desktop)
- **Given** `GIF_API_URL` pointing at a fake KLIPY service that logs full requests (address, query, headers, body), and M1 with a known name, email, user id, meeting id and ticket
- **When** M1 opens the GIF picker, searches "cats" and sends a GIF; then the workspace turns GIFs off and M1 tries again
- **Then** the fake service saw only the key in the address, `q`, the per-meeting `customer_id`, `locale`, `per_page` and the family-safe `content_filter`, with no ad settings and no name, email, user id, meeting id, ticket or our sign-in token in any header; GIF images load only from the allowed image host; with GIFs off the picker is hidden and no request reaches the service; the app's content security policy allows `api.klipy.com` in `connect-src` and `static.klipy.com` in `img-src` and nothing else from KLIPY


### TC-F03-91: Chat for AI reads only what the person can read, security
- **Covers:** AC-F03-42
- **Level:** security
- **Given** the chat reading helper that F06 and F07 will use
- **When** M2 (took part), an in-meeting-only meeting's attendee, a removed person and an outsider ask it for chat text; and the text contains "ignore all previous instructions"
- **Then** it returns chats only where the same rule as AC-F03-42 allows reading; the text is returned wrapped as data (marked as chat content), never as instructions

### Delivery, size and catching up

### TC-F03-92: Large events and reconnect catch-up
- **Covers:** AC-F03-01, AC-F03-13, AC-F03-16
- **Level:** integration
- **Given** the test participant receiving `meetapp.chat` and a message with a code block over 14 KB
- **When** it is sent; the participant disconnects, 60 messages and an edit happen, and it reconnects; and again after the events kept for 1 day have been cleaned (fake clock)
- **Then** the large message arrives as `{ type, id, seq }` only and is fetched by id; after reconnecting, `GET …/chat/events?after=` gives all missed events in order and the app shows each once; with the gap too old the app reloads the pinned list and visible pages; no event is lost or shown twice

### TC-F03-93: Drag and drop never navigates the window
- **Covers:** AC-F03-29
- **Level:** e2e
- **Given** the meeting window
- **When** a file is dropped on the chat panel, the videos, and the window edge
- **Then** the window never navigates to the file; the file goes to the message box as a chip (on the chat panel and elsewhere in the window); the content security policy blocks any other outside image host

### Permissions table and visual

### TC-F03-94: Permissions table
- **Covers:** AC-F03-10, AC-F03-11, AC-F03-19, AC-F03-21, AC-F03-33, AC-F03-35, AC-F03-36, AC-F03-38, AC-F03-42
- **Level:** unit
- **Given** `chat/permissions.ts`
- **When** every action is checked for every role (organizer, co-organizer, presenter, attendee) and group (member, external, guest) and attendance state (lobby, in call, left, removed), with each chat mode, during and after the meeting
- **Then** the result matches the table in design 3.1 for every combination, and lobby, left and removed always get nothing

### TC-F03-95: Screenshots
- **Covers:** AC-F03-45, AC-F03-01
- **Level:** visual
- **Given** the stories of all new components (all states: sending, Not sent, edited, deleted, reactions, reply, code, files, poll open and closed, pinned bar, drop area, chat off) and the chat panel
- **When** screenshots are taken in the light and dark themes
- **Then** they match the approved designs (canvas "In-meeting chat (F03)")

## Coverage
| Acceptance criterion | Test cases |
|---|---|
| AC-F03-01 | TC-F03-01, 02, 82, 87, 88, 89, 92, 95 |
| AC-F03-02 | TC-F03-03, 04 |
| AC-F03-03 | TC-F03-05, 06, 07, 32 |
| AC-F03-04 | TC-F03-08, 09, 81, 83 |
| AC-F03-05 | TC-F03-10, 11, 12 |
| AC-F03-06 | TC-F03-13, 14 |
| AC-F03-07 | TC-F03-15 |
| AC-F03-08 | TC-F03-16 |
| AC-F03-09 | TC-F03-17 |
| AC-F03-10 | TC-F03-18, 19, 21, 94 |
| AC-F03-11 | TC-F03-18, 20, 21, 94 |
| AC-F03-12 | TC-F03-22 |
| AC-F03-13 | TC-F03-23, 24, 92 |
| AC-F03-14 | TC-F03-25, 26 |
| AC-F03-15 | TC-F03-08, 27, 28, 83 |
| AC-F03-16 | TC-F03-29, 30, 92 |
| AC-F03-17 | TC-F03-05, 08, 27, 31, 32, 81 |
| AC-F03-18 | TC-F03-33, 34 |
| AC-F03-19 | TC-F03-35, 36, 88, 94 |
| AC-F03-20 | TC-F03-35, 36 |
| AC-F03-21 | TC-F03-37, 42, 82, 94 |
| AC-F03-22 | TC-F03-38, 39, 40, 42 |
| AC-F03-23 | TC-F03-37, 38, 41, 42 |
| AC-F03-24 | TC-F03-43, 44, 47, 87, 90 |
| AC-F03-25 | TC-F03-45 |
| AC-F03-26 | TC-F03-46, 47 |
| AC-F03-27 | TC-F03-43, 48, 49, 90 |
| AC-F03-28 | TC-F03-50, 51, 53, 82, 87 |
| AC-F03-29 | TC-F03-54, 55, 93 |
| AC-F03-30 | TC-F03-12, 50, 52, 84, 85 |
| AC-F03-31 | TC-F03-53, 56, 79, 80, 86 |
| AC-F03-32 | TC-F03-57, 85 |
| AC-F03-33 | TC-F03-55, 58, 59, 94 |
| AC-F03-34 | TC-F03-60, 61 |
| AC-F03-35 | TC-F03-62, 63, 89, 94 |
| AC-F03-36 | TC-F03-64, 94 |
| AC-F03-37 | TC-F03-63, 65, 66 |
| AC-F03-38 | TC-F03-65, 94 |
| AC-F03-39 | TC-F03-67, 79 |
| AC-F03-40 | TC-F03-68, 69, 79 |
| AC-F03-41 | TC-F03-04, 70 |
| AC-F03-42 | TC-F03-41, 71, 72, 79, 80, 91, 94 |
| AC-F03-43 | TC-F03-73 |
| AC-F03-44 | TC-F03-74 |
| AC-F03-45 | TC-F03-75, 76, 95 |
| AC-F03-46 | TC-F03-77, 78 |

**Total: 95 test cases.** Every AC (AC-F03-01 to AC-F03-46) appears in at least one row above. Every rule in the "Security & privacy" sections has a security case: S1/S2 (79, 80), S5 (13, 43, 60), S10 (87, 40), S11 (81, 82, 83), S12 (84, 85, 86, 56), S14 (91, 81), S17 (93, 90), LiveKit server-only events (88, 89), GIF privacy (43, 90), spell check privacy (34).
