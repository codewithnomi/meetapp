---
feature: F16
title: Calls while MeetApp isn't in front
status: in-progress
updated: 2026-11-02
---

# F16 Calls while MeetApp isn't in front: Tasks (STEPS)

Small steps, done in order. Each step should be finishable and testable in one sitting.
Tick `[x]` when done and verified. Per D052, each step runs only its own tests; the whole suite, desktop tests and screenshots run at `/spec-verify`.

- [x] **T1: Notification check (D080).** Result: not possible without real signing; recorded in D080, and TC-F16-28 waits for F04. On the owner's Mac, try an ad-hoc-signed development build with a "Missed call" notification and a Call back button. Write the result into D080: does it show, does Call back appear? No feature code. Covers: AC-F16-10, 13b (feasibility). Check: the result is recorded, and TC-F16-28 says when it can be run.
- [x] **T2: The rules (`call-windows.ts`, no Electron).**
  - When the ring and mini windows show or hide.
  - Corner placement, stacking, gap closing, no overlap with the mini window.
  - Remembered places and the off-screen fallback.
  - Merging reports from several main windows; focus history for "was in front".
  - The 150 ms flicker wait; share and backToCall bring the main window forward.
  - Covers: AC-F16-01, 05, 08, 09, 14, 19, 20, 24. Tests: TC-F16-01, 02, 16, 18, 29, 38, 41, 43, 44, 61.
- [x] **T3: Safety first.**
  - The `call-windows` session with every permission, device, display-media request and download refused.
  - `call-window.html`'s own CSP (app-protocol and dev-server hook).
  - The small windows' preload (`meetappCallWindow`) and the main window's `callWindows` bridge.
  - The action allow-list and sender check; locked-down window settings and content protection.
  - The apps/desktop/CLAUDE.md rule update (D079).
  - Covers: AC-F16-22, 25, and 23 (logs). Tests: TC-F16-51, 52, 53, 54, 55, 56, 59.
- [x] **T4: Electron wiring (`call-windows-bridge.ts`).**
  - Create and destroy the small windows: always on top, all Spaces and full screen, `showInactive`.
  - Track focus, minimize and hide.
  - Save places in `call-windows.json` after a drag; react to screen changes.
  - Drop a window's report on a crash or reload.
  - Covers: AC-F16-06, 19, 20, 26. Tests: TC-F16-46, 60.
- [x] **T5: The two windows in the gallery.** `RingWindow` and `MiniCallWindow` organisms (packages/ui) as on the approved canvas, with stories for every state, names for screen readers, keyboard use and Escape. All texts are translated. Covers: AC-F16-02, 07, 15, 21. Tests: TC-F16-04, 14, 31, 48, 49. Screenshots are made at verification.
- [x] **T6: The small page (`call-window.html`).** A separate Vite entry that shows `RingWindow` or `MiniCallWindow` from the state it receives and sends button presses with `act`. It has no router, sign-in or API client. Covers: AC-F16-02, 15, 22. Tests: covered by T3 (TC-F16-53, 54) and T8 / T10.
- [x] **T7: The main window's side (`features/call-windows`).**
  - The report builder: rings, busy text, call phases and missed rings.
  - The action handler, running the same code as the screen buttons; Call back with the chat button's messages.
  - One tone for several rings, and the quieter tone when busy.
  - Covers: AC-F16-03, 07, 08, 11, 12, 16. Tests: TC-F16-06, 15, 17, 24, 32, 35.
- [x] **T8 (milestone): Ring windows working end to end.**
  - Call while another window is in front: the ring window shows unfocused.
  - Video, Audio, Decline and ×; it closes when MeetApp comes forward (tone goes on), when the ring ends or the caller cancels.
  - Two callers stack; two MeetApp windows show one ring window; keyboard and Escape.
  - Covers: AC-F16-01–09, 21, 24. Tests: TC-F16-03, 05, 07, 08, 09, 10, 11, 12, 13, 19, 45, 50.
- [x] **T9: Missed-call notifications.**
  - Shown once per call, only when not in front at the ring's end.
  - Call back and clicking the notification work; no notification for answered, declined or cancelled calls.
  - A refused or failing notification is ignored quietly.
  - The text holds names only.
  - Covers: AC-F16-10, 11, 12, 13, 13b, 23. Tests: TC-F16-20, 21, 22, 23, 25, 26, 27, 58.
- [x] **T10 (milestone): Mini call window.**
  - Shows in a call, the lobby and "Calling…" when MeetApp isn't in front.
  - Live speaker video over the MessagePort (stops when hidden).
  - Every button does what the call screen does, both ways within 1 s; share opens our picker in front.
  - Reconnecting, leaving, ending and removal.
  - Covers: AC-F16-14–18. Tests: TC-F16-30, 33, 34, 36, 37, 39, 40.
