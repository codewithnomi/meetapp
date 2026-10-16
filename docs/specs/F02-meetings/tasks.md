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
  - Wrong-try limits per person, per address and per meeting ID (TOO_MANY_ATTEMPTS).
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

- [x] **T6: Joining and the lobby.**
  - `POST /meetings/join`, the meeting ticket (`X-Meeting-Ticket` plugin and its status rules), `GET`/`DELETE /attendances/:id`.
  - Lobby rules, admit / deny / Admit all, the call lock and the capacity counts, the 15-minute wait, the join limits, and the guest device-key HMAC.
  - Covers: AC-F02-11 (server checks), 13, 14, 15, 16, 17, 18, 19, 35 (lobby part), 37 (joining part), 40 (joining part), 42.
  - Tests: TC-F02-22, 23, 26, 27, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 73, 95, 100, 101.
  - Check: the races (two Admits, two first joins, 99/100/101, Admit all overfill) give the right result every time.
  - **Built in T6:**
    - `modules/calls`: join.service, lobby.service, admission.ts, and the calls and attendances repositories;
    - `plugins/meeting-ticket.ts` and the routes;
    - joins and admissions hold the meeting's row while they decide;
    - guests waiting only because nobody with an account was in are let in when one arrives (if the lobby rule is "Everyone").
    - **Left for T7:** the clean-up job of TC-F02-33, the "room finished" part of TC-F02-34 and Rejoin in TC-F02-101.

- [x] **T7: Webhooks, reconnects, ending and the record.**
  - `livekit-webhook.routes.ts` (joins, leaves, room finished, screen published; repeated and out-of-order events).
  - Reuse refused; reconnect after a reported leave; Rejoin only after a dropped connection.
  - The room closed after admission; the cleanup job (rooms and participants each minute); the 30-hour jobs; the record (`GET /meetings/:id/calls`).
  - Covers: AC-F02-04 (extended by joins), 29, 38, 39, 41, 49 (reuse).
  - Tests: TC-F02-40, 57, 58, 64, 80, 84, 85, 99.
  - Check: a lost or late webhook never lets a removed person stay, and never throws out a reconnecting one.
  - **Built in T7:**
    - webhook.service, livekit-webhook.routes, call-events.repository;
    - rejoin.service (`POST /attendances/:id/rejoin`, and re-entering after a room closed);
    - calls.jobs (the minute clean-up, and the 29 h 50 min and 30 h jobs on BullMQ, started by server.ts);
    - the record (`GET /meetings/:id/calls`) and `leftReason` in the status answer;
    - also the screen-share rule ("the newest share wins"), tested in T8.
    - Integration tests record the call server's side (removals, messages) where a real participant would be needed. The desktop tests (T14–T16) use real participants.

- [x] **T8: In-call controls.**
  - Hands, mute, Mute all, remove, roles, options (who can present, attendee mic/camera), lock, End meeting, share replacement, the 30-a-minute limit.
  - Guests switched off while waiting or inside; what outsiders may see (no emails; photos only with a shared workspace).
  - Covers: AC-F02-23, 24 (rules), 25 (server part), 27, 33, 34, 35, 36, 37, 38, 40, 50.
  - Tests: TC-F02-46, 50, 53, 66, 67, 68, 70, 72, 75, 76, 78, 82, 103 (and the backend parts of 51 and 98).
  - Check: every control route refuses people without the right, and a removed person is disconnected within 5 seconds.
  - **Built in T8:**
    - controls.service and controls.routes: hands, mute, Mute all, remove, roles, lock, End meeting, Meeting info at `GET /calls/:id/meeting`;
    - option changes reach the running call through `refreshCall`;
    - migration `0004_lobby_reasons` gives a lobby turn-away its reason (`locked`, `guests_off`), shown on the waiting person's next ask;
    - the meeting wiring moved to `apps/api/src/meetings.ts`.
    - **Moved to T14 (they need the app):** the reaction rules (TC-F02-48), and the real-client parts of TC-F02-51 and TC-F02-98.
    - TC-F02-53's photo part is F01's photo rule (shared workspace), already tested there.

