---
feature: F02
title: Meetings & calling
status: approved
updated: 2026-10-14
---

# F02 Meetings & calling: Test Cases

Written **before** the code. Each test case becomes an automated test, except **manual** ones (recorded in `verification.md`).
Levels: unit · integration · security (integration-style attempts to break rules) · e2e (desktop: real Electron windows, Playwright) · load · visual (Storybook screenshots) · manual.

Test names must include the TC and AC IDs, e.g. `TC-F02-14 [AC-F02-03] link and ID+passcode resolve only their own meeting`.

**Test set-up (design.md "Test approach"):**
- Integration and security tests use real PostgreSQL, Redis and the real local LiveKit; webhooks are signed test events posted to `/livekit/webhook`. Passes (tokens) are decoded and checked.
- Seeded users in two workspaces: W1 (owner, admin, member M1, M2) and W2 (member X1); a personal workspace per user. "Outsider" = signed-in user not in the meeting's workspace and not in the meeting; "guest" = no account, with a lookup token and ticket.
- "Same answer" = same status code, body shape and message. Timing checks compare the median of 30 calls with a margin of 150 ms or 30%, whichever is larger.
- Time rules (expiry, 15-minute lobby, 30-hour jobs, reuse windows) use a fake clock on the server.
- Desktop e2e uses 2 or 3 windows, Chromium's fake camera and mic, a fake screen source, and cuts the network by blocking the LiveKit port.
- **Load** cases run with `pnpm test:load` (separate from `pnpm test`, several minutes, like `test:monitoring`): 99 simulated participants with video from `lk perf load-test` in the `livekit/livekit-cli` container against the local LiveKit; the desktop app is the 100th.
- Security S-rules: S1 and S2 (who may see what), S3 (guessing), S4 (pass scope), S5 (rate limits), S6 (encryption), S10 (logs), S11 (HTML), S17 (desktop).

## Test cases

### Making a meeting

### TC-F02-01: Secret formats
- **Covers:** AC-F02-03
- **Level:** unit
- **Given** the secret generators
- **When** 10,000 meetings' secrets are drawn
- **Then** every link part is 22 base64url characters (128 random bits), every ID is 12 digits with a first digit other than 0, every passcode is 6 characters from letters and digits without 0/O/1/l/I; no link part repeats; an ID already taken causes a new draw

### TC-F02-02: Meet now creates a meeting
- **Covers:** AC-F02-01, AC-F02-03
- **Level:** integration
- **Given** member M1 of W1
- **When** `POST /workspaces/W1/meetings { kind: "meet_now" }` is sent
- **Then** a meeting titled "Meeting with <M1's name>" exists in W1 with M1 as organizer, `expires_at` = creation + 60 days, defaults (lobby `workspace`, present `everyone`, mic and camera allowed), and the answer includes a `lookupToken` for M1

### TC-F02-03: Get a meeting link, with and without a title
- **Covers:** AC-F02-02, AC-F02-03
- **Level:** integration
- **Given** member M1
- **When** M1 creates `kind: "link"` with title " Weekly sync " and then without a title, and then with 101 characters
- **Then** the first is titled "Weekly sync" (trimmed), the second "Meeting with <name>", the third is refused 400; no call or attendance exists for any; M1 can read link, ID and passcode and change options before anyone joins

### TC-F02-04: Link, or ID plus passcode, lead to that meeting only
- **Covers:** AC-F02-03, AC-F02-08
- **Level:** integration
- **Given** meetings A and B
- **When** A's link, A's ID+A's passcode, then A's ID+B's passcode, and B's ID+A's passcode are looked up
- **Then** the first two resolve to A; the mixed ones answer 404 `MEETING_NOT_FOUND`

### TC-F02-05: Link and passcode cannot be read from the database
- **Covers:** AC-F02-03, AC-F02-52
- **Level:** security
- **Given** a created meeting
- **When** every column of its rows (and a full table dump) is searched for the link part and the passcode
- **Then** neither appears in plain text; `link_secret` and `passcode` are AES-256-GCM encrypted with a key version; lookups use only `link_lookup` and `passcode_check` HMAC columns

### TC-F02-06: Expiry calculation
- **Covers:** AC-F02-04
- **Level:** unit
- **Given** the expiry function
- **When** it is fed Meet now and link meetings with created, last-joined and last-changed times
- **Then** Meet now expires exactly 60 days after creation whatever happens; a link meeting 60 days after the latest join into the call or change; lobby and deny times are ignored; 59 d 23 h is still valid, 60 d is expired

### TC-F02-07: Expiry with a moved clock
- **Covers:** AC-F02-04
- **Level:** integration
- **Given** one Meet now and one link meeting
- **When** time moves 59 days, then a person is admitted into the link meeting's call, then another waits in the lobby and a third is denied, then time moves 59 more days; separately a title change and an option change are made
- **Then** the Meet now meeting is expired at day 60 even after joins; the link meeting stays valid because of the join (and of each title or option change) but not because of lobby waiting or denial

### TC-F02-08: Expired message only with the right secret
- **Covers:** AC-F02-04, AC-F02-08, AC-F02-48
- **Level:** security
- **Given** an expired meeting with known link, ID and passcode
- **When** it is looked up with the right link, the right ID+passcode, a wrong passcode, and an unknown ID
- **Then** the right secrets answer "This meeting has expired" (`MEETING_EXPIRED`); the wrong ones answer the normal `MEETING_NOT_FOUND`, identical to an unknown meeting

### TC-F02-09: 50 meetings an hour
- **Covers:** AC-F02-05
- **Level:** integration
- **Given** a member who has created 50 meetings in the last hour
- **When** they create the 51st, then time moves on until the oldest is an hour old
- **Then** the 51st is refused 429 `TOO_MANY_ATTEMPTS` with the wait time; afterwards creating works again; another user is not affected

### TC-F02-10: Personal workspace meetings
- **Covers:** AC-F02-06
- **Level:** integration
- **Given** user P with a personal workspace
- **When** P creates a meeting; another signed-in user E and a guest join; P tries to name a co-organizer; P turns Allow guests off
- **Then** E counts as external and the guest as guest, both wait in the lobby by default; the co-organizer request is refused 400; with guests off the guest is refused `GUESTS_NOT_ALLOWED`; P (the only member) enters directly

### TC-F02-11: Organizer leaves the workspace
- **Covers:** AC-F02-07
- **Level:** integration
- **Given** a meeting organized by M2 in W1
- **When** M2 is removed from W1 (and separately leaves W1)
- **Then** a lookup with the right secret answers `MEETING_EXPIRED`, a lookup with a wrong secret answers the normal not-found, and new joins are refused; people already inside stay

