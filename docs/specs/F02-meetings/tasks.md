---
feature: F02
title: Meetings & calling
status: in-progress
updated: 2026-10-14
---

# F02 Meetings & calling: Tasks (STEPS)

Small steps, done in order, on branch `feat/F02-meetings`. Each step is committed and pushed when its tests pass (D026). Tick `[x]` when done and verified.
- **Tests per step (D052):** each step runs only its own test cases plus typecheck and lint. The whole suite, the desktop tests and the screenshots run once, at `/spec-verify`.
- **LiveKit details:** before a step uses one, it is checked against LiveKit's current docs (Context7). A difference updates design.md first, and the owner is told.

## Backend

- [x] **T1: Libraries, settings and the call server's setup.**
  - Vet the D055 libraries with `/add-dependency`: `livekit-client`, `@livekit/components-react`, and the pinned `livekit/livekit-cli` image. Each is installed in the task that first uses it.
  - `infra/livekit.yaml` and `docker-compose.yml`:
    - `room.auto_create: false`, the 100 cap and the 30 s empty-room time;
    - the webhook section built from `.env` (check whether `--config-body` adds to the file or replaces it);
    - `extra_hosts` and the CI-only `API_HOST`.
  - New settings in `config.ts`/`.env.example`, if needed: the webhook address, and the call-server address given to the app.
  - The new folders go into `docs/engineering/project-structure.md`.
  - Covers: AC-F02-53 (settings part).
  - Tests: TC-F02-110 (settings part; the DTLS-SRTP part needs a real call and runs in T14).
  - Check: a client can't create a room by itself, and a test webhook from LiveKit reaches the API on the Mac.
  - **Built in T1:**
    - `LIVEKIT_PUBLIC_URL` (wss online, ws only on this computer) and `callServerUrl()`;
    - the example `LIVEKIT_API_SECRET` refused in production;
    - the webhook address filled in at container start;
    - on the Mac: a pass for a room the backend didn't make is refused (404), and room_started/room_finished webhooks arrived on API_PORT.

- [x] **T2: Database tables (migration `0003_meetings`).**
  - `meetings`, `meeting_co_organizers`, `calls`, `call_attendances`, `livekit_events`, and `workspaces.allow_guests`, with the indexes, the one-running-call-per-meeting rule and the 10 co-organizer limit.
  - Done with `/db-migration`.
  - Covers: AC-F02-03, 41 (storage part).
  - Tests: TC-F02-05 (database part).
  - Check: the migration runs on an empty database and on the F01 database; a second running call for one meeting is refused by the database.
  - **Built in T2:**
    - `packages/db/src/schema/meetings.ts`, migration `0003_meetings`, and the co-organizer limit trigger;
    - tests: the migration on an F01 database with data (guests allowed by default), one running call, 10 co-organizers even at the same moment, one attendance per ticket.
    - The Postgres MCP inspection was skipped: that server doesn't connect in this session. The integration test reads the tables instead.

- [x] **T3: Making meetings.**
  - `modules/meetings`: create (Meet now / link), secrets (link, ID, passcode; encrypted and HMAC), expiry, options, co-organizers.
  - Plus the personal workspace rule, the organizer-gone rule, 50 an hour, the Idempotency-Key, and `PATCH /workspaces/:id/settings` (allowGuests).
  - The Zod contracts in `packages/contracts/src/meetings.ts`.
  - Covers: AC-F02-01, 02, 03, 04, 05, 06, 07, 46 (double click).
  - Tests: TC-F02-01, 02, 03, 05, 06, 07, 09, 10, 11, 12, 104.
  - Check: the tests pass against the real database with a moved clock.
  - **Built in T3:**
    - the `modules/meetings` service, repository and routes (`POST /workspaces/:id/meetings`, `GET /meetings/:id`, `PATCH /meetings/:id/options`);
    - meeting-secrets.ts, expiry.ts and lookup-token.ts;
    - `PATCH /workspaces/:id/settings` (action `manageGuests`: owner and admins; in a personal workspace its user);
    - the 50-an-hour limit; the F02 error codes. The limit answer uses F01's existing code `TOO_MANY_ATTEMPTS` (the design said `RATE_LIMITED`; design.md and tests.md updated).
    - **Parts of these test cases that need joining are tested with T6/T7:** TC-F02-07 (joins extend expiry), TC-F02-10 (lobby for external people and guests) and TC-F02-11 (organizer gone → lookups and joins).

- [x] **T4: Finding a meeting.**
  - `POST /meeting-lookups`: link or ID+passcode, lookup tokens, the same miss answer and timing, the expired message only with the right secret.
  - Wrong-try limits per person, per address and per meeting ID (RATE_LIMITED).
  - Covers: AC-F02-04, 08, 48.
  - Tests: TC-F02-04, 08, 15, 16, 17, 93, 94, 105.
  - Check: a wrong passcode and an unknown ID can't be told apart by answer or by timing.
  - **Built in T4:**
    - `lookup.service.ts` and `POST /meeting-lookups`;
    - a new sign-in level `access: "optional"` (guests and signed-in people use the same route; the route sweep lists such routes);
    - the minimum answer time of 300 ms; `410 MEETING_EXPIRED` only after the right secret;
    - lookup tokens name the meeting **and** the person (or "guest"), so a token can't be passed on.
    - The parts of TC-F02-105 that use a token for joining are tested in T6.

