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
- [ ] **T10 (milestone): Mini call window.**
  - Shows in a call, the lobby and "Calling…" when MeetApp isn't in front.
  - Live speaker video over the MessagePort (stops when hidden).
  - Every button does what the call screen does, both ways within 1 s; share opens our picker in front.
  - Reconnecting, leaving, ending and removal.
  - Covers: AC-F16-14–18. Tests: TC-F16-30, 33, 34, 36, 37, 39, 40.
- [ ] **T11: Places and hand checks.** A dragged place is kept after a restart (desktop test). With the owner, on the Mac: over a full-screen app, not in a screen share (our own share and one other app), and the Mac notification when T1 allows. Covers: AC-F16-10, 19, 25, 26. Tests: TC-F16-28, 42, 47, 57.
- [ ] **T12: Documentation.** Update overview, security S17 (the two small windows, their session and CSP), the desktop and web READMEs, the project structure, privacy (places stored on this computer, notification text), the operations runbook (notifications need signing, D080) and progress. Covers: all (docs are part of done). Check: the docs-keeper finds nothing missing.
