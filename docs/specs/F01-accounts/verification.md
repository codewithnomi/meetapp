---
feature: F01
title: Accounts & workspaces
verdict: PASS
date: 2026-10-13
---

# F01 Accounts & workspaces: Verification Report

## Automated tests (whole project)
Run on the owner's Mac, 2026-10-13, with the Mac kept awake (`caffeinate -dims`), after the review fixes below.

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (Vitest, 136 files) | 1327 | 0 | 10 todo (F00-era) |
| E2E desktop (Playwright Electron) | 31 / 31 | 0 | 0 |
| Component screenshots + accessibility, and the invitation page (`pnpm test:visual`) | 239 / 239 | 0 | 0 |

Coverage: statements 96.99%, lines 98.7% (rule: ≥ 80% ✅).
`pnpm check` ✅: typecheck, lint, formatting, architecture, unused code, duplication, structure, licenses. The Storybook build passes too.

## Acceptance criteria
Checked by the ac-verifier against code and tests (TC ids in `tests.md`).

| AC | Result | Evidence |
|---|---|---|
| 01–04 | PASS | TC-01…09 (sign-up integration, password rule, e2e) |
| 05 | PASS | TC-10…12, 14; the e2e test now asserts the home screen within 3 s of Sign in (added at verification) |
| 06 | PASS | TC-13, 35 |
| 07, 08 | PASS | TC-15, 17–23, 25 against a fake provider; **TC-24 (real Google/Microsoft keys) is an optional owner check, not done** |
| 09, 10 | PASS | TC-26…28 |
| 11, 12 | PASS | TC-29…32 |
| 13 | PASS | TC-33…36; at verification also: counted before checking (no racing past a limit) and a per-address wrong-password limit |
| 14, 15 | PASS | TC-37…40 |
| 16 | PASS | TC-41, 42 (10 switches, each < 1 s) |
| 17–20 | PASS | TC-43…54, 78 |
| 21–23 | PASS | TC-55…61 |
| 24 | PASS | TC-62 (e2e); at verification also a backend test of rename rules (`rename.integration.test.ts`) |
| 25, 26 | PASS | TC-63…69 |
| 27 | PASS | TC-70 |
| 28 | PASS | TC-71 (axe on every story and the invitation page), TC-72 keyboard-only e2e; ui-reviewer against the canvas; the Terms links are a recorded difference (D051) |
| 29, 30 | PASS | TC-73…75 |
| 31–33 | PASS | TC-76, 77, 79…83 (route, outsider and member sweeps; secrets in logs, traces, Sentry and at rest) |
| 34, 35 | PASS | TC-84…86 |

## Security
- **Dependency audit:** 1 moderate (esbuild dev server, reached only through better-auth → drizzle-kit; never run). Accepted.
- **Secrets scan:** gitleaks over all 27 F01 commits found no leaks.
- **security-auditor:** no Critical or High findings.

| Severity | Where | Problem | Status |
|---|---|---|---|
| Medium | sign-in rate limits | Better Auth's per-address limiter was off; the wrong-password check could be raced | **Fixed**: counted before checking, plus 100 wrong passwords per address per 15 min (D050); tests added |
| Medium | sign-up code tries | read-then-write counter could be raced | **Fixed**: one Redis INCR per try; test with 20 simultaneous guesses |
| Medium | desktop Google/Microsoft hand-off | can be phished with an attacker's start link | **Owner decision: fix before going online** (D051) |
| Medium (found in T18) | logs, traces, Sentry | invitation link secret written in full | **Fixed** in T18 |
| Low | session check, desktop token-route guard | %-encoded addresses | **Fixed** (registered route used; addresses decoded); tests added |
| Low | desktop cancel | anyone with the request id could cancel | **Fixed**: only with the verifier |
| Low | production settings | example secrets accepted | **Fixed**: refused in production |
| Low | hand-off `start` not atomic; invitation emails as spam; no `trustProxy` | — | Before going online (progress.md) |

## Quality targets (docs/product/quality-targets.md)
| Target | Measured | Result |
|---|---|---|
| Sign in → home (AC-05) | e2e, every run | < 3 s ✅ |
| Workspace switch (AC-16) | 10 switches per run | each < 1 s ✅ |
| Changes reach other windows (AC-12, 23, 24, 25) | e2e | within 1 minute ✅ |

## UI review (Atomic Design, accessibility)
Levels, imports, tokens and translations are clean. These "must fix" items were fixed:
- a failed join-link copy now shows a message;
- the Requests and Join screens no longer say "nothing here" while loading;
- the join-link section shows loading and error states;
- field errors are announced to screen readers.

Two items were not changed:
- **Sign out everywhere:** the screen always returns to Sign in, so an error message there could never be seen. This works as designed.
- **Terms and Privacy Policy:** plain text until the documents exist (D051).

Open "should" items:
- use the text-style tokens instead of a few fixed font sizes;
- build some sentences in one piece for future translations;
- add a few more Storybook states;
- add the new parts to the design-system artifact (also in progress.md).

## Code quality
Score 8/10, no "must fix" (code-quality-reviewer). Possible tidy-ups later:
- move the route recording out of `app.ts` into test support;
- share the manager-role constant;
- a helper for the account routes in `app.ts`.

## Documentation check
The docs-keeper's 22 corrections were made:
- code map;
- design: endpoints, errors, limits, D048/D049 marked accepted;
- decisions D050 and D051;
- privacy-legal: Google/Microsoft, waiting sign-ups;
- operations: background work;
- desktop and db READMEs;
- runbooks: ports, the missing-code row;
- route descriptions.

## Bugs found (bug-finder) and fixed
Fixed:
- a lost idempotency result could allow a second create;
- the personal-workspace repair could leave someone without a membership;
- a stale `/me` could cause a false "no longer a member";
- the request badge counted expired requests;
- leave answered success when nothing was removed;
- an invitation could be accepted just after it expired;
- the old workspace card stayed after a failed search;
- a stale error stayed after cancelling a confirmation;
- "Name saved." outlived further typing;
- photo uploads used the 10 s limit.

Left as they are (low):
- an existing member accepting an admin invitation keeps their role (matches AC-20, "nothing changes");
- the account look isn't retried after a failed save.

## Verdict
**PASS.** Every test passes and every acceptance criterion is met. There are no Critical or High security issues and no open "must fix" items, and the documents match the code.

Two items wait for later by the owner's choice (D051):
- the desktop sign-in phishing fix, before going online;
- real Terms and Privacy links.

The optional check with real Google/Microsoft keys (TC-F01-24) is the owner's to do whenever they like.