- [x] **T5: The call server's passes and rooms.**
  - `providers/livekit.ts`:
    - creating rooms under the call lock;
    - passes with the role's rights, 10 minutes, one room;
    - permission updates, removing, muting, data messages, room metadata and attributes;
    - checking webhook signatures.
  - `calls.permissions.ts` (the role table).
  - Covers: AC-F02-36 (rights part), 49.
  - Tests: TC-F02-65, 96, 97, 106.
  - Check: a decoded pass has exactly the rights of its role; a forged webhook is refused.
  - **Built in T5:**
    - `providers/livekit.ts`: rooms, passes, rights, attributes, metadata, remove (with `revokeTokenTs`), mute, server messages, webhook reading;
    - `calls.permissions.ts`: the role table, role resolution, what each role may send, who skips the lobby.
    - LiveKit's one-minute clock allowance is noted in design.md 3.5.
    - The route part of TC-F02-106 ("nothing stored") comes with the webhook route in T7.

- [ ] **T6: Joining and the lobby.**
  - `POST /meetings/join`, the meeting ticket (`X-Meeting-Ticket` plugin and its status rules), `GET`/`DELETE /attendances/:id`.
  - Lobby rules, admit / deny / Admit all, the call lock and the capacity counts, the 15-minute wait, the join limits, and the guest device-key HMAC.
  - Covers: AC-F02-11 (server checks), 13, 14, 15, 16, 17, 18, 19, 35 (lobby part), 37 (joining part), 40 (joining part), 42.
  - Tests: TC-F02-22, 23, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 73, 95, 100, 101.
  - Check: the races (two Admits, two first joins, 99/100/101, Admit all overfill) give the right result every time.

- [ ] **T7: Webhooks, reconnects, ending and the record.**
  - `livekit-webhook.routes.ts` (joins, leaves, room finished, screen published; repeated and out-of-order events).
  - Reuse refused; reconnect after a reported leave; Rejoin only after a dropped connection.
  - The room closed after admission; the cleanup job (rooms and participants each minute); the 30-hour jobs; the record (`GET /meetings/:id/calls`).
  - Covers: AC-F02-04 (extended by joins), 29, 38, 39, 41, 49 (reuse).
  - Tests: TC-F02-40, 57, 58, 64, 80, 84, 85, 99.
  - Check: a lost or late webhook never lets a removed person stay, and never throws out a reconnecting one.

- [ ] **T8: In-call controls.**
  - Hands, mute, Mute all, remove, roles, options (who can present, attendee mic/camera), lock, End meeting, share replacement, the 30-a-minute limit.
  - Guests switched off while waiting or inside; what outsiders may see (no emails; photos only with a shared workspace).
  - Covers: AC-F02-23, 24 (rules), 25 (server part), 27, 33, 34, 35, 36, 37, 38, 40, 50.
  - Tests: TC-F02-46, 48, 50, 51, 53, 66, 67, 68, 70, 72, 75, 76, 78, 82, 98, 103.
  - Check: every control route refuses people without the right, and a removed person is disconnected within 5 seconds.

- [ ] **T9: Backend security sweeps.**
  - Every new route goes into the outsider and member sweeps.
  - HTML in names and titles.
  - Log cleaning: the ticket header, `/m/` link parts, passcodes and passes.
  - Covers: AC-F02-50, 51, 52.
  - Tests: TC-F02-102, 107, 108, 109.
  - Check: no new route answers an outsider; no secret appears in logs or traces.

## Desktop app and screens

- [ ] **T10: Desktop: camera, microphone and screen sharing.**
  - `media-permissions.ts` installed by `lockDownSession` in place of the refusing handlers (D040 updated).
  - macOS access checks; the page bridge (`meetapp.media.*`, `meetapp.deviceKey()`); `device-key.ts`; the picker hand-off to `setDisplayMediaRequestHandler`.
  - The CSP `connect-src` built from the call-server setting. The F00 desktop security tests are updated.
  - Covers: AC-F02-10 (permission part), 35 (device key), 54.
  - Tests: TC-F02-111, 112, 113, 114.
  - Check: only MeetApp's own page gets the camera and mic; screen sharing works only through our picker.

- [ ] **T11: Building blocks in the gallery.**
  - In packages/ui, with stories, tests and screenshots, styled from the approved canvas:
    - atom: LevelMeter;
    - molecules: DeviceSelect, ParticipantRow (reworked), LobbyRow, MessageCard;
    - organisms: VideoTile (reworked), ControlBar (reworked), Gallery, ParticipantPanel, MeetingInfoPanel, MeetingOptionsForm, DevicePanel, SharePicker;
    - template: MeetingLayout.
  - Covers: AC-F02-21 (tile part), 43, 44 (components).
  - Tests: TC-F02-86.
  - Check: every component works with the keyboard and passes axe in light and dark.

