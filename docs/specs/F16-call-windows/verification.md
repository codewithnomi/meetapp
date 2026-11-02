---
feature: F16
title: Calls while MeetApp isn't in front
verdict: FAIL
date: 2026-11-02
---

# F16 Calls while MeetApp isn't in front: Verification Report (round 1)

Run on 2026-11-02 on battery with `caffeinate`, while VS Code, Docker, Chrome, Firefox and Teams were also open on the 16 GB Mac.

## Automated tests (whole project)
| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (coverage ≥ 80%) | 2298 | 0 | 10 todo |
| Desktop e2e | 84 | 38 | 0 |

- Container check: ✅. Storybook build: ✅. `pnpm check` (lint, types, architecture, unused code, duplication, structure, licenses): ✅. Screenshots: not run this round (they come after the fixes, with the owner's look).
- **Desktop:** 35 of the 38 failures came one after another from test 84 onwards. The Mac ran out of memory: the owner saw "Your system has run out of application memory", with test copies of MeetApp counted together as "Electron". These failures are environment, not F16 code. Three F16 tests failed earlier in the run, from timing under the same load (TC-F16-03, 30/34, 36/37). All 10 F16 desktop tests had passed on their own the same day.
- **Memory check** (one copy, development build, a call with the mini window open for one minute): about 620 MB in total and steady. The mini window itself grows from 127 to 150 MB a minute, which needs fixing (T-fix-2).

## Acceptance criteria
ac-verifier: 22 of 27 fully verified.
| AC | Result | Evidence |
|---|---|---|
| AC-F16-01–09, 11, 12, 14–24 | PASS | unit, UI and desktop tests (call-windows*.test.ts, report/use-call-windows/frames tests, RingWindow/MiniCallWindow tests, call-windows.spec.ts). AC-11's "can't start" path is TC-F16-24 |
| AC-F16-10, 13b | WEAK | notification code is unit-tested; a real Mac notification needs signing (D080, TC-F16-27/28 by hand later) |
| AC-F16-25 | WEAK | content protection flag tested; hand check TC-F16-57 skipped by the owner |
| AC-F16-26 | WEAK | always-on-top and full-screen flags tested; hand check TC-F16-47 skipped by the owner |

## Security
Dependency audit (prod): 15 known (5 low, 10 moderate), no high. Secrets scan: gitleaks runs on every commit (pre-commit hook), no leaks.
| Severity | Where | Problem | Fix |
|---|---|---|---|
| Medium | call-windows-bridge.ts (`serveScreens` for the small session) | the small session serves every app file, not only `call-window.html` | serve only the small page and its built files (T-fix-3) |
| Low | `readPlaces` | `call-windows.json` is not checked | validate it; write with mode 0600 (T-fix-3) |
| Low | call-window-preload.ts | the mini window doesn't cap frame size itself | cap at 200 KB there too (T-fix-3) |
| Low | notification on the lock screen | the caller's name is visible on a locked Mac | documented in privacy (T-fix-6); a "hide names" setting can come later |
No Critical or High.

## Quality targets
| Target | Measured | Result |
|---|---|---|
| Ring window shows / Video opens the call (AC-03: within 3 s) | desktop test, < 3 s | ✅ |
| Ring window closes when the ring ends (AC-06: within 2 s) | desktop test | ✅ |
| Mini window state matches the call (AC-16: within 1 s) | desktop test | ✅ when idle; at risk under load (T-fix-1) |
| Memory | one copy about 620 MB; mini window +23 MB a minute | ❌ growth (T-fix-2) |

## Bugs found (bug-finder)
1. **High:** the mini window's live video slows to about 1 picture a second or freezes. The main window is throttled exactly when the mini window shows: there is no `backgroundThrottling: false`, and macOS occlusion pauses it.
2. **Medium-High:** the call report is postponed forever while the call screen redraws often, so the mini window can show a stale mic, camera or hand. It is a debounce, not a throttle.
3. **Medium:** notification objects aren't kept, so their Call back click can be lost.
4. **Medium:** a small window can stay blank if its first state arrives before the page listens. The live-video line has the same race.
5. **Medium:** a window being dragged jumps back. `setBounds` runs on every update, so it should run only when the rect changes and never mid-drag.
6. **Medium:** one too-long field (a large photo, or a long body text) drops the whole report, and missed calls are lost. The checks should be per entry, with clamping on the web side.
7. **Medium-Low:** saving places can throw in the main process. `writeFileSync` needs a try/catch.
8. **Medium:** stacked rings can grow over the mini window. The whole stack should be checked and kept on screen.
9. **Medium-Low:** the 150 ms timer can fire 1 ms early, so the windows never show.
10. **Low:** reloads and crashes, stale windows, the hidden list, missed-ring map pruning, photo refetching, and the frame cleanup (`video.pause`).

## UI review
No Must fix. Should fix:
- shortcut hints written into the texts (wrong on Windows);
- the speaker caption is a live region, so every speaker change is announced;
- the ring window isn't announced when it appears without focus;
- `aria-describedby` covers only the name;
- add Muted, Hand raised and Camera-on stories, and IncomingCall standalone stories;
- disabled buttons hide their reason from the keyboard.

## Code quality
8.5/10, no Must fix. Should fix:
- the duplicated dev-server CSP block in guards.ts;
- comments where errors are ignored on purpose;
- aliases of contract types;
- files near 300 lines.

## Documentation check
- design.md: `photo` field, missed `text`, the controller and notify files, `onFramesWanted` and the frames channel, D079/D080 now accepted, the dev-only policy exceptions.
- The Linux "hide while sharing the whole screen" is not built; move it to later.
- desktop README preload row; web README pages row; progress "Now"; header dates; the desktop's types-only dependency on contracts.
- The small windows' navigation guard is in fact applied by `web-contents-created` in main.ts (the security review confirmed it); make the design say so.

## Verdict
**FAIL.** All unit and integration tests pass and there are no Critical or High security issues. The live video freezes in real use, the mini window's state can go stale, the mini window grows in memory, and several Medium bugs and docs gaps remain. The full desktop run must be repeated on a Mac with enough free memory. Fix tasks T-fix-1 to T-fix-7 are in tasks.md.