- [x] **T11: Places and hand checks.** Done 2026-11-02: TC-F16-42 passes. The owner skipped the hand checks TC-F16-47 (full screen) and TC-F16-57 (screen share); they are pending, and TC-F16-28 waits for signing (D080). The content-protection flag is checked automatically (TC-F16-56). A dragged place is kept after a restart (desktop test). With the owner, on the Mac: over a full-screen app, not in a screen share (our own share and one other app), and the Mac notification when T1 allows. Covers: AC-F16-10, 19, 25, 26. Tests: TC-F16-28, 42, 47, 57.
- [x] **T12: Documentation.** Update overview, security S17 (the two small windows, their session and CSP), the desktop and web READMEs, the project structure, privacy (places stored on this computer, notification text), the operations runbook (notifications need signing, D080) and progress. Covers: all (docs are part of done). Check: the docs-keeper finds nothing missing.

## Fixes from the first verification (2026-11-02, verification.md)
- [x] **T-fix-1: Live video and fresh state.** Main window not throttled while the mini window shows (`backgroundThrottling: false`, no occlusion pause). The report becomes a real throttle (at most every 200 ms, always the latest state). The first state and the frame line reach a small window once its page is ready (the page says "ready"; main replays them). Tests: frames keep coming with MeetApp in the background; state is fresh under constant redraws.
- [x] **T-fix-2: Memory.** The mini window's pictures are released properly (old picture freed after the new one has loaded, cleared when the video stops; `video.pause` on stop; no sending after stop). Photos are read once and sent only when they change. The missed-ring map and the told set are pruned. Test: memory stays flat (under 10 % growth) over 3 minutes with the mini window and live video.
- [x] **T-fix-3: Security hardening.** The small session serves only `call-window.html` and its own files. `call-windows.json` is validated and written owner-only. The mini preload caps frames at 200 KB.
- [x] **T-fix-4: Robust windows.** Notifications are kept until used. `setBounds` runs only on change and never during a drag. The whole ring stack avoids the mini window and stays on screen. The 150 ms timer has a margin. Saving places can't crash the app. Reports are checked per entry (bad entries dropped, the web side clamps text and photos). Stale small windows are forgotten on `closed`. Reloads are detected with `did-start-navigation` and the report is re-sent after load.
- [x] **T-fix-5: Accessibility.** Shortcut hints come from the platform (`shortcutText`). Only status changes are announced in the mini window. The ring window is announced when it appears. The description covers the name, the kind of call and the busy line. Reasons stay reachable on disabled buttons. Missing stories (Muted, Hand raised, Camera on, IncomingCall standalone).
- [x] **T-fix-6: Code quality and docs.** One dev-server CSP helper. Comments on errors ignored on purpose. Contract types used directly. All documentation items in verification.md, including moving Linux "hide while sharing" to later and the lock-screen note in privacy.
## Fixes from the second verification (2026-11-02)
- [x] **T-fix-8: Missed call when the caller hangs up.** A caller's Cancel before anyone answers gives the Mac notification (AC-F16-10, 12 as changed by the owner). Removal from a call gets its own reason and no notification. Tests: new TC for caller Cancel and for removal.
- [x] **T-fix-9: Small window fixes.** A window dropped in a bad spot moves back (reset the last place after a drag). Dragging can't stay stuck on (settle timer also on `will-move`). Ring windows aren't re-sent an unchanged view. The stack never overlaps with many rings (AC-F16-08). The mini window closes its old video channel. Photos only PNG, JPEG or WebP. Old notifications are dropped after a limit.
- [ ] **T-fix-10: Battery.** The main window is not throttled only while a call is on (not always); document the cost. Test: frames still flow during a call with MeetApp in the background.
- [ ] **T-fix-11: Accessibility and quality.** The ring window is announced once (not alert + alertdialog). The disabled Share says why. Move `hideMini`/`hide` into `routeAction`; split `render()`; one ring list instead of two arrays; named timer margin; no `as Rect` casts.
- [ ] **T-fix-12: Tests and docs for the mini hide ×.** A TC under AC-F16-15 with an automated test. All docs-keeper items (design.md sections 1, 3.2, 3.3, 3.5, 4; requirements places file and Linux screen share; tests.md AC table; runbook calls.md; operations; D079 note; features.md F04).
- [ ] **T-fix-7: Second verification.** Full run on a Mac with enough free memory (close browsers and Teams; Docker with a memory limit), screenshots for the owner, reviews.