### TC-F02-12: Double click makes one meeting
- **Covers:** AC-F02-46
- **Level:** integration
- **Given** one Idempotency-Key
- **When** two create requests with it are sent at the same moment
- **Then** exactly one meeting exists and both answers describe it

### TC-F02-13: Meet now flow in the app
- **Covers:** AC-F02-01
- **Level:** e2e
- **Given** M1 signed in on the Meetings page
- **When** M1 presses Meet now, joins, and opens Meeting info
- **Then** the pre-join screen shows the title "Meeting with <name>"; inside the meeting Meeting info shows link, ID and passcode and Copy puts each on the clipboard

### TC-F02-14: Get link flow in the app
- **Covers:** AC-F02-02
- **Level:** e2e
- **Given** M1 on the Meetings page
- **When** M1 presses Get a meeting link, types a title, copies the three values and opens Meeting options
- **Then** the link-ready dialog shows link, ID, passcode with Copy buttons, the app does not join the call, and Meeting options open with defaults

### Joining

### TC-F02-15: Lookup answers
- **Covers:** AC-F02-08, AC-F02-14, AC-F02-50
- **Level:** integration
- **Given** a meeting with people inside and in the lobby
- **When** a member, an external user and a signed-out guest each look it up by link and by ID+passcode
- **Then** each gets only the title, a 15-minute `lookupToken` and their group (member, external or guest); nothing about who is inside, the organizer or the options

### TC-F02-16: Every miss gives the same answer
- **Covers:** AC-F02-08, AC-F02-48
- **Level:** security
- **Given** a real meeting
- **When** misses are sent: unknown link, malformed link, unknown ID, right ID with wrong passcode, wrong ID with a right passcode, empty body fields
- **Then** all valid-format misses answer the same 404 `MEETING_NOT_FOUND` with the same body and message (malformed input gets the same 404, not a hint); none says whether the meeting exists

### TC-F02-17: Same timing for hit and miss
- **Covers:** AC-F02-48
- **Level:** security
- **Given** a real meeting
- **When** 30 misses (unknown ID, wrong passcode) and 30 hits are timed
- **Then** the medians are within the margin; every miss takes at least the fixed minimum response time

### TC-F02-18: Join a meeting in the app
- **Covers:** AC-F02-08
- **Level:** e2e
- **Given** the Meetings page and the sign-in screen
- **When** a member pastes a link, then types ID+passcode on the other tab; a signed-out guest uses Join a meeting on the sign-in screen; a wrong value is tried
- **Then** each right value reaches the pre-join with the title; the wrong value shows "We couldn't find that meeting. Check the link, or the ID and passcode." and nothing more; an expired meeting shows "This meeting has expired"

### TC-F02-19: Pre-join devices
- **Covers:** AC-F02-09
- **Level:** e2e
- **Given** the pre-join with fake camera and mic
- **When** the user sees the preview, watches the meter move, presses Test speakers, picks another camera/mic/speaker, turns camera and mic off, joins, closes and reopens the app
- **Then** preview and meter work, a sound plays on the chosen speakers, the camera and mic are off on entry, and the choices are remembered on the next pre-join

### TC-F02-20: Device problems on pre-join
- **Covers:** AC-F02-10
- **Level:** e2e
- **Given** the camera missing, then in use by another app, then permission denied (macOS status mocked); same for the microphone
- **When** the pre-join opens
- **Then** it names which device and how to fix it (the System Settings path for denied), and **Join now** still works without it

### TC-F02-21: Guest name and terms text
- **Covers:** AC-F02-11
- **Level:** e2e
- **Given** a guest on the pre-join
- **When** the name is empty, 61 characters, 1 character, 60 characters
- **Then** Join now is blocked for the first two with a message; the last two join; "By joining, you agree to the Terms and the Privacy Policy" is shown as plain text

### TC-F02-22: Guest name checks on the server
- **Covers:** AC-F02-11, AC-F02-51
- **Level:** integration
- **Given** a guest lookup token
- **When** `POST /meetings/join` is sent with names of 0, 1, 60, 61 characters, spaces only, and control characters
- **Then** 0, 61 and spaces-only are refused 400; control characters are removed; names are trimmed

### TC-F02-23: Same account on two computers
- **Covers:** AC-F02-13
- **Level:** integration
- **Given** M1 in a meeting
- **When** M1 joins again with a different device key
- **Then** two attendances with different IDs, tickets and passes exist, and the call count is 2

### TC-F02-24: Same account twice in the app
- **Covers:** AC-F02-13
- **Level:** e2e
- **Given** two windows signed in as M1
- **When** both join the same meeting
- **Then** a third window sees two participants named M1; leaving in one does not remove the other

### TC-F02-25: Joining takes under 3 seconds
- **Covers:** AC-F02-12
- **Level:** load
- **Given** `pnpm test:load` with the local LiveKit and the pre-join warmed up (`prepareConnection`)
- **When** the 100th participant presses **Join now** into a meeting with 99 simulated (and into an empty one), 20 times
- **Then** the time from click to the first remote audio is under 3 s in the 95th percentile of runs

### Lobby

### TC-F02-26: Default lobby rule
- **Covers:** AC-F02-14
- **Level:** integration
- **Given** a call with the organizer inside and the default setting
- **When** a member, an external user and a guest join
- **Then** the member gets status `in call` with a pass; the external user and the guest get `waiting` with no pass and see only the title

### TC-F02-27: Lobby rule decisions
- **Covers:** AC-F02-14, AC-F02-16, AC-F02-17, AC-F02-35
- **Level:** unit
- **Given** the lobby decision function
- **When** every combination of group (member, external, guest), setting (everyone, workspace, organizers), role (organizer, co-organizer, other), "account inside" yes/no, and "removed in this call" yes/no is tried
- **Then** organizer and co-organizers always skip; a removed person always waits; guests skip only with `everyone` AND an account inside; otherwise the table of requirements.md holds

### TC-F02-28: Changing Who can skip the lobby
- **Covers:** AC-F02-16
- **Level:** integration
- **Given** a call with a person waiting in the lobby
- **When** a co-organizer changes the setting to Everyone, then Only me and co-organizers; a presenter and an attendee try the same
- **Then** the waiting person stays waiting; people joining afterwards follow the new setting; presenter and attendee get 404 `NOT_ALLOWED`

### TC-F02-29: Guests alone wait
- **Covers:** AC-F02-17
- **Level:** integration
- **Given** lobby setting Everyone and no account inside (the call is empty)
- **When** two guests join, and then a member joins
- **Then** the guests are `waiting`; when the member enters, the guests are let in automatically on their next ask

