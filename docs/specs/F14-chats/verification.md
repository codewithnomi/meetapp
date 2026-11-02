---
feature: F14
title: Chats (one to one and groups)
verdict: PASS
date: 2026-11-01
---

# F14 Chats (one to one and groups): Verification Report (round 2)

Second verification, run together with F15's (D069); the whole-project results are in `docs/specs/F15-calls/verification.md`. The first run (FAIL) is in `verification-round1.md`.

- All tests green: check, container, Storybook, 2229 unit + integration, all desktop tests (F14 tests updated to the T-fix-4 headings and unread label), 651 screenshots.
- TC-F14-21 (watched for a 429 timing flake) passed.
- Load: a 250-person group meets its target, and a 100-person chat message shows in 0.41 s.
- Every AC is met. Security: no Critical or High. The owner approved the screenshots on 2026-10-29.

## Verdict
**PASS.**
