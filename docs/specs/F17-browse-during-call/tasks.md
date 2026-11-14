---
feature: F17
title: Browse during a call
status: in-progress
updated: 2026-11-14
---

# F17 Browse during a call: Tasks (STEPS)

Small steps, done in order. Each step should be finishable and testable in one sitting.
Tick `[x]` when done and verified. Per D052, each task runs only its own tests plus typecheck and lint; the full run happens at `/spec-verify`. Desktop window tests run only while the owner is away.

- [x] **T1: The small call view (organism).** `packages/ui/src/organisms/SmallCallView` with every state (lobby, calling, connecting, reconnecting, in call, sharing, not allowed to unmute), labels as props, live region, keyboard; stories; `AppLayout` gets `reserveCorner`. Covers: AC-F17-02, 18, 21. Tests: TC-F17-03, 04, 05, 19, 42.
- [x] **T2: Call state for the small view.** `useCallScreen` gains `extras` (`video`, `leaveChoices`, `sharing`, filled by the call screen); `useSmallCallView`; `useCurrentCall()` with `fullPath`; `useCallOutcome` store. Covers: AC-F17-04, 05, 08. Tests: TC-F17-12, 13, 21.
- [x] **T3: The call host.** `app/CallHost.tsx` beside the routes: active rules, `hosted` prop (no `<Navigate>`), hidden + `inert` wrapper, call routes only mean "full", callbacks that move only while full, outcome banner with Rejoin, focus skips the hidden call, lobby preview off while hidden, small view shown on other screens. Covers: AC-F17-01, 03, 05, 06, 07, 18, 20. Tests: TC-F17-08, 14, 15, 16, 17, 20, 44, 45. (milestone: the owner can browse during a call)
- [x] **T4: Marks in the app.** Chat list "Call in progress"; Meetings "Go back". Covers: AC-F17-08. Tests: TC-F17-22.
- [x] **T5: Leave first.** `useLeaveFirst()` and its dialog; used by Meet now, chat call buttons, Join on a call note. Covers: AC-F17-09, 10. Tests: TC-F17-23, 24, 25, 26.
- [x] **T6: Another meeting during a call.** Pre-join note and "Leave call and join", Cancel goes back, same meeting → full call, camera preview sharing; `desktop-commands` stops waiting for signed-in people, guests keep it. Covers: AC-F17-11, 12, 13. Tests: TC-F17-27, 28, 29, 30, 31, 32, 33, 48, 49.
- [x] **T7: Sign-out, window close, F16.** Sign-out leaves first (5 s limit); F16 "back to the call" uses `fullPath`. Covers: AC-F17-14, 16, 19. Tests: TC-F17-34, 35, 36, 46, 47.
- [x] **T8: Desktop window tests and pictures.** The browse, switch and windows specs (other people see no change, every menu item, shortcuts, positions, 20 switches with the audio check, several windows, smallest window), screenshots, translations, nothing new to the server; docs (README, runbook, progress). Covers: AC-F17-01, 02, 03, 04, 15, 17, 20, 21. Tests: TC-F17-01, 02, 06, 07, 09, 10, 11, 18, 37, 38, 39, 40, 41, 43, 50.

## Fixes from /spec-verify (2026-11-14)
- [ ] **T-fix-1: Signing out any way clears the call** (security, High). Sign out everywhere, a session that ends, or another person signing in on the window: leave the call (best effort) and clear the visit, chat call, outcome, call-screen and call-corner stores. Sign out everywhere leaves first like Sign out; both sign out even if leaving takes over 5 s. Workspace switcher during a call: ask first (Low). Store no passcode in `address` (keep a fingerprint). Tests: a session change during a call leaves and clears; a new person sees no call.
- [ ] **T-fix-2: The current call is always right** (bugs H1, H3, M2). A new visit or chat call clears an old outcome (tie the outcome to its attendance); Dismiss ends only the visit it belongs to. A declined or unanswered chat call is not "in a call". The address is kept only on rejoin (same attendance). Tests for each.
- [ ] **T-fix-3: Lobby endings show** (bug H2). Denied, timed out or removed while waiting: the host reports it (Ended screen when full, banner when hidden) instead of unmounting the lobby first. Test.
- [ ] **T-fix-4: Leaving that can't run, and Cancel** (M1, M4, M5). No controls published: end the visit and chat call directly instead of waiting 5 s. Pre-join Cancel goes to the call (or Meetings) instead of `navigate(-1)`. Cancel or leaving the pre-join while "Leave call and join" waits stops the join. Tests.
- [ ] **T-fix-5: Review leftovers.** Unused exports (`currentCallOf`, `CurrentCall`, knip); banners share one top slot so they never overlap (L4); "Leaving…" on the busy buttons; focus to the small view's Go back when the call hides (UI 2); the small view's sizes from one shared value (UI 6). Then the full run with the desktop windows and screenshots.
- [ ] **T-fix-6: Documents match the code** (docs check). Old "link waits during a call" wording for signed-in people: D088, runbooks/desktop-app.md, F04 requirements AC-F04-10, F04 design, TC-F04-28 and F04 verification (guests unchanged). runbooks/calls.md gets a "Browse during a call" section. design.md: real SmallCallView props (no `state`, no "connecting"), focus.ts selector, no `meetingId`, shells pass `reserveCorner`. tests.md: file paths in each TC, TC-F17-43 → en.test.ts, TC-F17-46 level, TC-F17-50 as the no-backend check. Stories (or a recorded reason) for LeaveFirstDialog, CallNavRail and the notes; a camera-on SmallCallView story. packages/ui README (SmallCallView), apps/web README (meeting-routes, focus, useCurrentCall), glossary (Full call, Small call view). progress.md: keep "Still open from T0: the GitHub desktop check (TC-F15-56, TC-F02-107)".
