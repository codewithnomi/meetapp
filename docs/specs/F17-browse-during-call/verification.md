---
feature: F17
title: Browse during a call
verdict: PASS
date: 2026-11-20
---

# F17 Browse during a call: Verification Report

Run under D092 (owner, 2026-11-20): the Mac runs the quick tests, checks, screenshots and F17's own desktop window tests; the full desktop run is GitHub's Desktop app tests check on the Pull Request.

## Automated tests
| Suite | Passed | Failed | Notes |
|---|---|---|---|
| Unit + integration (vitest, whole project) | 2436 | 2 | `ring-job` T-fix-9 flaky (passes on rerun); `chats-status` TC-F04-39 fails on `main` too, no F17 code involved: follow-up |
| Desktop windows, F17's files (browse, links, switch, in-call) | 18 | 0 | TC-F17-39 now waits for the window to finish resizing (passed 3 of 3) |
| Screenshots (`pnpm test:visual`) | 736 | 2 | `molecules-statusmenu--open` light/dark: axe `aria-required-children` on F04's Radix menu, unchanged by F17: follow-up |
`pnpm check` (lint, formatting, types, architecture, unused code, duplication, structure, licenses): ✅ · `pnpm check:container`: ✅

## Acceptance criteria
All 21 (AC-F17-01 to AC-F17-21) PASS: ac-verifier review (2026-11-16) after T-fix-1..6, plus the desktop tests above (browse.spec.ts, links.spec.ts, switch.spec.ts) and the unit tests named in tests.md.

## Security
Dependency audit: 15 advisories (5 low, 10 moderate), none Critical/High, already a `/deps-update` follow-up. security-auditor: the High (calls surviving sign-out) was fixed by T-fix-1; nothing Critical/High open.

## Quality targets
AC-F17-15 / switching speed: 20 switches each under 1 s, the call never drops, no sound gap over 500 ms (TC-F17-38).

## UI review, code quality, docs
Reviewed 2026-11-16; Must-fix items done in T-fix-2..6. Fixes since: endless redraw on Join (memo on the hosted page), Ended screen after a call ends while full, a database connection error no longer stops the server, chat message box clear of the small call view at the smallest window.

## Follow-ups (not F17)
TC-F04-39 status expiry test; statusmenu axe warning; flaky desktop tests on a busy Mac (TC-F02-61, TC-F04-67 and others) to fix once (D092); `/deps-update`; the T0 GitHub desktop check (TC-F15-56, TC-F02-107).

## Verdict
**PASS.** During a call you can open any screen; the call keeps running in the small view at the bottom right, and one click brings it back.
