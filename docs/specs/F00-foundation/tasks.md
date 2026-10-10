---
feature: F00
title: Foundation
status: in-progress
updated: 2026-10-09
---

# F00 Foundation: Tasks (STEPS)

Small steps, done in order, on branch `feat/F00-foundation`. Each step is committed and pushed when its tests pass (D026). Tick `[x]` when done and verified.
The code-quality and secret checks come early (T2, T3), so every later step is checked as it is written.

- [x] **T1: Repository skeleton and tool versions.** `mise.toml` (Node 24, pnpm 10, Python 3.12), root `package.json` with `packageManager`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.dockerignore`, `packages/config` (shared tsconfig, Prettier), `tools/preflight.mjs`, `tools/check-structure.ts` (first version). Verify that containers can reach the Mac via `host.docker.internal`.
  Covers: AC-F00-36, 37. Tests: TC-F00-78, 79. Check: `mise install && pnpm install` works; a fake Node 20 is refused with the expected message.

- [x] **T2: Code-quality tooling.** ESLint flat config (typescript-eslint strict, sonarjs, jsx-a11y, vitest, boundaries, i18next), custom rule `meetapp/no-raw-color`, hard limits from code-quality.md, Prettier, dependency-cruiser (backend layers), knip, jscpd, `pnpm check`. Rule fixtures go in `tests/fixtures/`. The Claude after-edit hook becomes active.
  Covers: AC-F00-15, 16, 27, 28, 29, 30. Tests: TC-F00-36, 37, 38, 62, 63, 64, 65, 66. Check: each fixture fails with the rule, file and line; clean code passes.

- [x] **T3: Commit safety.** husky + lint-staged; pre-commit runs `gitleaks git --staged` from the Docker image (fails closed without Docker); exclusion limited to `tests/fixtures`.
  Covers: AC-F00-18. Tests: TC-F00-42, 43, 44. Check: a staged fake key is blocked, naming file and line.

- [x] **T4: Local services.** `infra/docker-compose.yml` (LiveKit, Postgres+pgvector, Redis with AOF, RustFS file storage (replaces MinIO, D035) with automatic bucket creation, Mailpit), all ports on 127.0.0.1, named volumes, health checks; `infra/livekit.yaml`; `.env.example` with every setting documented.
  Covers: AC-F00-06, 23, 35, 40. Tests: TC-F00-12, 13, 55, 56, 82. Check: `docker compose up --wait` is healthy; a LAN-address connection is refused; data survives `down`/`up`.

- [x] **T5: The start command. (milestone)** `tools/dev.ts`: Docker missing/off checks, port checks that ignore our own containers, `.env` copy, `compose up --wait`, Turborepo dev, address table.
  Covers: AC-F00-01. Tests: TC-F00-02, 03, 04, 05, 06. Check: every failure message appears within 10 s; a second run works.

- [ ] **T6: Database package.** `packages/db` with Drizzle, the `feature_flags` table, migrations, `pnpm seed` / `seed:clear`, `pnpm flag <key> on|off` with input validation.
  Covers: AC-F00-04, 34 (owner control), 45. Tests: TC-F00-10, 75, 91. Check: empty DB → migrated; seeding twice makes no duplicates; bad flag input is rejected.

- [ ] **T7: API core.** `apps/api` server on 127.0.0.1:3000; Zod config validation; requestId; standard error handler; pino with redaction and email masking; strict CORS; `/docs` and `/docs/json` in development only (from `packages/contracts`); a test-only error route (registered only in test mode).
  Covers: AC-F00-05, 20, 21. Tests: TC-F00-11, 49, 50, 51, 52, 57. Check: a missing setting exits naming it; the 500 body and logs carry no secrets or personal data.

- [ ] **T8: Health and providers.** Providers for Postgres (pool error handling), Redis (fast-fail), LiveKit, storage (S3 → RustFS), email (Mailpit); `GET /api/v1/health` with 1.5 s timeouts; `pnpm storage:test`, `pnpm email:test`.
  Covers: AC-F00-02, 07, 35, 38. Tests: TC-F00-07, 08, 14, 15, 76, 80. Check: stop/start Postgres and Redis → `down` within 5 s, `ok` within 10 s, same process ID.

- [ ] **T9: Flags API and observability.** `GET /api/v1/flags` (10 s cache), `GET /metrics`, OpenTelemetry traces + logs over OTLP (optional), `@sentry/node` only with `SENTRY_DSN` and a stripping `beforeSend`.
  Covers: AC-F00-22, 34, 43 (backend side). Tests: TC-F00-53, 54, 73. Check: the API runs with no Sentry or OTel; flag changes appear within the cache window.

- [ ] **T10: Design tokens.** `packages/design-tokens`: `tokens.json` copied from the approved design system (SHA-256 recorded in its README), build to `tokens.css`, `tokens.ts` and the Tailwind v4 token-only theme; contrast test matrix.
  Covers: AC-F00-10 (token side), 11, 12. Tests: TC-F00-22, 23, 24, 25, 26. Check: generated CSS equals tokens.json; a deliberately bad color fails, naming the pair, theme and accent.
  Also (carried over from T2): the "palette reset" part of TC-F00-37 (a build using `bg-blue-500` produces no blue CSS); extend `meetapp/no-raw-color` to CSS named colors (`"red"`, `fill="white"`) in style objects and color attributes, keeping `currentColor`, `transparent` and `inherit`.

- [ ] **T11: UI package and the first atoms.** `packages/ui` + Storybook (theme/accent toolbar, pseudo-states, a11y addon, Tailwind); atoms Icon (Lucide, mapped names), Button, IconButton, Spinner, Tooltip, each with stories, tests and an index (via `/new-component`).
  Covers: AC-F00-13, 14. Tests: TC-F00-27, 32, 33, 34 (these atoms). Check: keyboard tests pass; stories cover every state.

- [ ] **T12: Remaining atoms and Settings molecules.** Input, Toggle, Avatar, Badge; molecules SegmentedControl and AccentPicker.
  Covers: AC-F00-13, 14. Tests: TC-F00-27, 32, 34 (these components). Check: same as T11.

- [ ] **T13: Visual and accessibility pipeline. (milestone)** Playwright over the built Storybook in light and dark: screenshots (`toHaveScreenshot`) plus axe; baselines made in the pinned Playwright image (`linux/amd64`); `pnpm test:visual:update`; diff report.
  Covers: AC-F00-13, 14, 33. Tests: TC-F00-28, 35, 71. Check: a changed padding fails with a before/after diff; zero a11y violations.

- [ ] **T14: Renderer app.** `apps/web`: React 19 + Tailwind + i18next (`en.json`); bundled fonts; starter home screen (wordmark, welcome, Settings button); Appearance panel; appearance store applied before first render; `useFlag` (15 s, unknown or failed = off).
  Covers: AC-F00-08, 10, 13b, 34. Tests: TC-F00-16, 17, 18, 20, 21, 72, 74. Check: theme and accent switch instantly and survive reload; corrupted saved values fall back to defaults.
  Also (carried over from the T2 review): the "every `t()` key exists in `en.json`" part of TC-F00-38; point the ESLint TypeScript resolver and dependency-cruiser at the apps' `tsconfig.json` (path aliases) and add an alias-import fixture; a dependency-cruiser rule that only pages and page hooks may use `features/` and the API client (frontend.md rule 2).

- [ ] **T15: Desktop app. (milestone)** `apps/desktop` with electron-vite: sandbox, context isolation, CSP, permission denial, navigation/new-window blocking, `app://meetapp` scheme, CJS preload, Sentry for Electron (optional). Playwright Electron e2e suite.
  Covers: AC-F00-03, 08, 09, 13b, 22, 24. Tests: TC-F00-09, 19, 30, 31, 58, 59, 60, 61. Check: the window opens within 5 s; security assertions pass; fonts work offline with no Google requests.

