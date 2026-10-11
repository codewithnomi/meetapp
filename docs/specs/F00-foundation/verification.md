---
feature: F00
title: Foundation
verdict: PASS
date: 2026-10-11
---

# F00 Foundation: Verification Report

Second verification, after fix tasks T-fix-1 … T-fix-5. The first run (same day) was FAIL: one intermittent desktop test, out-of-date documents and three Medium security items. All are fixed; see the git history of this file for the first report.

## Automated tests (whole project)
Run on the owner's Mac, 2026-10-11, with the Mac kept awake (`caffeinate`).

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (Vitest, 73 files) | 916 | 0 | 9 todo |
| E2E desktop (Playwright Electron) | 16 / 16 | 0 | 0 |
| Monitoring checks (`pnpm test:monitoring`) | 22 / 22 (21 in the full run; TC-F00-50 live, re-run after its test and its masking rule were fixed) | 0 | 0 |
| Component screenshots + accessibility (GitHub) | ✅ | | |

The desktop tests passed in every full run since T-fix-1 (5 clean full runs during T-fix-1, then 16/16 in each of the last three).
Coverage: statements 98.44%, lines 99.54% (rule: ≥ 80% per business-logic folder group ✅).
Typecheck ✅ · Lint ✅ · Formatting ✅ · Architecture (dependency-cruiser) ✅ · Unused code (knip) ✅ · Duplication (jscpd) ✅ · Structure ✅ · Licenses ✅ (800 packages) · Storybook build ✅ (`pnpm check`).
GitHub checks on PR #3: see the Pull Request.

## Acceptance criteria
| AC | Result | Evidence |
|---|---|---|
| 01 | PASS | TC-F00-01 manual 2026-10-10: ready in **10 s** (limit 2 min), address table, owner saw the home screen. TC-02…06 |
| 02 | PASS | TC-07, 08, 14, 15 |
| 03 | PASS | TC-09 (e2e), TC-01 manual |
| 04 | PASS | TC-10 |
| 05 | PASS | TC-06 (now also: `.env` owner-only on every start), 11, 12 |
| 06 | PASS | TC-12, 13; fresh-copy install run in T21 |
| 07 | PASS | TC-14, 15 |
| 08 | PASS | TC-16, 17, 18 (e2e, stable since T-fix-1) |
| 09 | PASS | TC-19 |
| 10 | PASS | TC-18, 20, 21 |
| 11 | PASS | TC-22, 23 |
| 12 | PASS | TC-24, 25, 26 |
| 13 | PASS | TC-27, 28; TC-29 manual: owner says the gallery **matches** the design system |
| 13b | PASS | TC-30, 31 |
| 14 | PASS | TC-32…35 |
| 15 | PASS | TC-26, 36, 37 |
| 16 | PASS | TC-38 |
| 17 | PASS | TC-40, 41; coverage above |
| 18 | PASS | TC-42, 43, 44 |
| 19 | PASS | TC-45, 46; TC-47, 48 proven on GitHub in T19 |
| 20 | PASS | TC-49, 50: logs, web addresses (`?token=` …) and traces cleaned; a broken address no longer breaks logging; live check: a database error with a fake email and password reaches Loki masked |
| 21 | PASS | TC-51, 52 |
| 22 | PASS | TC-53, 54 (OTLP address only local or https) |
| 23 | PASS | TC-55, 56, 57 |
| 24 | PASS | TC-58…61 |
| 25 | WEAK | TC-92 skipped by the owner (D042); TC-93 and the T21 fresh-copy run cover the guide |
| 26 | PASS | TC-77, 93 |
| 27–31 | PASS | TC-62…68 |
| 32 | WEAK | TC-69 in code; TC-70 (a real Dependabot PR) can only be seen after the settings reach `main` |
| 33 | PASS | TC-28, 71 |
| 34 | PASS | TC-72…75; TC-72 was intermittent, root cause (test apps not fully closed between tests, a setting closed before it was saved) fixed in T-fix-1 |
| 35 | PASS | TC-76 |
| 36 | PASS | TC-77 |
| 37 | PASS | TC-78, 79 |
| 38 | PASS | TC-80 |
| 39 | PASS | TC-81 (GitHub container check) |
| 40 | WEAK | TC-82 (down/up keeps data) passes; TC-83 (real Mac restart) deferred by the owner (D044) |
| 41 | PASS | TC-84, 85, 95 |
| 42 | PASS | TC-86, 94 |
| 43 | PASS | TC-87 (incl. the last trace before a stop) |
| 44 | WEAK | TC-88, 89, 95, 96 pass; TC-90 (the Mac notification seen by the owner) deferred (D044) |
| 45 | PASS | TC-91 |