- [x] **T9: Backend security sweeps.**
  - Every new route goes into the outsider and member sweeps.
  - HTML in names and titles.
  - Log cleaning: the ticket header, `/m/` link parts, passcodes and passes.
  - Covers: AC-F02-50, 51, 52.
  - Tests: TC-F02-102, 107, 108, 109.
  - Check: no new route answers an outsider; no secret appears in logs or traces.
  - **Built in T9:**
    - `meeting-sweep.integration.test.ts`: every meeting route, read from the server, against four strangers (signed out, another workspace, a member not in the meeting, a guest of another meeting); the member sweep gains the Allow guests switch;
    - log cleaning (`plugins/logging.ts`) hides `/m/<part>` (also with the site in front and inside error text), the `X-Meeting-Ticket` header, signed passes (JWTs) in error text, and the fields `passcode`, `ticket`, `pass`, `lookupToken`, `link`, `deviceKey`, `guestName`; traces hide `/m/` too and record no headers or bodies;
    - `meeting-logs.integration.test.ts` runs a whole meeting, with forced errors and webhooks, and finds no secret in the logs;
    - `html-text.integration.test.ts`: HTML-looking titles and names come back as typed, as JSON text (lookup, lobby, status, Meeting info, "muted by", record).
    - **Moved to the screen tasks (T12–T15):** TC-F02-107's screen part; each screen adds its places to `apps/web/src/app/html-names.test.tsx` as it is built.

## Desktop app and screens

- [x] **T10: Desktop: camera, microphone and screen sharing.**
  - `media-permissions.ts` installed by `lockDownSession` in place of the refusing handlers (D040 updated).
  - macOS access checks; the page bridge (`meetapp.media.*`, `meetapp.deviceKey()`); `device-key.ts`; the picker hand-off to `setDisplayMediaRequestHandler`.
  - The CSP `connect-src` built from the call-server setting. The F00 desktop security tests are updated.
  - Covers: AC-F02-10 (permission part), 35 (device key), 54.
  - Tests: TC-F02-111, 112, 113, 114.
  - Check: only MeetApp's own page gets the camera and mic; screen sharing works only through our picker.
  - **Built in T10:**
    - `media-permissions.ts` (the rules), `media-actions.ts` and `media-bridge.ts` (the page bridge), `device-key.ts`; `lockDownSession` takes the app's address and the share picker;
    - the CSP's `connect-src` adds the call server (`LIVEKIT_PUBLIC_URL` if wss://, else `ws://127.0.0.1:<LIVEKIT_PORT>`), read by the desktop settings and passed by `pnpm dev`;
    - unit tests for the rules, the picker list and the device key; `tests/e2e/desktop/media.spec.ts` in a real window, including a real screen capture where the system allows it (Linux CI, Windows, or a Mac that already allowed screen recording);
    - the F00 desktop security tests now expect camera and microphone to be allowed for the app's page (checked through permission states, so no test turns on a real camera);
    - fixed in the shared desktop test helper: closing an app twice crashed the clean-up (it already failed before T10).
    - **Moved to the screen tasks:** the "Allow screen recording" card (TC-F02-112, with the picker in T15) and the meeting ticket never on disk (TC-F02-114, with the pre-join and lobby in T13).