### TC-F02-30: Lobby list only for lobby rights
- **Covers:** AC-F02-15, AC-F02-26
- **Level:** integration
- **Given** two waiting people (one external, one guest)
- **When** the organizer, a co-organizer, a presenter, an attendee and a waiting person call `GET /calls/:id/lobby`
- **Then** the first three get the count and names with "(External)" or "(Guest)"; the attendee and the waiting person get 404; no email appears

### TC-F02-31: Admit, deny and Admit all
- **Covers:** AC-F02-15
- **Level:** integration
- **Given** four waiting people
- **When** one is admitted, one denied, then Admit all is pressed
- **Then** the admitted person's next ask carries a pass; the denied person's next ask says `denied`; Admit all admits the rest in arrival order; `acted_by` is recorded

### TC-F02-32: Lobby in the app
- **Covers:** AC-F02-14, AC-F02-15
- **Level:** e2e
- **Given** the organizer inside and a guest and an external user waiting
- **When** the guest is admitted and the external user denied
- **Then** the waiting screen shows the title and "Someone in the meeting will let you in soon" and no names; the organizer sees a notice with the count and names with "(Guest)"/"(External)"; the guest enters within about 2 s; the other sees "You've been denied entry" and leaves

### TC-F02-33: 15-minute lobby wait
- **Covers:** AC-F02-18
- **Level:** integration
- **Given** a waiting person
- **When** the clock moves to 14 min 59 s and the person asks, then to 15 min 00 s and they ask; and in another case they stop asking and the clean-up job runs
- **Then** the first ask says `waiting`; the second says `timed_out` ("Nobody let you in"); the clean-up job also times out the one who stopped asking, and a person with no ask for 60 s no longer counts as present in the lobby list

### TC-F02-34: Lobby survives the last person leaving
- **Covers:** AC-F02-18, AC-F02-17
- **Level:** integration
- **Given** a call with one member inside and a guest waiting
- **When** the member leaves and the room finishes, and later another member joins
- **Then** the guest is still `waiting` (not timed out early); the new member starts a new call and the guest can be admitted into it

### TC-F02-35: Lobby holds 100
- **Covers:** AC-F02-19
- **Level:** integration
- **Given** 100 waiting people
- **When** a 101st guest joins
- **Then** it is refused `LOBBY_FULL` ("This meeting is full"); after one waiting person leaves, a new guest can wait

### TC-F02-36: Two Admits at once
- **Covers:** AC-F02-15
- **Level:** integration
- **Given** one waiting guest and two lobby-rights holders
- **When** both press Admit for the guest at the same moment
- **Then** both answers are success, the guest is admitted once, and the call count rose by 1

### TC-F02-37: Two first joins at once
- **Covers:** AC-F02-12, AC-F02-13
- **Level:** integration
- **Given** a meeting with no running call
- **When** the organizer and a member join at the same moment
- **Then** exactly one `calls` row with `ended_at` empty and one LiveKit room exist; both attendances point to it

### TC-F02-38: Capacity 99, 100 and 101
- **Covers:** AC-F02-42
- **Level:** integration
- **Given** a call with 99 people (admitted plus in call)
- **When** two members join at the same moment, then a 101st tries
- **Then** exactly one of the two gets in (100), the other and the 101st get `MEETING_FULL` ("This meeting is full (100 people)"); two parallel joins never reach 101

### TC-F02-39: Admit all with not enough room
- **Covers:** AC-F02-15, AC-F02-42
- **Level:** integration
- **Given** a call with 98 people and 5 waiting
- **When** Admit all is pressed (and at the same time a member joins directly)
- **Then** the total never exceeds 100; the earliest-arrived waiting people fill the free places; the rest keep waiting; the answer tells the admitting person how many didn't fit

### TC-F02-40: Room closed after admission
- **Covers:** AC-F02-14, AC-F02-15
- **Level:** integration
- **Given** a person admitted who never connected, and a LiveKit `room_finished` event for that call
- **When** the person asks for their status
- **Then** they get the join decision again: a member who may skip the lobby gets a pass for the new call; a guest or external person who must wait is `waiting`; the app's "room not found" path calls `GET /attendances/:id` once and gets a pass or `waiting`

### In the meeting

### TC-F02-41: 100 people, gallery and audio
- **Covers:** AC-F02-20
- **Level:** load
- **Given** `pnpm test:load`: 99 simulated participants with video (`lk perf load-test`), the desktop app as the 100th
- **When** the app shows page 1 of the gallery for 60 s, changes pages, and a simulated participant speaks
- **Then** exactly 16 tiles are drawn at 15 frames per second or more; pages hold the rest; the speaker is heard with under 250 ms delay (round-trip time / 2 plus jitter buffer from WebRTC numbers)

### TC-F02-42: Gallery paging
- **Covers:** AC-F02-20, AC-F02-47
- **Level:** unit
- **Given** the gallery with 1, 16, 17, 100 participants
- **When** it renders and pages change
- **Then** at most 16 tiles are rendered, page counts are 1, 1, 2, 7, tiles on hidden pages are not subscribed or drawn

### TC-F02-43: Speaker view and pin
- **Covers:** AC-F02-20
- **Level:** e2e
- **Given** three windows in a meeting
- **When** window A switches to Speaker view, B speaks, then A pins C
- **Then** A shows the speaker large, then C large; B and C windows are unchanged (pin is for A only); pin works in Gallery too

### TC-F02-44: Speaking highlight
- **Covers:** AC-F02-21
- **Level:** e2e
- **Given** two windows, B's fake mic playing a tone
- **When** B starts speaking
- **Then** within 0.5 s in A, B's tile shows a ring and the "Speaking" label with icon (not colour only), its accessible name ends with ", speaking", and the live region announces the speaker (at most one message every 2 s)

### TC-F02-45: Mic and camera changes seen by others
- **Covers:** AC-F02-22
- **Level:** e2e
- **Given** two windows
- **When** B mutes with the button, unmutes with ⌘⇧M (Ctrl+Shift+M), turns the camera off with the button and on with ⌘⇧O
- **Then** A sees each change within 1 s; shortcuts work only on the meeting screen and are not system-wide

### TC-F02-46: Hands: order and lowering rights
- **Covers:** AC-F02-23
- **Level:** integration
- **Given** a call with organizer, presenter P, attendee T1, T2
- **When** T2 then T1 raise hands; T1 lowers their own; P lowers T2's; T1 tries to lower T2's
- **Then** `handRaisedAt` attributes give the order T2, T1; own and presenter lowering work; the attendee lowering another's hand gets 404 `NOT_ALLOWED`

