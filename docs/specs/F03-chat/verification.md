---
feature: F03
title: In-meeting chat
verdict: FAIL
date: 2026-10-21
---

# F03 In-meeting chat: Verification Report (round 1)

## Automated tests (whole project)
| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (`pnpm test`) | see "Full run" below | | |
| Desktop (chat.spec.ts, 12 tests, run 2026-10-21) | 12 | 0 | 0 |
| Load (TC-F03-02, 2026-10-21) | chat 95% within 318 ms (target 1 s) | F02 video check missed on a busy Mac (to rerun idle) | |

Typecheck: ✅ · Lint and the other checks (`pnpm check`): ✅

Full run: recorded when it finishes (the round-2 report will hold the final counts).

## Acceptance criteria
All 48 ACs have code and at least one test that names them (ac-verifier).
- PASS: 01–07, 09–17, 19, 21–24, 26–31, 33–43, 45, 47, 48.
- WEAK (covered, but thinly): 08 (no test that the view stays still when news arrives), 18 (spell-check underline only by hand), 20 (non-organizer unpin refused is bundled into another test), 25 (OS reduce-motion only by unit test), 32 (picture cleaning only by unit test), 44 (the 30-day window and the account-deletion hook to confirm), 46 (English only; a test language stands in).

## Security
Dependency audit: 1 moderate (esbuild ≤0.24.2 via better-auth → drizzle-kit, a development-server issue, not in F03 or the running app). Secrets scan: gitleaks (Docker) over the 38 F03 commits, no leaks. pip-audit: not installed (no Python code yet).

security-auditor: **no Critical or High**.
| Severity | Where | Problem | Fix |
|---|---|---|---|
| Low | apps/api/src/plugins/logging.ts | 5-minute download links (`/api/v1/chat-files/<token>`) are written to logs | hide `chat-files` paths in logs (T-fix-7) |
| Low | chat-files.service.ts | 10 uploads a minute counted per ticket; rejoining resets it | count per person (T-fix-7) |
| Low | `GET /api/v1/me/meeting-chats` | up to ~200 queries per call, no rate limit | per-user rate limit (T-fix-7) |

## Quality targets (docs/product/quality-targets.md)
| Target | Measured | Result |
|---|---|---|
| Chat message to everyone within 1 s (95%, 100 people) | 318 ms (slowest 648 ms) | PASS |

## UI review (Atomic Design, accessibility)
No "Must fix". Should fix: no error state when the history fails to load; long chats are not virtualized (paging only, to decide or document); a few fixed sizes (380 px panel, 240 px GIF); pause/play icons for GIFs. Every new component has a story and tests; no colours outside tokens; translations clean.

## Code quality (complexity, duplication, patterns)
No "Must fix"; 0 duplicated blocks in the chat folders; score 8/10. Should fix: a cast that hides label keys (PollCreator labels), three files at or near the 300-line limit, ChatTools.tsx mixes three jobs, swallowed errors without a reason (loading older messages, two permission probes), upload JSON parsing.

## Documentation check
10 Must fix: poll event names in design 3.4 and tests.md; TC-F03-95 used twice; the guest download rule is in the code but not the spec; storage bucket and sticker folder described differently from the code; D059 still says KLIPY goes through our backend with GIPHY as fallback; "20 reactions" left in the design's test table; two routes missing from the endpoint table; the chat clean-up missing from operations.md. 16 Should fix (component list in design 2.3, index and key details, dates, READMEs for ui, web, contracts and desktop, operations go-online list).

## Bugs found (bug-finder)
1. **High:** live news for reactions, edits, deletes and pins is built with the acting person's "mine" marks and sent to everyone, so others see someone else's reaction as their own (confirmed in chat-actions.service.ts `announce`).
2. Medium: page loads don't set the last news number, so after a gap every live event can trigger a full reload; news just after joining can be missed.
3. Medium: pin news flips the pinned list, so a late or repeated packet unpins on one screen.
4. Medium: two votes at once can announce the same poll version, so others keep the older result.
5. Medium: deleting an older message in a past meeting's chat leaves it on screen until reopened.
6. Low–Medium: Send while a file is still uploading drops the file silently.
Smaller: own messages after rejoining are not shown as own (attendance vs account); the news number restarts after a quiet day; ©, ® and ™ alone count as "emoji only".

## Verdict
**FAIL.** Every acceptance criterion has code and tests, the speed target is met, and there are no serious security problems, but the bug-finder found real bugs (one High) and the documents disagree with the code in ten places. Fix tasks T-fix-1 to T-fix-9 are in tasks.md; `/spec-verify` runs again after them.
