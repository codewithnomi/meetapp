---
feature: F17
title: Browse during a call
status: approved
updated: 2026-11-14
---

# F17 Browse during a call: Tasks (STEPS)

Small steps, done in order. Each step should be finishable and testable in one sitting.
Tick `[x]` when done and verified. Per D052, each task runs only its own tests plus typecheck and lint; the full run happens at `/spec-verify`. Desktop window tests run only while the owner is away.

- [ ] **T1: The small call view (organism).** `packages/ui/src/organisms/SmallCallView` with every state (lobby, calling, connecting, reconnecting, in call, sharing, not allowed to unmute), labels as props, live region, keyboard; stories; `AppLayout` gets `reserveCorner`. Covers: AC-F17-02, 18, 21. Tests: TC-F17-03, 04, 05, 19, 42.
- [ ] **T2: Call state for the small view.** `useCallScreen` gains `speakerTrack`, `leaveChoices`, `openLeave` (filled by MeetingPage, LobbyPage and ChatCallPage); `useCurrentCall()` with `fullPath`; `useCallOutcome` store. Covers: AC-F17-04, 05, 08. Tests: TC-F17-12, 13, 21.
- [ ] **T3: The call host.** `app/CallHost.tsx` beside the routes: active rules, `hosted` prop (no `<Navigate>`), hidden + `inert` wrapper, call routes only mean "full", callbacks that move only while full, outcome banner with Rejoin, focus skips the hidden call, lobby preview off while hidden, small view shown on other screens. Covers: AC-F17-01, 03, 05, 06, 07, 18, 20. Tests: TC-F17-08, 14, 15, 16, 17, 20, 44, 45. (milestone: the owner can browse during a call)
- [ ] **T4: Marks in the app.** Chat list "Call in progress"; Meetings "Go back". Covers: AC-F17-08. Tests: TC-F17-22.
- [ ] **T5: Leave first.** `useLeaveFirst()` and its dialog; used by Meet now, chat call buttons, Join on a call note. Covers: AC-F17-09, 10. Tests: TC-F17-23, 24, 25, 26.
- [ ] **T6: Another meeting during a call.** Pre-join note and "Leave call and join", Cancel goes back, same meeting → full call, camera preview sharing; `desktop-commands` stops waiting for signed-in people, guests keep it. Covers: AC-F17-11, 12, 13. Tests: TC-F17-27, 28, 29, 30, 31, 32, 33, 48, 49.
- [ ] **T7: Sign-out, window close, F16.** Sign-out leaves first (5 s limit); F16 "back to the call" uses `fullPath`. Covers: AC-F17-14, 16, 19. Tests: TC-F17-34, 35, 36, 46, 47.
- [ ] **T8: Desktop window tests and pictures.** The browse, switch and windows specs (other people see no change, every menu item, shortcuts, positions, 20 switches with the audio check, several windows, smallest window), screenshots, translations, nothing new to the server; docs (README, runbook, progress). Covers: AC-F17-01, 02, 03, 04, 15, 17, 20, 21. Tests: TC-F17-01, 02, 06, 07, 09, 10, 11, 18, 37, 38, 39, 40, 41, 43, 50.