### TC-F02-47: Hands and reactions in the app
- **Covers:** AC-F02-23, AC-F02-24
- **Level:** e2e
- **Given** three windows
- **When** B and then C raise hands (⌘⇧K for one); B sends each of the five reactions
- **Then** hands show on the tiles and in the participant list in raise order; each reaction shows on B's tile for about 3 s in every window and then disappears

### TC-F02-48: Reaction rules
- **Covers:** AC-F02-24
- **Level:** unit
- **Given** the reaction receiver
- **When** data arrives on `meetapp.reaction` with a valid name, an unknown name, extra fields, and 5 messages in one second from one sender
- **Then** only valid names show; others are ignored; extra messages beyond one a second are dropped; sending is limited to one a second

### TC-F02-49: Screen sharing in the app
- **Covers:** AC-F02-25
- **Level:** e2e
- **Given** a presenter A, an attendee B and a third window C, fake screen source
- **When** A picks a source in our picker and shares; then co-organizer D shares
- **Then** C sees the screen large within 2 s; B has no Share button; D's share replaces A's and A sees "Your share ended"

### TC-F02-50: Backend decides share replacement
- **Covers:** AC-F02-25
- **Level:** integration
- **Given** two presenters who publish screen tracks at the same moment (signed `track_published` events in both orders)
- **When** the webhooks are handled
- **Then** the newest track stays; the older one is muted with `MutePublishedTrack`; only its owner gets `share_replaced`; never both shares are stopped; a repeated event changes nothing

### TC-F02-51: Attendee cannot share
- **Covers:** AC-F02-25, AC-F02-49
- **Level:** security
- **Given** an attendee's pass
- **When** a raw `livekit-client` connects with it and tries to publish a screen track (and a presenter's pass does the same)
- **Then** LiveKit refuses the attendee's screen track; the presenter's works

### TC-F02-52: Participant panel
- **Covers:** AC-F02-26
- **Level:** e2e
- **Given** three windows: organizer, external user, guest, one with raised hand and mic off
- **When** the organizer opens the participant list; then an attendee opens it
- **Then** every row shows role, mic and camera state, the hand, and "(External)" or "(Guest)"; the organizer sees the lobby at the top, the attendee does not

### TC-F02-53: Outsiders see names, never emails
- **Covers:** AC-F02-27
- **Level:** integration
- **Given** a meeting with W1 members, external user X1 (W2) and a guest
- **When** X1 and the guest read the LiveKit participant attributes and metadata, and every endpoint they can call; X1 fetches M1's photo
- **Then** names appear, no email appears anywhere; participant attributes carry `userId` only for accounts; M1's photo is returned to X1 only if X1 shares a workspace with M1, otherwise nothing (initials); guests get no photo

### TC-F02-54: Weak connection detection
- **Covers:** AC-F02-28
- **Level:** unit
- **Given** the detector fed one reading a second
- **When** loss is 6% for 5 s, 4% for 10 s, delay 301 ms for 5 s, 301 ms for 4 s then normal, and a mix
- **Then** weak is raised only after 5 s in a row over 5% loss or 300 ms, and clears when readings are good again

### TC-F02-55: Weak line in the app
- **Covers:** AC-F02-28
- **Level:** e2e
- **Given** two windows and a simulated bad line (packet loss and delay added) for window B
- **When** the line is bad for 5 s, then bandwidth is cut
- **Then** B's own tile and Device panel show the connection-quality notice (A's screen doesn't); B's video quality drops or turns off while audio keeps playing

### TC-F02-56: Short drop reconnects
- **Covers:** AC-F02-29
- **Level:** e2e
- **Given** a locked meeting; presenter B inside
- **When** B's network is cut for 20 s, then restored
- **Then** B is back within 10 s of restoration, in the same meeting with the same role, not in the lobby, even though the meeting is locked

### TC-F02-57: Reconnect after LiveKit reported the leave
- **Covers:** AC-F02-29
- **Level:** integration
- **Given** an attendance marked `left` with reason `dropped` 10 s ago (leave webhook already applied) in a locked meeting
- **When** a `participant_joined` webhook arrives for it, and another for an attendance `left` by the app's own Leave, one `left` 31 s ago, a `removed` one, and one of an ended call
- **Then** the first is allowed back (status `in_call`, role kept); the other four are removed from the room at once

### TC-F02-58: Rejoin rules
- **Covers:** AC-F02-29, AC-F02-13, AC-F02-35, AC-F02-37
- **Level:** integration
- **Given** attendances ended in different ways
- **When** `POST /attendances/:id/rejoin` is called
- **Then** it works only from `left` with reason `dropped`, within 30 minutes, once per attendance, counts toward the join limit, and creates a new attendance with the old role under the normal rules; refused (404) after Leave, removal, end, time out, a second use or 31 minutes; a removed-and-dropped person goes to the lobby; a locked meeting refuses an attendee's rejoin; two computers of one account each rejoin their own

### TC-F02-59: Long drop shows Rejoin
- **Covers:** AC-F02-29
- **Level:** e2e
- **Given** presenter B inside; two windows
- **When** B's network is cut for 40 s and restored; B presses **Rejoin**
- **Then** after 30 s B sees "You've lost connection" with Rejoin; A sees B leave; Rejoin brings B back as presenter

### TC-F02-60: Noise suppression
- **Covers:** AC-F02-30
- **Level:** e2e
- **Given** a user with the mic on
- **When** they open Device settings, turn the switch off and on
- **Then** noise suppression is on by default (the audio track constraint says so), off after the switch, on again after it

### TC-F02-61: Device unplugged
- **Covers:** AC-F02-31
- **Level:** e2e
- **Given** a meeting with camera, mic and speakers chosen
- **When** each in-use device is removed in turn (fake devices list changed, `devicechange` fired)
- **Then** within 2 s the app uses the system default and shows which device changed; the devices can be changed in Device settings at any time

### TC-F02-62: Leave and crash
- **Covers:** AC-F02-32
- **Level:** e2e
- **Given** three windows
- **When** B presses Leave; C's process is killed (and a second case: C's network is blocked as when a computer sleeps)
- **Then** A sees B leave at once; A sees C leave within 30 s; the meeting goes on for A

### TC-F02-63: Organizer leaving does not end the call
- **Covers:** AC-F02-32
- **Level:** integration
- **Given** an organizer, a co-organizer and an attendee in a call
- **When** the organizer leaves
- **Then** the call stays running; the co-organizer keeps controls; the attendee stays connected