- [x] **T11: Building blocks in the gallery.**
  - In packages/ui, with stories, tests and screenshots, styled from the approved canvas:
    - atom: LevelMeter;
    - molecules: DeviceSelect, ParticipantRow (reworked), LobbyRow, MessageCard;
    - organisms: VideoTile (reworked), ControlBar (reworked), Gallery, ParticipantPanel, MeetingInfoPanel, MeetingOptionsForm, DevicePanel, SharePicker;
    - template: MeetingLayout.
  - Covers: AC-F02-21 (tile part), 43, 44 (components).
  - Tests: TC-F02-86.
  - Check: every component works with the keyboard and passes axe in light and dark.
  - **Built in T11:**
    - all listed components, plus the ActionMenu atom (the ⋯ menu, now shared with MemberRow) and the SidePanel molecule (the panels' frame); five icons from the approved screens; Dialog widths;
    - stories for every state, unit and keyboard tests, the F02 block in `stories.test.tsx`; the gallery run (screenshots + axe, light and dark) passes with zero accessibility problems;
    - the control bar is a labelled group (each control its own Tab stop), not a toolbar, so it promises no arrow-key moves;
    - also fixed: six backend services imported database types directly (layering rule); they now take them from their repositories.
    - The screenshot baselines are made now; they are remade if the owner's look check changes anything (TC-F02-87).

- [x] **T12: Meetings page, link dialog and Join.**
  - MeetingsPage (Meet now, Get a meeting link with the link-ready dialog, Join by ID or link) and the main-menu item.
  - **Join a meeting** on the sign-in screen for guests.
  - Covers: AC-F02-01, 02, 08.
  - Tests: TC-F02-13, 14, 18.
  - Check: Meet now reaches the pre-join; the link dialog copies the link, ID and passcode.
  - **Built in T12:**
    - `features/meetings` (make, find, read and save options; Join a meeting form; Meeting options dialog), `pages/MeetingsPage` with the link-ready dialog, `pages/JoinMeetingPage` (guests, from the sign-in screen), the Meetings menu item;
    - the pre-join route shows the meeting's title for now; T13 fills it in;
    - the Meeting options dialog outside a call has no Lock switch (locking belongs to a running call; the meeting screen adds it, T15).
    - **Tests at the end (D052, extended):** TC-F02-13, 14 and 18 run as desktop tests at `/spec-verify`; only the address clean-up has a unit test now.

- [x] **T13: Pre-join and lobby screens.**
  - PreJoinPage (preview, level meter, Test speakers, devices remembered, device-problem messages, guest name and Terms text) and LobbyPage (2-second status asks, every ending message).
  - Covers: AC-F02-09, 10, 11, 14, 15, 18.
  - Tests: TC-F02-19, 20, 21, 32.
  - Check: a guest waits in the lobby and enters when another window admits them.
  - **Built in T13:**
    - PreJoinPage: own camera preview, microphone level, Test speakers (a short tone through the chosen speakers), the three device lists (remembered in local storage), camera and microphone switches, device problems named with the fix (missing, busy, not allowed; on macOS the app asks the computer first), guest name 1–60 and the Terms sentence as plain text;
    - joining keeps the visit (with the meeting ticket) in memory only (`features/meetings/visit.ts`);
    - LobbyPage asks for its status every 2 seconds and moves on when let in or turned away; MeetingEndedPage shows the ending (denied, nobody let you in, removed by whom, ended, locked, guests not allowed);
    - `/meeting/call` shows "You're in the meeting" with Leave until T14 builds the call;
    - **at the end (D052, extended):** the desktop tests TC-F02-19, 20, 21 and 32, and the meeting-ticket-never-on-disk part of TC-F02-114. Admitting from another window needs the participants panel inside the call (T14–T15), so the task's check runs then.

- [x] **T14: The meeting: a first real call (milestone).**
  - `useMeetingRoom` (livekit-client: adaptive stream, dynacast, simulcast, reconnect policy).
  - Gallery of 16 with pages, speaker view, pin, speaking highlight, mic and camera with shortcuts, hands, reactions, announcements.
  - Covers: AC-F02-12 (path), 13, 20 (layout), 21, 22, 23, 24, 44.
  - Tests: TC-F02-24, 42, 43, 44, 45, 47, 48, 89, 110 (DTLS-SRTP part), and the parts of 51 (a real client can't publish a screen as an attendee) and 98 (disconnect within 5 s, measured) that need a real participant.
  - Check: two app windows see and hear each other; the owner can try a call on the Mac.
  - **Built in T14:**
    - livekit-client 2.22.3 added; `@livekit/components-react` left out (our own hooks are enough, one dependency less);
    - `features/meetings/call/`: `useMeetingRoom` (adaptive stream, dynacast, simulcast, 30-second reconnect policy, each start with its own connection), the people list from attributes (hands first in order), reactions (5 names, 1 a second, 3 seconds), shortcuts ⌘⇧M/⌘⇧O/⌘⇧K, announcements (one polite region, 2 seconds apart), elapsed time;
    - MeetingPage: gallery (16 a page) and speaker view, tiles with speaking ring and word, hands, mute, weak connection (LiveKit's connection quality "poor"/"lost"), reactions; control bar; simple Participants and Meeting info panels; End meeting for organizers; "X muted you"; on an unexpected disconnect the backend says why (removed, ended) and that message shows;
    - `pnpm dev:window` opens a second window with its own profile, to be two people on one Mac;
    - desktop test `call.spec.ts` (two windows, same account: see each other, mute by shortcut and a raised hand reach the other window, Leave) passes;
    - **next tasks:** Pin for me (from the participant menu) and sharing come with T15; the weak-connection rule by packet numbers, Rejoin and device settings with T16.

- [x] **T15: Panels and organizer controls in the app.**
  - Participants panel with the lobby, Meeting info, Meeting options, mute, remove, roles, lock, End meeting with confirmation, "Choose what to share" and sharing, the 30-hour notice.
  - Covers: AC-F02-15, 25, 26, 33, 34, 35, 36, 37, 38, 39.
  - Tests: TC-F02-49, 52, 69, 71, 74, 77, 79, 81.
  - Check: each control works from one window and is seen in the other.
  - **Built in T15:**
    - lobby inside the call (lobby bar and the panel's lobby; read on the server's "lobby changed" and every 10 s; arrivals announced), Admit/Deny/Admit all;
    - each person's menu by role (a copy of the backend's table, `call/permissions.ts`): mute, lower hand, make presenter/attendee, Pin for me (everyone; the pinned person comes first and leads Speaker view), remove; Mute all;
    - Meeting options inside the call with the Lock switch (applies at once); End meeting with a confirmation;
    - sharing through "Choose what to share" (desktop picker; a browser uses its own); "Your share ended" when a newer share wins; the 30-hour "ends in 10 minutes" notice;
    - `call.spec.ts` now also checks: a guest waits, the lobby bar names them "(Guest)", Admit all lets them in, Mute reaches them ("muted you"), Remove shows "You were removed"; sharing through the picker; End meeting reaches the other window. Both checks pass.

- [x] **T16: Connection and devices in the app.**
  - Weak-connection detection and notice; reconnect, and "You've lost connection" with Rejoin.
  - Device settings panel, noise suppression, unplugged devices, Leave and closed apps, the 10-second "Can't reach MeetApp" with Retry.
  - Covers: AC-F02-28, 29, 30, 31, 32, 46.
  - Tests: TC-F02-54, 55, 56, 59, 60, 61, 62, 63, 91.
  - Check: cutting the network for 10 seconds brings the person back by themselves in the same role.
  - **Built in T16:**
    - weak connection: the rule (over 5% loss or 300 ms, 5 seconds in a row; unit test TC-F02-54) read every second from the own connection's WebRTC numbers, shown only on the own tile and in Device settings;
    - "Reconnecting…" while LiveKit retries (30 seconds); after that "You've lost connection" with **Rejoin** (the old ticket, once, within 30 minutes), which goes to the call or the lobby by the usual rules;
    - Device settings panel from More: camera, microphone with level, speakers with Test speakers, noise suppression (on by default, applied to the sent microphone at once), all remembered;
    - an unplugged device in use: the default takes over and the screen says which device changed;
    - closing the window tells the backend (Leave sent as the page closes), so others see the person leave at once;
    - "Can't reach MeetApp. Check your connection." with **Retry** on Join now, Join a meeting and the lobby's status check (Meet now and Get link had it already);
    - the window check now also opens Device settings and switches noise suppression off.
    - **At the end (D052, extended):** the network-cut checks (TC-F02-55, 56, 59), unplugging devices (TC-F02-61), leave and crash (TC-F02-62, 63) and the unreachable backend (TC-F02-91).

- [x] **T17: Workspace settings: Allow guests.**
  - WorkspaceSettingsPage (name moved from F01, Allow guests) and the menu item rename.
  - Covers: AC-F02-40.
  - Tests: TC-F02-83.
  - Check: turning guests off refuses a guest window at once.
  - Built in T17: `pages/WorkspaceSettingsPage`, `features/workspaces/settings.ts`, the "Workspace settings" menu item (owner and admins), `/me` workspaces carry `allowGuests`. `tests/e2e/desktop/workspace-settings.spec.ts` passes (guest on the pre-join refused at once). Left for /spec-verify (D052): the "plain member doesn't see it" part of TC-83.

## Measuring and finishing

- [x] **T18: Load tests (`pnpm test:load`).**
  - `lk perf load-test` in Docker (`network_mode: service:livekit`): 99 simulated people with video, plus the app as the 100th.
  - Measures: frames per second of the 16 tiles, audio delay, join time, and memory in a 25-person meeting. Results recorded in verification.md.
  - Covers: AC-F02-12, 20, 47.
  - Tests: TC-F02-25, 41, 92.
  - Check: the targets of quality-targets.md are met on the reference MacBook, or the gap is shown to the owner.
  - Built in T18: `tools/load.ts`, `infra/load/` (a test call server on port 7890 without reports to the backend, and the pinned `lk` image), `tests/load/`. Targets changed with the owner (D056): tiles show ≥ 90% of received frames; memory < 700 MB.
  - Results on the owner's MacBook (2026-10-15), idle run: sound delay 63 ms; joins 1.2 s (95th percentile of 20); tiles 14.5–15 frames a second from 15 received; 25-person memory 470–650 MB. A run while the Mac was busy: memory 430–628 MB (pass) but tiles 1–15 frames a second and sound 472 ms. The simulated people share the Mac, so the gallery numbers need an idle Mac; re-run at /spec-verify. Also fixed during T18 (owner's report): the meeting screen fits the window, the control bar always shows, and tiles shrink to fit.

- [x] **T19: Keyboard, screen reader, states and documentation.**
  - A keyboard-only run through every F02 screen; loading and error states; translation keys.
  - Docs:
    - privacy-legal.md (what F02 stores);
    - runbooks (the call server and the load test);
    - the glossary;
    - the canvas link for the owner's look check.
  - Covers: AC-F02-43, 44, 45.
  - Tests: TC-F02-87 (prepared; the owner does it at verify), 88, 90.
  - Check: everything works without a mouse; every text comes from the translation file.
  - Built in T19: privacy-legal.md "What meetings and calls store (F02)"; `docs/runbooks/calls.md` (call server, two windows, the load test); glossary terms; getting-started commands; the canvas link in TC-F02-87; unused exports from earlier F02 tasks removed (`pnpm check:unused` clean). Every visible text already comes from en.json (lint rule i18next/no-literal-string, en.test.ts). Written and run at /spec-verify (D052, extended): TC-F02-88 (keyboard-only desktop run) and TC-F02-90 (loading and error states of each new page); TC-F02-87 is the owner's look check there. Open: add the F02 components and icons to the design system artifact (D029).

## Check: every test case belongs to a step
TC-F02-01–03, 05–07, 09–12, 104 → T3 · 04, 08, 15–17, 93, 94, 105 → T4 · 65, 96, 97, 106 → T5 · 22, 23, 26–31, 33–39, 73, 95, 100, 101 → T6 · 40, 57, 58, 64, 80, 84, 85, 99 → T7 · 46, 48, 50, 51, 53, 66–68, 70, 72, 75, 76, 78, 82, 98, 103 → T8 · 102, 107–109 → T9 · 110 → T1 · 05 (database part) → T2 · 111–114 → T10 · 86 → T11 · 13, 14, 18 → T12 · 19–21, 32 → T13 · 24, 42–45, 47, 89 → T14 · 49, 52, 69, 71, 74, 77, 79, 81 → T15 · 54–56, 59–63, 91 → T16 · 83 → T17 · 25, 41, 92 → T18 · 87, 88, 90 → T19.

## Fixes from the first verification (2026-10-16, verification.md)

- [x] **T-fix-1: Removed co-organizers lose their powers (security, High).** Only co-organizers who are still workspace members count (`findMeeting`); their rows go when they leave or are removed; an integration test (locked meeting → refused, record → 404).
  - Done: `coOrganizersOf` joins current memberships; `leave` and `remove` delete the person's co-organizer rows in the same transaction (`dropCoOrganizerRoles`); test "T-fix-1" in access.integration.test.ts (removed co-organizer refused by a lock, rows gone). The record stays readable to people who took part, as AC-F02-41 says. Also fixed: TC-F02-51 read the pass sources as numbers.
- [x] **T-fix-2: Security, Medium and Low.** A per-ticket limit on `GET /attendances/:id` and no new room/pass when nothing changed; the clean-up skips non-UUID identities and survives one bad call; guest names lose format characters; the create-meeting repeat answer keeps no secrets in Redis; an https setting for the call server's admin API in production.
  - Done: `GET /attendances/:id` limited to 120 a minute per ticket (`attendanceStatus` rule, test "T-fix-2"); the clean-up removes non-attendance identities without asking the database and one failing call no longer stops the round; guest names lose `\p{Cc}` and `\p{Cf}` characters after NFC (TC-F02-22 extended); a repeated create keeps only the meeting id in Redis and rebuilds the answer (`repeatCreate`); the admin API uses https in production (`callServerAdminUrl`, TC-F02-110 extended). Known limits recorded in design.md section 9 and infrastructure.md (`trustProxy`). Also fixed: TC-F02-100 could pick the real ticket as the "changed" one (1 in 64).
- [x] **T-fix-3: Bugs.** A call that can't connect shows the lost-connection card; a closed connection can't change the new one's state; people let in who never connect are freed after 2 minutes; Rejoin is used only when it succeeds; Enter twice joins once; reactions keep their 3 s; the lobby check stops after an error; call-server reports are marked handled only after they are applied; unplugged devices are found by id, not by name.
  - Done: `startRoom` (meeting-room.ts) ignores a closed connection's result and, when a call never connects, asks the backend and shows the lost-connection card; the clean-up frees places of people let in but not connected after a minute (`presentIn` + `dropped`); Rejoin accepts a never-connected attendance and gives the one Rejoin back when the entry fails (`unmarkRejoined`); pre-join ignores a second submit while joining; each reaction has its own 3 s timer; the lobby check stops after an error until Retry; a call-server report that fails is forgotten so its retry is applied (`forgetEvent`); a device is gone only when its id is missing. Tests: repairs.integration.test.ts (3); the app-side tests come with T-fix-5.
- [x] **T-fix-4: Screens (UI must fix).** Meeting info loading and error states; mic/camera/hand buttons without the contradictory "pressed"; panel focus (move in, return on close, Escape); the clock redraws only itself, tiles are memoized, the people list is light at 100. Also: "Connecting…" while the call starts; Workspace settings error state with Retry when the workspace list fails. Should fix where cheap: speaker view fit, 5 tiles only, Rejoin pending, Share dialog error, device names, co-organizer "nobody found", blank pages, busy states.
  - Done: Meeting info shows a spinner while loading and the error with Retry; mic, camera, share and hand buttons say only their action (`labelIsAction`, no "pressed"); a side panel takes focus on its title, closes with Escape and gives focus back to its opener; the clock redraws only the control bar; "Connecting…" while the call starts; Workspace settings shows a spinner or the error with Retry until the workspaces arrive; speaker view builds 5 tiles and its strip fits short windows; unnamed devices read "Camera 1"; the Share dialog stops waiting when screens can't be listed; no blank meeting page (back to the start) and the lobby title is never empty. Tests: SidePanel focus/Escape, IconButton `labelIsAction`; 218 app and 341 UI tests pass.
  - Left as should-fix (not blocking, noted for F02 polish or F10): Rejoin shows no "Rejoining…" while pending; the co-organizer search has no "nobody found" line; a repeated identical announcement isn't read twice; Admit all and Mute all show no busy state; the people list draws all rows (100 is fine now that the clock no longer redraws it every second).
- [x] **T-fix-5: Coverage ≥ 80%.** Unit tests for `apps/web/src/features/meetings/**` (call, devices, join, visit) and `apps/api/src/providers/livekit.ts` branches.
  - Done: 18 new web test files (fake LiveKit room in `features/meetings/call/test-support/fake-room.ts`), including the app-side T-fix-3 tests; `apps/web/src/features/**` now lines 98.3%, statements 96.8%, functions 94.4%, branches 93.3% (323 web tests pass). `providers/livekit.test.ts` covers muting, server messages, rights, removal and the room list (branches of livekit.ts 17% → 100%); the whole-project figure is confirmed in T-fix-8.
- [ ] **T-fix-6: The postponed and missing screen tests.** TC-13, 14, 18–21, 24, 43–45, 49, 51, 52, 55, 56, 59–63, 69, 71, 74, 75, 77, 79, 81, 83 (member part), 88, 90, 91, 98; F00/F01 desktop tests ask for the exact "Settings" button (done). Written 2026-10-16, to run: meetings-page, pre-join, connection, meeting-keyboard and workspace-settings (member) desktop specs, access.integration.test.ts (51, 75, 98); page tests for TC-90 pass. Still to write: TC-24, 43–45, 49, 52, 60, 69, 71, 74, 77, 79, 81 (check call.spec.ts first), the desktop parts of TC-107 and 114, TC-63 (organizer leaves, the call stays).
- [x] **T-fix-7: Documentation.** Every "must fix" of the documentation check in verification.md.
  - Done: design.md (created files incl. load tests, JoinMeetingPage, call/, meetings.ts, second-window; `0004_lobby_reasons`; `*_enc` columns; `left_reason` values; indexes; personal workspace on the guest switch; error codes `FORBIDDEN`/`NOT_FOUND`; the load-test call server; D054/D055 accepted and `@livekit/components-react` not added); tasks.md and tests.md error codes; D055 "built" note; D040 wording; frontend.md calling row; infrastructure.md (load-test call server, `trustProxy`); quality-targets.md (the 90% rule); privacy-legal.md (ticket fingerprint kept with the record); project-structure.md; docs/README.md (runbook); progress.md (session log, guests answered); the READMEs of api, desktop, web, ui, contracts and db. CLAUDE.md already listed `pnpm test:load`.
- [ ] **T-fix-8: Final runs and the owner's checks.** The whole suite, `pnpm test:visual` (new baselines for the meeting screen), `pnpm check`, `pnpm check:container`, `pnpm test:load` on an idle Mac, the owner's look check (TC-F02-87), and the F02 components and icons added to the design system artifact (D029).
