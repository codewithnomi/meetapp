---
feature: F03
title: In-meeting chat
verdict: PASS
date: 2026-10-21
---

# F03 In-meeting chat: Verification Report (round 2)

Round 1 (same day) was **FAIL**: one High and five Medium bugs, three Low security items, and ten document mismatches. They were fixed in T-fix-1 to T-fix-10 (tasks.md). Round 2 re-ran everything and fixed the few small items it found (below).

## Automated tests (whole project)
| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (`pnpm test`, 243 files) | 1920 | 0 | 10 todo |
| Desktop, whole project (`pnpm test`) | 78 | 3 (see below) | 0 |
| Desktop, chat (`chat.spec.ts`, after the last fixes) | 13 | 0 | 0 |
| Chat backend tests (`apps/api/src/modules/chat`, after the last fixes) | 98 | 0 | 0 |
| Screenshots (`pnpm test:visual`, light and dark) | 529 | 0 | 0 |
| Backend container (`pnpm check:container`) | healthy, non-root, no secrets | | |

Typecheck, lint, architecture, unused code, duplication, structure, licenses (`pnpm check`): ✅

The 3 desktop failures in the full run (TC-F03-96, TC-F02-52, TC-F01-23) waited for something that came late while 80 desktop tests ran back to back; each passed when run again on its own (4/4). TC-F03-96 also showed a real detail, now fixed: messages still being sent each showed "You" and a time instead of joining the group.

Screenshots: 136 new F03 components got their first pictures; the others changed on purpose (full-height side panel, D061 reactions, new icons) and were looked at before saving (e.g. the meeting layout with the participants panel).

## Acceptance criteria
All 48 ACs have code and at least one test by ID (ac-verifier, round 2). Round 1's weak spots are closed: AC-08 (TC-F03-16, the view stays still), AC-13 (reactions per viewer), AC-20 (non-organizer unpin refused, TC-F03-35). Known, documented deferrals: AC-43 and AC-44 are built and tested; their triggers (meeting deletion, account deletion) arrive with F06/F10 (design.md "Account deletion and meeting deletion"). AC-18 (spell-check underline) and AC-25 (OS reduce-motion) are checked by unit tests plus the owner's look check. AC-46 uses a made-up test language until a second language exists.

## Security
Dependency audit: 1 moderate (esbuild ≤0.24.2 via better-auth → drizzle-kit; a development-server issue, not in F03 or the running app). Secrets: gitleaks over all F03 commits, no leaks; the container check found none. pip-audit: not installed (no Python yet).

security-auditor round 2: **PASS**, no issues of any level; round 1's three Lows are fixed (file links hidden in logs, per-person upload limit, rate limit on recent chats).

## Quality targets (docs/product/quality-targets.md)
| Target | Measured (2026-10-21) | Result |
|---|---|---|
| Chat message to everyone within 1 s (95%, 100 people) | 253 ms (round 1: 318 ms) | ✅ |
| Join under 3 s (95%) | 0.65 s | ✅ |
| Sound delay under 250 ms | 73 ms | ✅ |
| 25 people for 5 minutes under 700 MB | 616 MB | ✅ |
| Tiles show ≥ 90% of the frames they receive (F02) | 64% and 69% right after the screenshot run | not met on a busy Mac, as at F02's verification (73% and 63%); owner-accepted in D056, to re-check on an idle Mac before going online |

## UI review (Atomic Design, accessibility)
No "Must fix" in either round. Round 2 items fixed: comments moved back after a file split, a unique id for the link field, named timeout and reduced-motion helper, one import. Long chats load 50 messages at a time (no virtualization; written in frontend.md).

## Code quality (complexity, duplication, patterns)
No "Must fix"; 0 duplicated blocks; 8.5/10. Files at the 300-line limit were split (FormatBar, ChatPoll, chat-gifs, chat-labels, chat-view, chat-news).

## Documentation check
Round 1's 26 items and round 2's 11 items are fixed (design, tests, tasks, decisions, operations, security, READMEs, progress, INDEX). Messages, reactions, votes and uploads are limited per person in code and design alike.

## Bugs found
Round 1's bugs are all fixed and confirmed by the round-2 bug-finder. Round 2 found one Low (Edit and Delete offered on own messages from an earlier call of the meeting, which the server refuses), fixed by sending each message's call with it.

## Verdict
**PASS.** Every acceptance criterion is met and tested, the chat is fast with 100 people (253 ms), there are no security issues, and the documents match the code. The only missed number is F02's video smoothness on a busy Mac, already accepted by the owner in D056.