- [ ] **T12: Meetings page, link dialog and Join.**
  - MeetingsPage (Meet now, Get a meeting link with the link-ready dialog, Join by ID or link) and the main-menu item.
  - **Join a meeting** on the sign-in screen for guests.
  - Covers: AC-F02-01, 02, 08.
  - Tests: TC-F02-13, 14, 18.
  - Check: Meet now reaches the pre-join; the link dialog copies the link, ID and passcode.

- [ ] **T13: Pre-join and lobby screens.**
  - PreJoinPage (preview, level meter, Test speakers, devices remembered, device-problem messages, guest name and Terms text) and LobbyPage (2-second status asks, every ending message).
  - Covers: AC-F02-09, 10, 11, 14, 15, 18.
  - Tests: TC-F02-19, 20, 21, 32.
  - Check: a guest waits in the lobby and enters when another window admits them.

- [ ] **T14: The meeting: a first real call (milestone).**
  - `useMeetingRoom` (livekit-client: adaptive stream, dynacast, simulcast, reconnect policy).
  - Gallery of 16 with pages, speaker view, pin, speaking highlight, mic and camera with shortcuts, hands, reactions, announcements.
  - Covers: AC-F02-12 (path), 13, 20 (layout), 21, 22, 23, 24, 44.
  - Tests: TC-F02-24, 42, 43, 44, 45, 47, 89, 110 (DTLS-SRTP part).
  - Check: two app windows see and hear each other; the owner can try a call on the Mac.

- [ ] **T15: Panels and organizer controls in the app.**
  - Participants panel with the lobby, Meeting info, Meeting options, mute, remove, roles, lock, End meeting with confirmation, "Choose what to share" and sharing, the 30-hour notice.
  - Covers: AC-F02-15, 25, 26, 33, 34, 35, 36, 37, 38, 39.
  - Tests: TC-F02-49, 52, 69, 71, 74, 77, 79, 81.
  - Check: each control works from one window and is seen in the other.

- [ ] **T16: Connection and devices in the app.**
  - Weak-connection detection and notice; reconnect, and "You've lost connection" with Rejoin.
  - Device settings panel, noise suppression, unplugged devices, Leave and closed apps, the 10-second "Can't reach MeetApp" with Retry.
  - Covers: AC-F02-28, 29, 30, 31, 32, 46.
  - Tests: TC-F02-54, 55, 56, 59, 60, 61, 62, 63, 91.
  - Check: cutting the network for 10 seconds brings the person back by themselves in the same role.

- [ ] **T17: Workspace settings: Allow guests.**
  - WorkspaceSettingsPage (name moved from F01, Allow guests) and the menu item rename.
  - Covers: AC-F02-40.
  - Tests: TC-F02-83.
  - Check: turning guests off refuses a guest window at once.

## Measuring and finishing

- [ ] **T18: Load tests (`pnpm test:load`).**
  - `lk perf load-test` in Docker (`network_mode: service:livekit`): 99 simulated people with video, plus the app as the 100th.
  - Measures: frames per second of the 16 tiles, audio delay, join time, and memory in a 25-person meeting. Results recorded in verification.md.
  - Covers: AC-F02-12, 20, 47.
  - Tests: TC-F02-25, 41, 92.
  - Check: the targets of quality-targets.md are met on the reference MacBook, or the gap is shown to the owner.

- [ ] **T19: Keyboard, screen reader, states and documentation.**
  - A keyboard-only run through every F02 screen; loading and error states; translation keys.
  - Docs:
    - privacy-legal.md (what F02 stores);
    - runbooks (the call server and the load test);
    - the glossary;
    - the canvas link for the owner's look check.
  - Covers: AC-F02-43, 44, 45.
  - Tests: TC-F02-87 (prepared; the owner does it at verify), 88, 90.
  - Check: everything works without a mouse; every text comes from the translation file.

## Check: every test case belongs to a step
TC-F02-01–03, 05–07, 09–12, 104 → T3 · 04, 08, 15–17, 93, 94, 105 → T4 · 65, 96, 97, 106 → T5 · 22, 23, 26–31, 33–39, 73, 95, 100, 101 → T6 · 40, 57, 58, 64, 80, 84, 85, 99 → T7 · 46, 48, 50, 51, 53, 66–68, 70, 72, 75, 76, 78, 82, 98, 103 → T8 · 102, 107–109 → T9 · 110 → T1 · 05 (database part) → T2 · 111–114 → T10 · 86 → T11 · 13, 14, 18 → T12 · 19–21, 32 → T13 · 24, 42–45, 47, 89 → T14 · 49, 52, 69, 71, 74, 77, 79, 81 → T15 · 54–56, 59–63, 91 → T16 · 83 → T17 · 25, 41, 92 → T18 · 87, 88, 90 → T19.