- [ ] **T16: The test command.** `pnpm test`: starts the test services (clear message without Docker), one root Vitest run with merged coverage and 80% thresholds on the business-logic folders, then the Electron e2e.
  Covers: AC-F00-17. Tests: TC-F00-39, 40, 41. Check: a fixture project under 80% fails.
  Also (carried over from T4): fold `pnpm test:integration` (infra/*.integration.test.ts: LAN refusal, data survives restart) into `pnpm test`.

- [ ] **T17: Licenses and dependency updates.** `tools/check-licenses.ts` (SPDX parsing, allowlist with reasons) and `.github/dependabot.yml` (grouped, weekly).
  Covers: AC-F00-31, 32. Tests: TC-F00-67, 68, 69, 70 (TC-70 confirmed one week after the first push). Check: fake GPL fails; `MIT OR GPL-3.0` passes.

- [ ] **T18: API container.** Multi-stage `apps/api/Dockerfile` (`node:24-slim`, `pnpm deploy`, non-root, Node-based HEALTHCHECK, no `.env`).
  Covers: AC-F00-39. Tests: TC-F00-81. Check: the image is healthy, `id -u` ≠ 0, gitleaks finds nothing in the exported image.

- [ ] **T19: CI on GitHub. (milestone)** `ci.yml` (check, test, e2e with the AppArmor fix, ui, security incl. Semgrep and the gitleaks CLI, container; on PR and on push to main; cancel-in-progress; "Do not merge" comment on failure) and `nightly-windows.yml` (skips when main hasn't changed).
  Covers: AC-F00-19, plus CI coverage of 17, 31, 33, 39. Tests: TC-F00-45, 46, 47, 48. Check: a test PR shows every check; a deliberately failing check marks the PR failing and posts the warning.

- [ ] **T20: Monitoring. (milestone)** `--profile monitoring`: Gatus (all services, 30 s, threshold 2, resolved alerts), Prometheus + exporters + cAdvisor via Alloy, Loki, Tempo, Grafana (provisioned "MeetApp overview" dashboard and alert rules), `tools/notifier.ts` (macOS notification), `pnpm monitoring`.
  Covers: AC-F00-41, 42, 43, 44. Tests: TC-F00-84, 85, 86, 87, 88, 89, 90. Check: stopping Redis → red within 60 s, "down" email in 60–120 s, "recovered" after restart; a 20 s blip sends nothing.

- [ ] **T21: Documentation and final checks. (milestone)** `docs/getting-started.md`, `docs/runbooks/local-services.md`, a README and a CLAUDE.md for every app and package, real commands in the root CLAUDE.md, final structure check. Then the manual checks with the owner.
  Covers: AC-F00-01, 25, 26, 36, 40, plus the owner's look check for 13. Tests: TC-F00-77, 93 (automated); TC-F00-01, 29, 83, 92 (manual, recorded in verification.md). Check: the owner runs `pnpm dev` from the guide and reviews the gallery.
  Also (found at the T5 milestone): getting-started must include turning mise on in the terminal (`eval "$(mise activate zsh)"` as the last line of `~/.zshrc`), otherwise `pnpm dev` runs on the Mac's default Node and preflight stops it.

## Coverage check
All 93 test cases are assigned:
- T1: 78–79
- T2: 36–38, 62–66
- T3: 42–44
- T4: 12–13, 55–56, 82
- T5: 02–06
- T6: 10, 75, 91
- T7: 11, 49–52, 57
- T8: 07–08, 14–15, 76, 80
- T9: 53–54, 73
- T10: 22–26
- T11/T12: 27, 32–34
- T13: 28, 35, 71
- T14: 16–18, 20–21, 72, 74
- T15: 09, 19, 30–31, 58–61
- T16: 39–41
- T17: 67–70
- T18: 81
- T19: 45–48
- T20: 84–90
- T21: 01, 29, 77, 83, 92, 93
