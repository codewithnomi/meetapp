---
feature: F16
title: Calls while MeetApp isn't in front
verdict: FAIL
date: 2026-11-02
---

# F16 Calls while MeetApp isn't in front: Verification Report (round 2)

Round 1 (FAIL, 2026-11-02) led to T-fix-1 to T-fix-6; that report is in git history (commit a3001c9 and earlier).

## Automated tests (whole project)
| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit | 1784 | 0 | 8 todo |
| Integration | 1021 | 0 | 8 todo |
| Visual (gallery, light + dark) | 651 | 30 | 0 |
| E2E (desktop windows) | not run | | |

- `pnpm check` (lint, formats, types, architecture, knip, jscpd 1.23 %, structure, licenses): ✅. `pnpm check:container`: ✅.
- The 30 visual failures are all "snapshot doesn't exist": the new RingWindow, MiniCallWindow and IncomingCall Standalone stories have no saved pictures yet. The owner must look at them before `pnpm test:visual:update`.
- Desktop e2e was stopped: its windows pop up above every app and disturbed the owner's work. It runs when the owner is away (memory note "quiet testing").

## Acceptance criteria
ac-verifier, code and tests only: AC-F16-01 to 24 PASS; AC-F16-25 and 26 WEAK (flags tested, owner hand checks TC-F16-57 and 47 skipped); AC-F16-10 and 13b WEAK for the real Mac notification (needs signing, D080).
But the bug review shows **AC-F16-10 fails** for the most common case: a caller who hangs up before anyone answers (`ring_stop` reason `cancelled`, `use-call-windows.ts:42`) gives a "Missed call" note but no notification. AC-F16-12 contradicted AC-F16-10; the owner decided as in Teams (D081). Fix: T-fix-8.

## Security
- `pnpm audit --prod`: 15 (5 low, 10 moderate), no High or Critical. Secrets scan: gitleaks not run this round (stopped with the first run).
- security-auditor: PASS, no Critical, High or Medium.

| Severity | Where | Problem | Fix |
|---|---|---|---|
| Low | call-windows-checks.ts:16 | any `data:image/*` (also SVG) accepted for photos | only PNG, JPEG, WebP (T-fix-9) |
| Low | call-window-preload.ts:10-17 | old video channel not closed on relink | close it first (T-fix-9) |
| Low | call-windows-notify.ts:16 | untouched notifications kept forever | limit (T-fix-9) |

## Quality targets
Memory (under 10 % growth over 3 minutes with live video) is a desktop e2e test: not measured this round. New risk: the main window is never throttled (`main.ts:77`), so more battery and CPU even without a call (T-fix-10).

## UI review
No Must fix. Should fix: the ring is announced twice (`role="alert"` plus `alertdialog`); disabled Share doesn't say why; pixel sizes instead of tokens; long-title story. (T-fix-11)

## Code quality
8/10, no Must fix. Should fix: `act()` and `render()` growing (move `hideMini` into `routeAction`, split `render`), parallel `ringOrder`/`ringHeights` arrays, a stray comment, magic `+ 20`, `as Rect` casts. (T-fix-11)

## Documentation check
Behind the code: design.md (sections 1, 3.2 `hideMini`, 3.3 hide rule, 3.5 throttling, 4 places file), requirements (places file, Linux screen share), tests.md (no TC for the mini hide ×, AC table missing TC-F16-62 to 67), runbook calls.md, operations, D079 note, features.md F04. No automated test covers the mini hide ×. (T-fix-12)

## Bugs found
1. Medium: no missed-call notification when the caller hangs up (above, T-fix-8).
2. Low: a window dropped in a bad spot stays there (`call-windows-bridge.ts:98-103`).
3. Low: `dragging` can stay on if `moved` never follows `will-move`.
4. Low: unchanged views (with photos up to 400 KB) re-sent to ring windows every 200 ms.
5. Low: with 5 or more rings the top ones overlap (AC-F16-08).
(2 to 5: T-fix-9.)

## Verdict
**FAIL.** Everything quiet passes, and security is fine. But one real bug remains: if the caller gives up before you answer, the Mac notification doesn't show. There are also small window bugs and documentation that is behind the code. The desktop window tests and the screenshots of the new screens still need a run while the owner is away and a look from the owner. Next: T-fix-8 to T-fix-12, then T-fix-7 again.
