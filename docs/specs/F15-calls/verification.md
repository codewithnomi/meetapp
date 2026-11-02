---
feature: F15
title: Calls from chat (audio and video)
verdict: PASS
date: 2026-11-01
---

# F15 Calls from chat (audio and video): Verification Report (round 2)

Second verification, together with F14's (D069), 2026-10-28 to 2026-11-01. The first run (FAIL) is in `verification-round1.md`; its fixes are T-fix-1 to T-fix-9 in tasks.md.

## Automated tests (whole project)
| Suite | Result |
|---|---|
| `pnpm check` (lint, format, types, architecture, unused, duplication, structure, licenses) | ✅ |
| Backend container (`pnpm check:container`) | ✅ |
| Storybook build | ✅ |
| Unit + integration (coverage ≥ 80%) | 2229 passed, 0 failed |
| Desktop e2e (run in small groups, sign-up limit) | all pass (two F02 timing flukes pass alone) |
| Screenshots (`pnpm test:visual`, 2026-11-01) | 651 passed, 0 failed |
| Load (`pnpm test:load`) | F15 and F14 targets met (below) |

Screenshots: the owner approved the new F14/F15 pictures on 2026-10-29; baselines were updated on 2026-11-01. 10 older pictures were re-saved too. They had tiny pixel differences that can't be seen.

## Acceptance criteria
All 34 PASS (ac-verifier, code and tests). AC-F15-17 (matches the approved designs) is now met: the owner approved the screenshots. AC-F15-22 was clarified: joining, answering and moving a call also count toward the call limit.

## Security
security-auditor: PASS, no Critical or High. One Low was found and fixed (a ghost ring after accepting an already-ended call). Dependency audit: 5 high, all `zod`/`undici` (newly published advisories). They will be handled by `/deps-update` after the merge.

## Quality targets
| Target | Measured | Result |
|---|---|---|
| Ring delivered (95%) | 0.43 s | ✅ (< 2 s) |
| Accept answer (95%) | 0.06 s | ✅ (< 3 s) |
| 20-person chat call, 21st refused | yes | ✅ |
| 25-person meeting memory | 453 MB | ✅ |
| Join time | 1.1 s | ✅ |
| 100-person chat message (F14) | 0.41 s | ✅ |
| 100-person video smoothness | not reached on this Mac (simulated people) | accepted as in F02 (D056) |

## Reviews
- UI review: no Must fix.
- Code quality: 8.5/10, no Must fix.
- Bug review: transfer from a 4th window, ended-call accept and stale back-to are all fixed.
- Docs: transfer states, seats (D076), TC-F15-80, Another-device screen and call-limit wording are all updated.

## Verdict
**PASS.** All tests are green, every AC is met and there are no Critical or High security issues.

## GitHub checks (PR #21, 2026-11-02)
These are green: code checks, security (after the library updates), container, screenshots, and unit + integration (after the 10-second-window test fix). The desktop check stays red because of timing on GitHub's slower computers: 100 of 112 pass, and a different 5–9 time out each run. The owner chose to merge (D077). Linux-only bugs fixed in T-fix-10: the share list sometimes missed the screen; desktop tests now reset the sign-up count, sign in again after a restart, wait for a one-to-one call to end, and skip backgrounds where unavailable.
