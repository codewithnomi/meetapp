---
feature: F15
title: Calls from chat (audio and video)
status: in-progress
updated: 2026-10-27
---

# F15 Calls from chat (audio and video): Tasks (STEPS)

Small steps, done in order. Each step should be finishable and testable in one sitting.
Tick `[x]` when done and verified. Branch `feat/F15-calls` (started from `feat/F14-chats`, D069).
Per step: only that step's tests plus typecheck and lint (D052); everything else at `/spec-verify`, together with F14's second verification.

### Backend
- [x] **T1: Libraries and shapes.** Vet `@livekit/track-processors` with `/add-dependency` (D073: licence, age, size, its model files' licence); contracts `calls.ts` (start/join/accept/decline/ring/transfer requests and answers, `ring`/`ring_stop` line messages, call note shapes, errors). Covers: design 1, 5. Check: contracts build; licence check passes.
- [ ] **T2: Migration `0009_chat_calls` and the call place.** `calls`/`call_attendances` belong to a meeting or a chat (check constraint, partial unique index for one running call per chat), `calls.media`, `call_rings`, `user.ringtone`, `user.ring_volume` (`/db-migration`); F02's join, pass and webhook code takes a "call place" (meeting or chat). Covers: AC-F15-14, 26, D072. Tests: TC-F15-75, TC-F15-79.
- [ ] **T3: Start and join a chat call.** `POST /conversations/:id/calls`, `GET /conversations/:id/call`, `POST /calls/:callId/join`; read-only rules, more-than-20 groups, the 20-person limit, the race, equal rights (organizer routes refuse chat calls), membership checked at join. Covers: AC-F15-01–04, 12, 14, 20, 26. Tests: TC-F15-01, 03, 05, 07, 08, 27, 59, 64.
- [ ] **T4: Ringing.** `call_rings` state machine; ring targets with the live-line target (`ring`, `ring_stop` to all the person's windows); accept (conditional, first wins), decline, cancel (starter only). Covers: AC-F15-05–07, 09, 34, D075. Tests: TC-F15-10, 13, 15, 16, 17, 44, 45, 74.
- [ ] **T5: Timeouts and ending.** 30-second delayed job, the clean-up's 35-second safety net, caller leaves a group first, one-to-one ending rule, accept after timeout, 30-hour end. Covers: AC-F15-08, 09, 14, 19. Tests: TC-F15-18, 19, 20, 21, 22, 31, 32, 62.
- [ ] **T6: Add people and the rate limit.** `POST /calls/:callId/ring`; 10 starts or rings a minute per person; malicious input. Covers: AC-F15-13, 22. Tests: TC-F15-29, 66, 73.
- [ ] **T7: Call notes.** `call_started`, `call_ended`, `call_missed` through F14's notes; missed notes only for their person (pages, news, list), unread rules, durations. Covers: AC-F15-04, 15. Tests: TC-F15-33, 34, 35, 37.
- [ ] **T8: Status "In a call".** Chat-call attendances count; `in_meeting` renamed `in_call` everywhere (contracts, app, F14 tests). Covers: AC-F15-16, D070. Tests: TC-F15-38, 39.
- [ ] **T9: Security, removal and data.** Outsider sweep over every new route, pass rules, logs, blocks (one-to-one and groups), removal from the chat during a call and while ringing (2 seconds), data kept/cascade/export. Covers: AC-F15-20–25, 28. Tests: TC-F15-63, 65, 67, 68, 69, 70, 71, 72.
- [ ] **T10: Other devices and transfer.** `GET /me/calls/active`, `POST /calls/:callId/transfer`: the new seat connects before the old one is removed; never connects → the old seat stays. Covers: AC-F15-33, D075. Tests: TC-F15-40, 41, 42.
- [ ] **T11: Ringtone settings.** `GET/PATCH /me/settings` gains `ringtone` (1–5) and `ringVolume` (0–100). Covers: AC-F15-32. Tests: TC-F15-52.

### Screens
- [ ] **T12: UI pieces.** `IncomingCall` (organism), `CallingScreen` (template), `CallNote`, `BackgroundPicker`, `RingtonePicker` (molecules) with stories and tests, matching the approved canvas; tone patterns (Web Audio, D074). Covers: AC-F15-15, 17, 32. Tests: TC-F15-36, 53, 55.
- [ ] **T13: Calling from a chat.** Call buttons (disabled with a reason), the Calling screen and its outcomes, Join in the header and the note, loading and error states, missing camera or microphone, backend unreachable. Covers: AC-F15-01–03, 18, 19, 27. Tests: TC-F15-02, 04, 06, 23, 57, 60, 61.
- [ ] **T14: Being called (milestone: two windows can call each other).** The app-wide incoming call on every window, the chosen ringtone and volume, accept with video or audio, a second window, called during a call or meeting (quiet tone, "Leave current call and accept"), no window open → missed later. Covers: AC-F15-05, 06, 10, 11, 32. Tests: TC-F15-09, 11, 12, 14, 24, 25, 26, 54.
- [ ] **T15: In the call.** F02's call screen for chat calls with equal rights, the **Add people** panel (20 limit) and the **Chat** panel showing the chat. Covers: AC-F15-12, 13. Tests: TC-F15-28, 30.
- [ ] **T16: Another device.** "You're in a call on another device" with **Join on this device** and **Transfer to this device**. Covers: AC-F15-33. Tests: TC-F15-43.
- [ ] **T17: Settings → Devices.** Device choices move to `features/devices` (shared with F02's pre-join and in-call settings); Settings page with preview, level meter, Test speakers, noise suppression; remembered per computer, fallback. Covers: AC-F15-29. Tests: TC-F15-46, 47.
- [ ] **T18: Backgrounds (milestone: blur and pictures in the preview and calls).** The background tool on the local camera (disabled first, then switch), its files and the 8 pictures shipped in `public/backgrounds/` with licences, frame-rate fallback, "not available" on unsupported computers; preview, pre-join, calls and meetings. Covers: AC-F15-30, 31. Tests: TC-F15-48, 49, 50, 51, 78.
- [ ] **T19: Keyboard, screen reader, translations and docs.** Incoming call focus and announcement, all flows by keyboard, every text from the translation file; docs (overview, operations, privacy, security S5, desktop README, project structure, runbook). Covers: AC-F15-17, 18. Tests: TC-F15-56, 58.
- [ ] **T20: Load.** A 20-person chat call and ring speed under load in `pnpm test:load` (run with `/spec-verify`). Covers: AC-F15-06, 14. Tests: TC-F15-76, 77.