The four WEAK items are owner-accepted deferrals or need `main` first; each has automated coverage and is recorded (D042, D044).

## Security
Dependency audit (`pnpm audit --prod`): no known vulnerabilities · Secrets scan (gitleaks v8.30.1 via Docker, whole history, 52 commits): no leaks · pip-audit: not needed (no Python code yet).

All eight findings from the first audit are fixed or accepted with a written reason (D041: Alloy still reads the Docker and containerd sockets, needed for container numbers; local and optional only; revisit before anything runs online).

The re-audit found one **High** introduced by T-fix-2 and fixed in this verification (commit 0d0895a): a web address with a broken %-code (`/?%`) made the request log throw, so one request could stop the backend. Now logged as written, with a test.

Low items fixed in the same commit: JSON-style `"password":"x"` now masked (backend and Alloy); `.env` made owner-only on every start; monitoring-login errors never echo the password; D041 notes Prometheus and the Alloy page have no login (local only). **No Critical or High remains.**

Low, left as follow-ups: trace redaction compares names case-sensitively (`?Token=` reaches traces; logs ignore case); the `meetapp_monitor` login (pg_monitor) can see running query text (values are sent separately, so none appear).

## Quality targets (docs/product/quality-targets.md)
| Target | Measured | Result |
|---|---|---|
| `pnpm dev` ready (AC-F00-01, ≤ 2 min) | 10 s | ✅ |
| Desktop window in dev (AC-F00-03, ≤ 5 s) | under 1 s in e2e (TC-F00-09) | ✅ |
| Desktop app start-up ≤ 3 s (packaged app) | not measured: packaging is F04 | n/a |

## UI review (Atomic Design, accessibility)
No screen code changed since the first verification, so its result stands: no Must fix. Follow-ups (not blocking): IconButton hover not disabled-guarded; one Tooltip provider per tooltip; the Settings preview buttons are focusable but do nothing; flags have no loading/error state; skip link when the router arrives (F01).

## Code quality (complexity, duplication, patterns)
No Must fix; score 8.5/10. Fixed now: alert states in a `Map` (no built-in names). Follow-ups: split `tools/dev-checks.ts` (281 lines, limit 300) and `monitoring.monitoring.test.ts` (410 lines) before they grow; name the shutdown timeouts (10 s backstop must stay longer than the 5 s flush); a test reset for shutdown hooks; one error style in `monitoring-db.ts`; one address-table helper; default ports written once.

## Documentation check
Up to date after this verification's doc pass: design.md (notifier checks, monitoring login, OTLP rule, shutdown, web-address redaction, `.env` 0600, local-monitoring security points), tests.md (T-fix behaviour added to TC-06, 50, 53, 87, 95, 96; old wording removed), tasks.md, operations.md, privacy-legal.md, runbooks/monitoring.md, getting-started.md, project-structure.md, `.env.example` (OTLP rule), D041, D043 (all F00 libraries), vitest.config.ts comment. CLAUDE.md commands, READMEs, local-services and CI runbooks were already up to date.

## Bugs found
First run: all five fixed (backend stop, single telemetry shutdown, Grafana batches, Windows line endings, test profiles). Re-review: the broken-address crash (fixed, see Security), odd alert states (fixed), an unhandled error on a failed final telemetry send (fixed). Follow-ups (minor): more than 20 alerts in one Grafana call shows nothing (could show the first 20); the notifier's Host check is exact (no `[::1]`, case-sensitive); the 10 s backstop starts before the 5 s flush (fine today, tight if closing gets slower); an interrupted desktop test run leaves its profile folder.

## Verdict
**PASS.** Every automated test passes, every acceptance criterion is met (four WEAK items are owner-accepted deferrals or need `main` first), no Critical or High security issue remains, there are no Must-fix UI or code-quality items, and the documents match the code. Owner checks still to do when convenient (D044): TC-F00-83 (after a Mac restart) and TC-F00-90 (Mac notification).
