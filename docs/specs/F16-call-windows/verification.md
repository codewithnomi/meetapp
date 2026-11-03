---
feature: F16
title: Calls while MeetApp isn't in front
verdict: PASS
date: 2026-11-03
---

# F16 Calls while MeetApp isn't in front: Verification Report (round 3)

Round 1 (FAIL) is in git history; round 2 (FAIL, 2026-11-02) is `verification-round2.md`. Its findings became T-fix-8 to T-fix-12, all done.

## Automated tests (whole project)
| Suite | Passed | Failed | Notes |
|---|---|---|---|
| Unit | 1789 | 0 | 8 todo |
| Integration | 1021 | 0 | 8 todo |
| Visual (gallery, light + dark) | 683 | 0 | 32 new F16 pictures approved by the owner (2026-11-03) and saved |
| Desktop (real windows) | 122 | 2 | the 2 also fail on `main` without F16 (below) |

- `pnpm check` (lint, formats, types, architecture, knip, duplication, structure, licenses) ✅ · `pnpm check:container` ✅ · Storybook build ✅.
- Desktop: the full run hit low memory from about test 81 (as in round 1); every test failing there passed when run again. F16 broke two tests, and both were test lookups, now fixed: the ring window is a `dialog` now (T-fix-11), and the download test now uses the main windows' session, because a mini call window may be listed first.
- **Known, not from F16:** TC-F15-56 (focus after Escape on the incoming call) and TC-F02-107 (a guest's "joined" announcement) fail the same way on `main`. They are the slow-test follow-up of D077, to be fixed before F04's Pull Request.
- Runs happened only while the owner was away; window tests disturb their work (memory note).

## Acceptance criteria
All AC-F16-01 to 26 PASS (ac-verifier in round 2, plus T-fix-8 for AC-10/12: a caller who hangs up gives the notification, D081; tests TC-F16-68 to 71). WEAK, as before: AC-F16-10 and 13b (the real Mac notification needs signing, D080), and AC-F16-25 and 26 (hand checks TC-F16-57 and 47, skipped by the owner).

## Security
`pnpm audit --prod`: 15 (5 low, 10 moderate), no High or Critical. gitleaks runs in the commit hook on every commit: no leaks (not installed as a separate command). security-auditor: PASS. Its three Lows are fixed in T-fix-9: PNG, JPEG and WebP photos only; the old video line is closed; the notification limit.

## Quality targets
The mini window's memory stays flat (under 10 % growth over 3 minutes): the desktop test passes. Battery: the main window keeps full speed in the background only during a call (T-fix-10).

## UI review
No Must fix. The round-2 Should-fixes are done: the ring is announced once, and the disabled Share says why. Pixel sizes match the existing IncomingCall and are left as they are.

## Code quality
No Must fix (8/10). Routing owns every action, `render()` is split, there is one ring list, and the timer margin is named.

## Documentation check
Every docs-keeper item from round 2 is done (T-fix-12). Fixes T-fix-8 to 11 changed design.md, tests.md, the runbook, operations and D079/D081 with them.

## Verdict
**PASS.** All F16 tests and checks pass, every acceptance criterion is met, there are no serious security issues, and the documents match the code. The only two red desktop tests fail on `main` too and are already listed as follow-ups.