### TC-F02-64: Webhooks repeated, out of order, lost
- **Covers:** AC-F02-32, AC-F02-41
- **Level:** integration
- **Given** signed `participant_joined`, `participant_left`, `room_finished` events
- **When** an event is sent twice; a join arrives after its later leave; a leave webhook is never sent (participant gone from LiveKit); a join webhook is never sent
- **Then** a repeated event ID is handled once (`livekit_events`); the older event is ignored (`last_event_at`) so nobody comes back; the minute clean-up job compares with LiveKit's rooms and participants, fixes attendances and removes anyone not allowed; times of `joined_at`/`left_at` stay correct

### Controls

### TC-F02-65: Role table
- **Covers:** AC-F02-25, AC-F02-33, AC-F02-35, AC-F02-36, AC-F02-37, AC-F02-38
- **Level:** unit
- **Given** `calls.permissions.ts`
- **When** each action of the requirements.md table is checked for organizer, co-organizer, presenter and attendee
- **Then** the result equals the table cell by cell; nobody can remove the organizer or change their role; only the organizer can name co-organizers

### TC-F02-66: Role resolution
- **Covers:** AC-F02-36
- **Level:** unit
- **Given** the role function
- **When** it gets organizer, named co-organizer, a person with a role override, and others with `whoCanPresent` = everyone, workspace, organizers
- **Then** the order is organizer, co-organizer, override, then the group rule

### TC-F02-67: Every control route checks the role
- **Covers:** AC-F02-33, AC-F02-35, AC-F02-36, AC-F02-37, AC-F02-38
- **Level:** integration
- **Given** an organizer, co-organizer, presenter and attendee ticket
- **When** each calls mute, mute-all, remove, lower-hand, role change, lobby admit/deny, lock, end, and options
- **Then** calls succeed only where the table allows; others get 404 `NOT_ALLOWED`; remove or role change aimed at the organizer is refused

### TC-F02-68: Mute and Mute all
- **Covers:** AC-F02-33
- **Level:** integration
- **Given** four people with mics on, the caller included
- **When** a presenter mutes one person; then Mute all is pressed
- **Then** the target's microphone track is muted in LiveKit and they get `muted_by` with the muter's name; Mute all mutes everyone except the caller; people can unmute themselves again

### TC-F02-69: Mute in the app
- **Covers:** AC-F02-33
- **Level:** e2e
- **Given** three windows with mics on
- **When** the organizer mutes B, then presses Mute all
- **Then** B sees "<organizer> muted you" (announced to screen readers) and its mic is off; after Mute all everyone else is muted but the organizer; B can unmute

### TC-F02-70: Attendee mic and camera switches
- **Covers:** AC-F02-34
- **Level:** integration
- **Given** an attendee, a presenter, a co-organizer and the organizer
- **When** Allow mic and Allow camera for attendees are turned off, then the attendee is made a presenter, then the options are turned back on
- **Then** the attendee's pass loses microphone (and camera) at once through `UpdateParticipant`; a raw attempt to publish them fails; the others are unaffected; the presenter role gives them back; turning on restores them

### TC-F02-71: Options in the app
- **Covers:** AC-F02-34, AC-F02-36
- **Level:** e2e
- **Given** a co-organizer and an attendee in the meeting
- **When** the co-organizer turns off Allow mic for attendees, then makes the attendee a presenter
- **Then** the attendee cannot turn the mic on (button disabled with a reason) until made presenter

### TC-F02-72: Remove and come back
- **Covers:** AC-F02-35
- **Level:** integration
- **Given** a member M, a signed-in external user, and a guest G (device key K) in the call; lobby setting Everyone
- **When** each is removed; then each joins again with the same account/device key; then G joins with a different device key
- **Then** each removal disconnects the person; `GET /attendances/:id` returns `removed` with the remover's display name; the rejoins wait in the lobby; the new device key is treated as a new guest; a new call has no removals

### TC-F02-73: Guest device key per meeting
- **Covers:** AC-F02-35, AC-F02-50
- **Level:** unit
- **Given** the device-key fingerprint function
- **When** the same key is hashed for meeting A twice and for meeting B
- **Then** equal for the same meeting, different across meetings (so one guest's meetings can't be linked); the raw key is never stored

### TC-F02-74: Remove and roles in the app
- **Covers:** AC-F02-35, AC-F02-36
- **Level:** e2e
- **Given** organizer A, presenter B (sharing), attendee C
- **When** A makes B an attendee, makes C a presenter, then removes C; C rejoins
- **Then** B stops sharing and loses the Share button at once; C gets Share, then is told "You were removed" with A's name, and on rejoin waits in the lobby

### TC-F02-75: Roles, options and co-organizers
- **Covers:** AC-F02-36, AC-F02-06
- **Level:** integration
- **Given** an organizer, a co-organizer, a presenter in W1
- **When** the organizer names 10 co-organizers, then an 11th, a non-member, and (in a personal workspace) anyone; a co-organizer tries to change `coOrganizerIds`; whoCanPresent changes to workspace and to organizers
- **Then** 11th, non-member and personal-workspace requests get 400; the co-organizer is refused; attributes and passes of every affected person change at once (a person losing presenter rights has their screen share stopped); the DB trigger also stops an 11th co-organizer

### TC-F02-76: Lock rules
- **Covers:** AC-F02-37, AC-F02-29
- **Level:** integration
- **Given** a call with a co-organizer, an attendee, and a person waiting
- **When** a co-organizer locks; a member, a guest and the attendee (after leaving) try to join; the organizer joins on another computer; then unlock
- **Then** the waiting person gets `turned_away`/locked ("This meeting is locked"); new joiners get `MEETING_LOCKED`; the attendee cannot rejoin; the organizer and co-organizers can; an attendee's `dropped` reconnect within 30 s still works; after unlock joining works

### TC-F02-77: Lock in the app
- **Covers:** AC-F02-37
- **Level:** e2e
- **Given** organizer A, member B inside, guest C waiting
- **When** A locks, then D tries to join, then A unlocks
- **Then** C sees "This meeting is locked" and leaves; D sees the same message; after unlock D can join

### TC-F02-78: End meeting
- **Covers:** AC-F02-38
- **Level:** integration
- **Given** a link meeting with 3 people inside and 2 in the lobby
- **When** a co-organizer ends it; an attendee tries; then a member joins again
- **Then** the attendee attempt gets 404; the call is `ended` (`end_reason` ended); the room is deleted and everyone disconnected; lobby people are turned away; the later join starts a new call (until expiry)

### TC-F02-79: End meeting in the app
- **Covers:** AC-F02-38
- **Level:** e2e
- **Given** organizer A, B, C inside and D waiting
- **When** A opens Leave menu, chooses End meeting and confirms
- **Then** everyone including D sees "The meeting has ended"; a Cancel keeps the meeting

