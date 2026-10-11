---
feature: F00
title: Foundation
verdict: FAIL
date: 2026-10-11
---

# F00 Foundation: Verification Report

## Automated tests (whole project)
Run on the owner's Mac, 2026-10-10/11 (`pnpm test`, then a second full run).

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (Vitest, 71 files) | 877 | 0 | 9 todo |
| E2E desktop (Playwright Electron, 16) | 15 / 16 (run 1), 16 / 16 (run 2) | 1 (run 1: TC-F00-72, intermittent) | 0 |
| Monitoring checks (`pnpm test:monitoring`, 2026-10-10) | 15 | 0 | 0 |
| Component screenshots + accessibility (GitHub) | ✅ | | |

Coverage: statements 98.44%, lines 99.54% (rule: ≥ 80% per business-logic folder group ✅).
Typecheck ✅ · Lint ✅ · Formatting ✅ · Architecture (dependency-cruiser) ✅ · Unused code (knip) ✅ · Duplication (jscpd) ✅ · Structure ✅ · Licenses ✅ (800 packages) · Storybook build ✅.
GitHub checks on PR #3: all 6 green for the last three pushes.

**Problem:** TC-F00-72 (switching a flag hides the feature within 30 s) failed in one of the last two full runs and in several runs during T20/T21; it never fails when the desktop tests run alone (24/24, 75/75 repeated). Earlier GitHub runs showed the same family of symptoms (a window closing mid-test, `app.close()` hanging, "worker teardown timeout"). In the last failure the window showed the Settings page in Dark, the state an earlier test (TC-F00-16/17) leaves just before it closes its app. Most likely cause (bug review): test apps are not always fully closed between tests under load, and TC-F00-17 closes the app right after a setting change, before it is saved. → **T-fix-1**.