### TC-F02-80: Meeting ends when empty and at 30 hours
- **Covers:** AC-F02-39, AC-F02-41
- **Level:** integration
- **Given** a call started at T with fake clock and BullMQ jobs
- **When** the clock moves to 29 h 50 min, then 30 h; the jobs are run twice; in a second call the last person leaves and `room_finished` arrives 30 s later
- **Then** `ending_soon` is sent once at 29 h 50 min; the room is deleted and the call ended with `time_limit` at 30 h; repeated jobs change nothing; the second call ends with `ended_at` = the time the last person left (`last_left`)

### TC-F02-81: 30-hour notice in the app
- **Covers:** AC-F02-39
- **Level:** e2e
- **Given** a meeting whose limit is set to 10 minutes away by a test setting
- **When** the warning time arrives
- **Then** everyone sees the notice (announced), and at the limit the meeting ends with "The meeting has ended"

### TC-F02-82: Allow guests off
- **Covers:** AC-F02-40
- **Level:** integration
- **Given** a meeting with a guest inside and a guest in the lobby
- **When** the workspace owner (and an admin) turn Allow guests off; a member tries
- **Then** the lobby guest gets `turned_away` ("This meeting doesn't allow guests"); the inside guest stays; new guests get `GUESTS_NOT_ALLOWED`; the organizer cannot override it for one meeting; a member's `PATCH /workspaces/:id/settings` gets 404

### TC-F02-83: Allow guests switch in the app
- **Covers:** AC-F02-40
- **Level:** e2e
- **Given** the owner in Workspace settings, a guest on the pre-join
- **When** the owner turns Allow guests off and the guest presses Join now
- **Then** the guest sees "This meeting doesn't allow guests"; a plain member does not see the switch

### TC-F02-84: Meeting record
- **Covers:** AC-F02-41
- **Level:** integration
- **Given** a finished call with a member, an external user, a guest, the organizer and a co-organizer; M2 of W1 who was not in it
- **When** each calls `GET /meetings/:id/calls`
- **Then** the participants, organizer and co-organizers get title, workspace, organizer, start and end, and who took part with join and leave times (guest: only the name); M2 and outsiders get 404; no audio or video is stored (no media table, no files)

### TC-F02-85: Expired while people are inside
- **Covers:** AC-F02-04, AC-F02-07
- **Level:** integration
- **Given** a running call whose meeting expires (clock moved)
- **When** people inside stay and a new person joins
- **Then** the call continues; only the new join is refused

### Screens, accessibility and limits

### TC-F02-86: Screens match the canvas
- **Covers:** AC-F02-43
- **Level:** visual
- **Given** Storybook stories of the new pages and components (Meetings, pre-join with and without guest, lobby, gallery, speaker view, participant panel, meeting info, options, device panel, share picker, messages, workspace settings)
- **When** `pnpm test:visual` runs
- **Then** screenshots match the baselines made after the owner's look check

### TC-F02-87: Owner's look check
- **Covers:** AC-F02-43
- **Level:** manual
- **Given** the finished screens running in the app
- **When** the owner compares each with the approved canvas section "Meetings and calling (F02)" at `/spec-verify`
- **Then** the owner confirms they match; recorded in `verification.md`

### TC-F02-88: Keyboard-only run
- **Covers:** AC-F02-44
- **Level:** e2e
- **Given** the app with the mouse unused
- **When** the user creates a meeting, joins, toggles mic and camera with the shortcuts, raises a hand, opens panels, admits a person, and leaves
- **Then** everything works with Tab, Enter, Esc and the shortcuts; focus is visible and not trapped (dialogs return focus)

### TC-F02-89: Screen reader announcements
- **Covers:** AC-F02-44, AC-F02-21
- **Level:** e2e
- **Given** one polite live region on the meeting screen
- **When** people join and leave, raise a hand, a lobby arrival happens, the user is muted, and someone speaks (more than one event in 2 s)
- **Then** each is announced with the right text, at most one message every 2 s; axe finds no serious issue on any new screen or story

### TC-F02-90: Loading, error states and translations
- **Covers:** AC-F02-45
- **Level:** unit
- **Given** every new page and component
- **When** rendered while loading and when the request fails; and the source is scanned for text
- **Then** each shows a loading and an error state; every visible string comes from the translation file (no hard-coded text, no missing keys in any language)

### TC-F02-91: Backend or call server unreachable
- **Covers:** AC-F02-46
- **Level:** e2e
- **Given** the backend stopped (then LiveKit stopped) and a slow-response stub of 11 s
- **When** the user creates a meeting, looks one up, joins, and (separately) is in a call
- **Then** after 10 s each shows "Can't reach MeetApp. Check your connection." with **Retry**; Retry works after the backend is back; pressing the button twice never makes two meetings; in a call, LiveKit's reconnect runs first

### TC-F02-92: Memory of a 25-person meeting
- **Covers:** AC-F02-47
- **Level:** load
- **Given** `pnpm test:load`: 24 simulated participants with video and the desktop app as the 25th, on the reference computer
- **When** the app runs 5 minutes with paging and Speaker view
- **Then** Electron's total process memory (main, renderer, GPU) stays under 600 MB

### Security

### TC-F02-93: Wrong-try limits
- **Covers:** AC-F02-48
- **Level:** security
- **Given** a user, a guest device key and a network address
- **When** 20 wrong tries, then the 21st, are sent in one minute from one user, one device key, and one address (with different users); and a right try after wrong ones
- **Then** the 21st is refused 429 `TOO_MANY_ATTEMPTS` per person and per address; a hit gives its try back; the counter resets after a minute; the limit applies equally signed in and signed out

### TC-F02-94: Per-meeting-ID lockout
- **Covers:** AC-F02-48, AC-F02-08
- **Level:** security
- **Given** a real meeting ID and an unknown ID
- **When** 20 wrong passcodes are sent for each from many addresses within a minute; then the right passcode, and the link, are tried
- **Then** both IDs answer `TOO_MANY_ATTEMPTS` ("Too many tries for this meeting ID. Wait a minute or use the link") for the rest of the minute, identically; joining by link still works; after the minute the right passcode works again

### TC-F02-95: Join and lobby flood limits
- **Covers:** AC-F02-48, AC-F02-19
- **Level:** security
- **Given** one network address and one lookup token
- **When** 11 joins are sent in a minute, then 31 in-call actions with one ticket, and many lobby status polls
- **Then** the 11th join and the 31st action get 429; status polls are not counted; a lobby capped at 100 cannot be filled from one address