## Acceptance criteria
| AC | Result | Evidence |
|---|---|---|
| 01 | PASS | TC-F00-01 manual 2026-10-10: everything ready in **10 s** (limit 2 min), address table printed, owner saw the home screen. TC-02…06 (`tools/dev.test.ts`) |
| 02 | PASS | TC-07, 08, 14, 15 |
| 03 | PASS | TC-09 (e2e), TC-01 manual |
| 04 | PASS | TC-10 |
| 05 | PASS | TC-06, 11, 12 |
| 06 | PASS | TC-12, 13 |
| 07 | PASS | TC-14, 15 |
| 08 | PASS | TC-16, 17, 18 (e2e; affected by the same test-app cleanup issue, T-fix-1) |
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
| 19 | PASS | TC-45, 46 in code; TC-47, 48 proven on GitHub in T19 (PR #4 went red with the comment, PR #5 failed the security check; see progress.md) |
| 20 | PASS | TC-49, 50 |
| 21 | PASS | TC-51, 52 |
| 22 | PASS | TC-53, 54 |
| 23 | PASS | TC-55, 56, 57 |
| 24 | PASS | TC-58…61 |
| 25 | WEAK | TC-92 skipped by the owner (D042). A fresh clone installed and its screens loaded after the T21 fix; TC-93 checks every command the guide names |
| 26 | PASS | TC-77, 93 |
| 27–31 | PASS | TC-62…68 |
| 32 | WEAK | TC-69 in code; TC-70 (a real Dependabot PR) can only be seen a week after the settings reach `main` |
| 33 | PASS | TC-28, 71 |
| 34 | **FAIL (intermittent)** | TC-73, 74, 75 pass; TC-72 intermittent → T-fix-1 |
| 35 | PASS | TC-76 |
| 36 | PASS | TC-77 |
| 37 | PASS | TC-78, 79 |
| 38 | PASS | TC-80 |
| 39 | PASS | TC-81 (GitHub container check green) |
| 40 | WEAK | TC-82 (down/up) passes; TC-83 (real Mac restart) waits for the owner's next restart → T-fix-5 |
| 41 | PASS | TC-84, 85, 95 |
| 42 | PASS | TC-86, 94 |
| 43 | PASS | TC-87 |
| 44 | WEAK | TC-88, 89, 95, 96 pass; TC-90 (the Mac notification really appears) not yet seen by the owner → T-fix-5 |
| 45 | PASS | TC-91 |

## Security
Dependency audit (`pnpm audit --prod`): no known vulnerabilities · Secrets scan (gitleaks, whole history, 48 commits): no leaks · pip-audit: not needed (no Python code yet).
No Critical or High findings. To fix before F01 brings real accounts (→ **T-fix-2**):

| Severity | Where | Problem | Fix |
|---|---|---|---|
| Medium | `infra/docker-compose.yml` (alloy) | Alloy runs privileged with the Docker socket and the whole Docker disk: in effect full control of Docker. "Only MeetApp's containers" is a config filter, not a wall | Drop `privileged` and `/:/rootfs`; mount only what the disk alert needs; read-only Docker socket proxy |
| Medium | `infra/monitoring/alloy/config.alloy` (container logs) | Container logs reach Loki unredacted (e.g. Postgres `DETAIL: Key (email)=…`) | Masking/drop stage in Alloy; terse Postgres error logs; test |
| Medium | `apps/api/src/observability/telemetry.ts`, `plugins/logging.ts` | Query strings (`?token=`, `?code=`) reach traces and logs | Redact query parameters in traces; log the URL without its query |
| Low | Grafana / Prometheus / Alloy UI | No login and no Host check (DNS-rebinding risk) | Enforce domain 127.0.0.1 in Grafana; note the rest in D041 |
| Low | `tools/notifier.ts` | Any web page can show fake alerts (no Content-Type/Host check) | Require `application/json` and the expected Host |
| Low | `config.alloy` (postgres exporter) | Uses the database superuser | A `pg_monitor`-only role |
| Low | `instrumentation.ts` | `OTEL_EXPORTER_OTLP_ENDPOINT` not checked (plain http to another machine allowed) | Only 127.0.0.1/localhost or https |
| Low | `tools/dev-checks.ts` | `.env` readable by other Mac accounts | Set permissions to owner-only (0600) |

## Quality targets (docs/product/quality-targets.md)
| Target | Measured | Result |
|---|---|---|
| `pnpm dev` ready (AC-F00-01, ≤ 2 min) | 10 s | ✅ |
| Desktop window in dev (AC-F00-03, ≤ 5 s) | under 1 s in e2e (TC-F00-09) | ✅ |
| Desktop app start-up ≤ 3 s (packaged app) | not measured: packaging is F04 | n/a |

## UI review (Atomic Design, accessibility)
No Must fix. Follow-ups (Should fix, not blocking): IconButton hover not disabled-guarded; one Tooltip provider per tooltip; the Settings preview buttons are focusable but do nothing; flags have no loading/error state (record as an agreed F00 exception or add a status); skip link when the router arrives (F01).

## Code quality (complexity, duplication, patterns)
No Must fix; score 8/10. Follow-ups: one address-table helper instead of two; default ports written once; split `tools/dev-checks.ts` (273 lines, near the 300 limit); shutdown hooks injectable and failures logged; reuse `parseEnvFile` in the monitoring test support; fixed sleeps in the monitoring test.

## Documentation check
Up to date: specs, the setup guide, runbooks, every README/CLAUDE.md, `.env.example` keys, D041/D042. **Not up to date** (→ **T-fix-4**): operations.md (monitoring described as planned, not as built), project-structure.md (`packages/core` that doesn't exist, provider/plugin folders, getting-started missing), overview.md and infrastructure.md (monitoring and RustFS), design.md details (health checks, Alloy mounts, `pnpm storybook`, `pnpm check` contents, CI test job text), tasks.md T20 threshold text, the monitoring-check duration (12 vs 20 minutes) in five places, `.env.example` per-setting comments, a decision entry for the libraries chosen in F00, the privacy note on local logs (owner to confirm).

## Bugs found
- Backend stop can hang half-closed if closing throws (no try/finally, no backstop timer) → T-fix-3
- OpenTelemetry may be shut down twice; final flush not awaited on a natural exit → T-fix-3
- Grafana alert batches: one odd alert drops the whole call; no cap on alerts per call → T-fix-3
- `.env` additions ignore Windows line endings (minor) → T-fix-3
- Desktop test profiles are never deleted (462 leftover folders) → T-fix-1

## Verdict
**FAIL.** F00 works: every automated test except one passes, coverage is about 99%, all GitHub checks are green, security found nothing critical or high, and the owner confirmed the start-up and the component gallery. It is not "done" yet because (1) one desktop test fails now and then, and a test that sometimes fails can't be trusted to catch real problems, and (2) several older documents no longer describe what was built. Fix tasks T-fix-1 … T-fix-5 are in tasks.md; the three Medium security items are included so they are fixed before F01 adds real accounts.