### TC-F02-96: Pass contents
- **Covers:** AC-F02-49
- **Level:** security
- **Given** passes for an organizer, presenter, attendee, and attendee with mic off
- **When** each is decoded
- **Then** identity is the attendance ID; one room only (the call's ID); valid 10 minutes; `canSubscribe` and `canPublishData` set; `canPublishSources` is camera, mic and screen for presenters and up, camera and mic for attendees minus switched-off ones; no `roomAdmin`, `roomCreate`, `roomList`, `canUpdateOwnMetadata`; the name has no "(Guest)" added in the pass

### TC-F02-97: Pass lifetime and room scope
- **Covers:** AC-F02-49
- **Level:** security
- **Given** a pass never used, and a pass for room A
- **When** the first is used after 10 minutes (clock or a short test lifetime), and the second is used to connect to room B or to create a room
- **Then** LiveKit refuses both; `auto_create` is false so a client can't create rooms

### TC-F02-98: Removal disconnects in 5 seconds, reuse refused
- **Covers:** AC-F02-49
- **Level:** security
- **Given** a connected attendee
- **When** they are removed, and they reconnect using the same (still valid) pass; and the same after End meeting and after the call ended by time
- **Then** LiveKit disconnects them within 5 s of removal or ending; the reused pass is removed through the webhook check; the time between reconnecting and removal is measured and is about 1 s or less

### TC-F02-99: Lost webhook, pass reuse still caught
- **Covers:** AC-F02-49
- **Level:** security
- **Given** a removed person who reconnected with the old pass while the `participant_joined` webhook is dropped
- **When** the minute clean-up job lists the room's participants
- **Then** the person is removed by the job

### TC-F02-100: Ticket misuse
- **Covers:** AC-F02-49, AC-F02-50
- **Level:** security
- **Given** tickets of attendances in meeting A and meeting B
- **When** A's ticket is used on B's routes (`/calls/:id/...`, `/attendances/:id`), a tampered ticket, no ticket, the ticket in `Authorization`, a lobby ticket on in-call routes, an in-call ticket on lobby routes, and another person's attendance ID with own ticket
- **Then** every attempt gets 404 with the same body; tickets are found by SHA-256 fingerprint only and the raw ticket is never stored

### TC-F02-101: Ticket status rules
- **Covers:** AC-F02-49, AC-F02-50
- **Level:** security
- **Given** attendances in each status: waiting, admitted, in_call, left, denied, removed, timed_out, turned_away, and a call that ended
- **When** each ticket calls an in-call route, a lobby route, `GET /attendances/:id` right away and after 31 minutes, and Rejoin
- **Then** in-call routes work only for admitted/in_call with a matching `call_id`; lobby routes only for waiting; after a final status only `GET /attendances/:id` works for 30 minutes and Rejoin only after a dropped connection

### TC-F02-102: Outsider sweep on every new route
- **Covers:** AC-F02-50, AC-F02-01
- **Level:** security
- **Given** a meeting in W1 and these callers: signed out, signed-in user of W2, W1 member who is not in the meeting, a guest of another meeting
- **When** every route of the design's endpoint table is called with real IDs (create, GET meeting, options, calls, lobby, admit, deny, hand, lower-hand, mute, mute-all, remove, role, lock, end, attendances, rejoin, workspace settings)
- **Then** each gets 401 or the same 404 as a nonexistent meeting; nothing is changed; the create route also refuses guests and non-members of the workspace

### TC-F02-103: Participants only see what they should
- **Covers:** AC-F02-50, AC-F02-14
- **Level:** security
- **Given** a participant who is not organizer or co-organizer, and a lobby person
- **When** they call `GET /meetings/:id`, options, calls, the lobby list, and the lookup/join/attendance answers
- **Then** they never get link, ID, passcode (unless their ticket is in the call for Meeting info), options of others, or the participant list; the joining person sees only the title and their own status; the lobby person gets nothing about who is inside

### TC-F02-104: Co-organizer limits
- **Covers:** AC-F02-50, AC-F02-36
- **Level:** security
- **Given** a co-organizer, a presenter and an organizer
- **When** the co-organizer sends `coOrganizerIds`, tries to remove or demote the organizer, and the presenter tries options and lock
- **Then** all are refused; the organizer is unchanged

### TC-F02-105: Lookup token scope
- **Covers:** AC-F02-50, AC-F02-08
- **Level:** security
- **Given** a lookup token for meeting A
- **When** it is used on A, after 16 minutes, with a changed payload, for the join of meeting B, and by a different group
- **Then** only the first use works; others are refused with the same answer as a miss

### TC-F02-106: Webhook signature
- **Covers:** AC-F02-49, AC-F02-50
- **Level:** security
- **Given** the webhook route
- **When** an unsigned event, an event signed with a wrong key, a modified body, and a valid one are posted
- **Then** only the valid one changes anything; the others answer 401 and nothing is stored in `livekit_events`

### TC-F02-107: HTML in names and titles
- **Covers:** AC-F02-51
- **Level:** security
- **Given** titles and guest names such as `<img src=x onerror=alert(1)>` and `<script>` and a display name with HTML
- **When** they appear in the pre-join, lobby, bar, participant list, tiles, Meeting info, messages ("X muted you", "removed by X"), live announcements and the record
- **Then** they are text everywhere (no element created, no script run); the server stores them as text; the existing html-names test is extended with the new places

### TC-F02-108: Secrets never in logs
- **Covers:** AC-F02-52
- **Level:** security
- **Given** a full run (create, lookup, join, lobby, controls, webhook, errors forced)
- **When** the API logs, error reports and traces are searched
- **Then** none contains any LiveKit token, meeting ticket, passcode, link part (`/m/<part>` becomes redacted), `X-Meeting-Ticket` value, lookup token, or webhook body; request bodies of meeting routes are dropped from traces; no audio or video exists in logs

### TC-F02-109: Log redaction helper
- **Covers:** AC-F02-52
- **Level:** unit
- **Given** `redactPath` / `redactUrl` and the header and body cleaners
- **When** they receive `/m/<22 chars>`, an `X-Meeting-Ticket` header, `{ passcode }` bodies and JWT-looking strings
- **Then** each secret is replaced; other text is unchanged

### TC-F02-110: Media encrypted
- **Covers:** AC-F02-53
- **Level:** integration
- **Given** a local call with two participants
- **When** the WebRTC stats (DTLS state, SRTP cipher) are read, and the production config is loaded
- **Then** the connection uses DTLS-SRTP; the production configuration (and the app's CSP) demands `wss://` and refuses `ws://`; development allows `ws://127.0.0.1` only

### TC-F02-111: Desktop permission rules
- **Covers:** AC-F02-54
- **Level:** e2e
- **Given** the desktop app
- **When** the app's own page asks for camera and mic, for screen, for notifications, geolocation, USB/HID/serial, clipboard-read; and a foreign page or frame (another origin) asks for camera
- **Then** camera/mic (media) are allowed for `app://meetapp` only (and the dev server in development); speaker selection works from the app page; everything else and every foreign origin is refused

### TC-F02-112: Screen sharing only through our picker
- **Covers:** AC-F02-54, AC-F02-25
- **Level:** e2e
- **Given** the meeting page
- **When** the page asks for the screen without picking; then picks a source in Choose what to share; then asks again after 10 s
- **Then** the first request is refused; the second gets exactly the picked source without computer sound; the third is refused (one use); with macOS screen recording not allowed (status mocked) the picker shows the "Allow screen recording" card

### TC-F02-113: Desktop safety settings unchanged
- **Covers:** AC-F02-54
- **Level:** e2e
- **Given** the meeting window
- **When** its web preferences and page are inspected
- **Then** context isolation and sandbox are on, Node.js is not available in the page, the new bridge functions (`media.*`, `deviceKey`) are accepted only from the app's own page, and the F00 desktop security tests pass in their updated form

### TC-F02-114: Meeting ticket and device key stay in the page
- **Covers:** AC-F02-54, AC-F02-35
- **Level:** e2e
- **Given** a guest joined with a ticket
- **When** local storage, session storage, cookies and disk files of the app are searched, and the window is closed and reopened
- **Then** the ticket is nowhere on disk and is gone after closing; the device key exists as a random 32-byte value in app settings and only its fingerprint goes to the backend

## Coverage
| Acceptance criterion | Test cases |
|---|---|
| AC-F02-01 | TC-F02-02, TC-F02-13, TC-F02-102 |
| AC-F02-02 | TC-F02-03, TC-F02-14 |
| AC-F02-03 | TC-F02-01, TC-F02-02, TC-F02-03, TC-F02-04, TC-F02-05 |
| AC-F02-04 | TC-F02-06, TC-F02-07, TC-F02-08, TC-F02-85 |
| AC-F02-05 | TC-F02-09 |
| AC-F02-06 | TC-F02-10, TC-F02-75 |
| AC-F02-07 | TC-F02-11, TC-F02-85 |
| AC-F02-08 | TC-F02-04, TC-F02-08, TC-F02-15, TC-F02-16, TC-F02-18, TC-F02-94, TC-F02-105 |
| AC-F02-09 | TC-F02-19 |
| AC-F02-10 | TC-F02-20 |
| AC-F02-11 | TC-F02-21, TC-F02-22 |
| AC-F02-12 | TC-F02-25, TC-F02-37 |
| AC-F02-13 | TC-F02-23, TC-F02-24, TC-F02-37, TC-F02-58 |
| AC-F02-14 | TC-F02-15, TC-F02-26, TC-F02-27, TC-F02-32, TC-F02-40, TC-F02-103 |
| AC-F02-15 | TC-F02-30, TC-F02-31, TC-F02-32, TC-F02-36, TC-F02-39, TC-F02-40 |
| AC-F02-16 | TC-F02-27, TC-F02-28 |
| AC-F02-17 | TC-F02-27, TC-F02-29, TC-F02-34 |
| AC-F02-18 | TC-F02-33, TC-F02-34 |
| AC-F02-19 | TC-F02-35, TC-F02-95 |
| AC-F02-20 | TC-F02-41, TC-F02-42, TC-F02-43 |
| AC-F02-21 | TC-F02-44, TC-F02-89 |
| AC-F02-22 | TC-F02-45 |
| AC-F02-23 | TC-F02-46, TC-F02-47 |
| AC-F02-24 | TC-F02-47, TC-F02-48 |
| AC-F02-25 | TC-F02-49, TC-F02-50, TC-F02-51, TC-F02-65, TC-F02-112 |
| AC-F02-26 | TC-F02-30, TC-F02-52 |
| AC-F02-27 | TC-F02-53 |
| AC-F02-28 | TC-F02-54, TC-F02-55 |
| AC-F02-29 | TC-F02-56, TC-F02-57, TC-F02-58, TC-F02-59, TC-F02-76 |
| AC-F02-30 | TC-F02-60 |
| AC-F02-31 | TC-F02-61 |
| AC-F02-32 | TC-F02-62, TC-F02-63, TC-F02-64 |
| AC-F02-33 | TC-F02-65, TC-F02-67, TC-F02-68, TC-F02-69 |
| AC-F02-34 | TC-F02-70, TC-F02-71 |
| AC-F02-35 | TC-F02-27, TC-F02-58, TC-F02-65, TC-F02-67, TC-F02-72, TC-F02-73, TC-F02-74, TC-F02-114 |
| AC-F02-36 | TC-F02-65, TC-F02-66, TC-F02-67, TC-F02-71, TC-F02-74, TC-F02-75, TC-F02-104 |
| AC-F02-37 | TC-F02-58, TC-F02-65, TC-F02-67, TC-F02-76, TC-F02-77 |
| AC-F02-38 | TC-F02-65, TC-F02-67, TC-F02-78, TC-F02-79 |
| AC-F02-39 | TC-F02-80, TC-F02-81 |
| AC-F02-40 | TC-F02-82, TC-F02-83 |
| AC-F02-41 | TC-F02-64, TC-F02-80, TC-F02-84 |
| AC-F02-42 | TC-F02-38, TC-F02-39 |
| AC-F02-43 | TC-F02-86, TC-F02-87 |
| AC-F02-44 | TC-F02-88, TC-F02-89 |
| AC-F02-45 | TC-F02-90 |
| AC-F02-46 | TC-F02-12, TC-F02-91 |
| AC-F02-47 | TC-F02-42, TC-F02-92 |
| AC-F02-48 | TC-F02-08, TC-F02-16, TC-F02-17, TC-F02-93, TC-F02-94, TC-F02-95 |
| AC-F02-49 | TC-F02-51, TC-F02-96, TC-F02-97, TC-F02-98, TC-F02-99, TC-F02-100, TC-F02-101, TC-F02-106 |
| AC-F02-50 | TC-F02-15, TC-F02-73, TC-F02-100, TC-F02-101, TC-F02-102, TC-F02-103, TC-F02-104, TC-F02-105, TC-F02-106 |
| AC-F02-51 | TC-F02-22, TC-F02-107 |
| AC-F02-52 | TC-F02-05, TC-F02-108, TC-F02-109 |
| AC-F02-53 | TC-F02-110 |
| AC-F02-54 | TC-F02-111, TC-F02-112, TC-F02-113, TC-F02-114 |
