---
feature: F00
title: Foundation
status: approved
updated: 2026-10-09
---

# F00 Foundation: Design (HOW)

## Summary (plain English)
We set up one code repository with the desktop app, the backend and the shared design pieces. A single command, `pnpm dev`, checks your computer:
- the right versions are installed
- Docker is running
- the ports are free

It then starts the local services in Docker (call server, database, cache, file storage, fake inbox), the backend, and the desktop app window.

The look comes straight from the approved design system: its token file is copied into the code, and the colors, fonts, atoms and the two Settings molecules are rebuilt as real React components with a Storybook gallery.

Automatic checks run at three moments:
- after every edit (Claude hook)
- before every commit (secrets, formatting)
- on every Pull Request (GitHub Actions: tests, code quality, security, licenses, screenshots)

An optional monitoring stack shows a green/red status page, dashboards, logs and traces, and sends alerts when something is down. Everything is free and runs only on your Mac.

## 1. What gets created
Following `docs/engineering/project-structure.md`. Only the parts F00 needs:
```
mise.toml  package.json ("packageManager": "pnpm@10.x")  pnpm-workspace.yaml  turbo.json
eslint.config.js (re-exports packages/config)  .prettierrc  .env.example  .gitignore  .dockerignore
.github/workflows/ci.yml, nightly-windows.yml   .github/dependabot.yml
infra/docker-compose.yml   infra/livekit.yaml   infra/monitoring/{gatus,prometheus,alloy,loki,tempo,grafana}/…
tools/preflight.mjs  tools/check-secrets.mjs  tools/dev.ts  tools/check-licenses.ts  tools/notifier.ts  tools/flag.ts  tools/check-structure.ts
apps/desktop   (Electron main + preload)
apps/web       (React renderer: starter home screen + Settings panel)
apps/api       (Fastify backend: health, flags, docs, metrics, errors)
packages/design-tokens  packages/ui  packages/contracts  packages/db  packages/core  packages/config
tests/e2e  tests/fixtures (lint/secret/license fixtures, excluded from real scans)
docs/getting-started.md  docs/runbooks/local-services.md  + README.md and CLAUDE.md in every app/package
```

## 2. Tool versions (AC-F00-37)
- `mise.toml` pins **Node 24 LTS**, **pnpm 10**, **Python 3.12** (Python is unused in F00 but pinned now). CI installs the same versions with `jdx/mise-action`.
- `pnpm dev` first runs **`tools/preflight.mjs`**, written in plain JavaScript so it runs on any Node. It checks the Node and pnpm major versions and prints "Expected Node 24, found 20. Run `mise install`". Only then does it start `tools/dev.ts`.
- Library versions are the latest stable at build time, locked in `pnpm-lock.yaml`.

## 3. Local services (`infra/docker-compose.yml`)
Every image is pinned by version **and digest**, and every setting comes from `.env` (the compose file fails with "set in .env" if one is missing). **Every published port is bound to `127.0.0.1`** (e.g. `"127.0.0.1:5432:5432"`), including the monitoring ports, so other devices on the Wi-Fi can't connect (AC-F00-23). Named volumes keep data across restarts (AC-F00-40). Each service has a Docker health check, and `up --wait` waits for them.

| Service | Image (exact tag pinned) | Port(s) | Notes |
|---|---|---|---|
| LiveKit | livekit/livekit-server | 7880, 7881, 7882/udp | dev keys from `.env`; `--node-ip 127.0.0.1`; `prometheus_port` enabled |
| PostgreSQL + pgvector | pgvector/pgvector (pg17) | 5432 | volume `pgdata` |
| Redis | redis 7 | 6379 | `appendonly yes`; volume `redisdata` |
| File storage (**RustFS**, replaces MinIO, D035) | rustfs/rustfs, exact version + digest | 9000, 9001 | service name `storage`; volume `storagedata`; its health check also creates bucket `meetapp-dev` if missing, so "healthy" means the bucket is ready; web file browser on 9001 |
| Mailpit | axllent/mailpit | 1025 (SMTP), 8025 (inbox) | AC-F00-35 |

**Monitoring profile** (`pnpm monitoring` → `docker compose --profile monitoring up -d --wait`):

| Service | Port | Purpose |
|---|---|---|
| **Gatus** | 8080 | Status page (D030). Checks every 30 s, `failure-threshold: 2`, `send-on-resolved: true`: backend `/api/v1/health`, Postgres TCP, Redis TCP, LiveKit HTTP 7880, storage `/health`, Mailpit `/livez` |
| Prometheus | 9090 | Scrapes the API `/metrics`, postgres-exporter, redis-exporter, LiveKit, storage (RustFS), Alloy's cAdvisor (CPU/memory per container) |
| **Grafana Alloy** | 4318 (OTLP), 12345 | Receives the API's **traces and logs** over OTLP and forwards logs to Loki and traces to Tempo. Also collects container logs from the Docker socket, and runs `prometheus.exporter.cadvisor` |
| Loki | internal | Log storage |
| Tempo | internal | Trace storage |
| Grafana | 3001 | "MeetApp overview" dashboard + alert rules, provisioned from `infra/monitoring/grafana/` |

- Containers reach the API and notifier on the Mac via `host.docker.internal` (works on Docker Desktop and OrbStack; task T1 verifies it).
- **Alerts (AC-F00-44):** Gatus sends "down" (after 2 failed checks ≈ 60–90 s) and "recovered" alerts to email (Mailpit SMTP) and to the local webhook `tools/notifier.ts`. The notifier runs during `pnpm dev`/`pnpm monitoring` and shows a macOS notification via `osascript`; macOS asks once to allow notifications.
- **Grafana alerts:** "error spike" fires when 5xx > 5% of requests over 5 min; "disk nearly full" fires when Docker disk > 85%. Both go to the same email and webhook.

## 4. Commands
**`pnpm dev`** (`preflight.mjs` → `dev.ts`):
1. Check versions (above).
2. Check Docker:
   - if the `docker` command is missing: "Docker isn't installed. See docs/getting-started.md."
   - if `docker info` fails within 3 s: "Docker isn't running. Open Docker Desktop and try again."
3. If `.env` is missing, copy it from `.env.example` and say so (done before the port check, because the ports are read from `.env`).
4. Check that ports **3000, 5173, 5432, 6379, 7880, 7881, 7882/udp, 9000, 9001, 1025, 8025** (or the values set in `.env`) are free. A port counts as taken if something answers on it or it can't be opened, which also catches programs listening on all addresses. All taken ports are listed at once. Ports already held by this project's own containers (`docker compose ps`) are ignored. If one is taken: "Port 5432 is in use by another program (probably a local PostgreSQL). Stop it or change POSTGRES_PORT in .env."
5. `docker compose up -d --wait`.
6. Turborepo (`pnpm dev:apps`, with the shell's settings passed through so `.env` values can be overridden) runs `api` and `desktop` in parallel with hot reload. electron-vite serves the renderer, and the API runs migrations on startup.
7. Print a table of addresses (AC-F00-01). Until the apps exist (T7, T14, T15) it says so and exits after starting the services.

**`pnpm dev:stop`** stops the services and keeps all data.

Steps 1–4 fail within 10 s.

**Other commands:**
- `pnpm test`: starts the test services, or fails with the Docker message, then runs all Vitest projects (unit + integration, one merged coverage report) and the Playwright Electron e2e
- `pnpm check`: build, lint, typecheck, dependency-cruiser, knip, jscpd, licenses, structure
- `pnpm storybook`: `--host 127.0.0.1`
- `pnpm monitoring`
- `pnpm seed`, `pnpm seed:clear`
- `pnpm flag <key> on|off`: how the owner turns a feature on or off
- `pnpm email:test`
- `pnpm build`

## 5. Desktop app (`apps/desktop`)
- Built with **electron-vite**: main (ESM), **preload built as CommonJS** (required for sandboxed preloads), and the renderer (`apps/web`).
- **Security (AC-F00-24):**
  - `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `webSecurity: true`, `webviewTag: false`
  - `session.setPermissionRequestHandler` denies every permission (camera/mic come in F02)
  - `will-navigate` and `setWindowOpenHandler` block any address outside the app; `shell.openExternal` only for `https:` URLs
  - **CSP (production):** `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' http://127.0.0.1:3000; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. In dev, the Vite HMR websocket and `'unsafe-inline'` styles are added.
  - the preload exposes only `window.meetapp.platform`
- The built app serves the renderer from a custom **`app://meetapp`** scheme, so its origin is stable and the saved theme isn't lost (AC-F00-08). In dev, Vite runs at `127.0.0.1:5173` with `strictPort`.
- The window shows within 5 s in dev (AC-F00-03, measured in e2e).
- **Sentry for Electron** starts only if `SENTRY_DSN` is set, with `sendDefaultPii: false` (AC-F00-22).

## 6. Renderer (`apps/web`) for F00
- React 19 + Vite + TypeScript + Tailwind v4 (`@tailwindcss/vite`); i18next with `locales/en.json`.
- **Starter home screen:** placeholder "MeetApp" wordmark, welcome line, **Settings** button. Settings opens the Appearance panel with the **SegmentedControl** (theme) and **AccentPicker** molecules, as in the approved Settings design.
- **Theme and accent state** (Zustand in `features/appearance/`):
  - saved in `localStorage` (on the device until F01)
  - the default accent is `sky`; each accent's `on-accent` token supplies button text, which is dark on light accents (AC-F00-10)
  - applied as `data-theme` / `data-accent` on `<html>` **in the first import of the renderer entry, before React renders**, so the wrong theme never flashes (the CSP blocks inline scripts)
  - "System" follows `prefers-color-scheme`, which Electron keeps in sync with macOS (AC-F00-09)
- **Feature flags:** `useFlag("key")` re-fetches `GET /api/v1/flags` every **15 s**. An unknown key or a failed fetch means **off** (AC-F00-34).

## 7. Design tokens (`packages/design-tokens`)
- `tokens.json` is **copied unchanged** from the approved design system (AC-F00-12). This package is where the generated tokens live (`frontend.md` updated to match).
- The `build` script generates:
  - `tokens.css`: light on `:root`, dark on `[data-theme="dark"]`, accent overrides on `[data-accent]`
  - `tokens.ts`: typed names
  - the **Tailwind v4 theme** (`theme.css`): `@theme inline reference { --color-*: initial; --color-surface: var(--surface); …; --radius-full: var(--radius-full) … }`. `reference` stops Tailwind writing its own copies of our variables (with the same names, e.g. `--shadow-1`, they would overwrite ours). The `accent-<name>` tokens are left out: components use only the accent aliases. `--spacing` is `space-1` (4px), so `p-4` equals `space-4`. Output goes to `dist/` (not committed); the build refuses to run when the contrast check fails. The `initial` reset **removes Tailwind's built-in palette**, so a class like `bg-blue-500` can't work at all (AC-F00-15), while themes still switch at runtime.
- **Contrast test (AC-F00-11),** for 8 accents × 2 themes:
  - `on-accent` on `accent`: 4.5:1
  - `accent-text` on `bg`, `surface`, `surface-sunken` and `accent-soft`: 4.5:1
  - `ink`, `ink-muted`, `ink-subtle` on every surface: 4.5:1
  - `focus-ring` and `line-strong` on every surface: 3:1
  - status colors on surfaces and their `-soft` backgrounds: 4.5:1
  - it fails naming the token pair, theme and accent
- Fonts come from `@fontsource/figtree` and `@fontsource/jetbrains-mono`, bundled (AC-F00-13b); added with the app in T14.
- `meetapp/no-raw-color` also catches CSS named colors (`"red"`, `fill="white"`) in style objects and color attributes; `currentColor`, `transparent` and `inherit` stay allowed.

## 8. UI components (`packages/ui`)
- **Atoms:** Button, IconButton, Icon, Input, Avatar, Badge, Spinner, Tooltip, Toggle.
- **Molecules (for the Settings panel):** SegmentedControl, AccentPicker.
- Same props and behavior as the design system's components; Tailwind token classes only.
- Tooltip and Toggle use Radix primitives. Icons are **Lucide**, mapped to the design system's icon names.
- Each component has `X.tsx`, `X.stories.tsx`, `X.test.tsx` and `index.ts`, created with `/new-component`.
- **Details settled in T11:** sizes follow the design system's component styles exactly; spacing uses the 4px scale (`size-8.5` = 34px), and the few component font sizes that are not text-style tokens (11–15px) are copied from the design system's component CSS. The Tooltip shows at once on hover or focus with a 120 ms fade (as in the design system) and each Tooltip carries its own Radix provider. A loading Button must have a `loadingLabel`. The Spinner's label is real, visually hidden text inside a `role="status"` live region, so it is announced. Fonts are bundled from `@fontsource-variable` (every weight the design uses) under the exact names in tokens.json. `eslint-plugin-react-hooks` checks React code; the translation rule is off only for stories and tests (sample content).
- **Details settled in T12:** looks and sizes are copied from the design system's component CSS. Three behavior changes from the design system's sample code, because our components may not contain their own English text and must follow the standard keyboard patterns:
  - **Avatar** takes a translated `speakingLabel` (required while `speaking`, like Button's `loadingLabel`) instead of adding the English word "speaking".
  - **AccentPicker** takes a translated group `label` and `labels` (one color name per accent) instead of built-in English names. Each swatch shows its own color through the `--accent-<name>` tokens. The thin swatch edge (black at 8% in the design system) uses the `ink` token at 8%, because raw colors are not allowed.
  - **SegmentedControl and AccentPicker** are real radio groups (WAI-ARIA pattern, shared in `lib/useRadioGroup.ts`): Tab enters the group once, on the chosen option, and the arrow keys, Home and End move to another option and choose it. In the design system's sample every option was a separate Tab stop.
  - Input requires `id` and a name: a visible `label`, or `aria-label` for an obvious field such as search (a missing name is a type error). Its error replaces the hint, marks the field invalid, and keeps the red border while focused. Toggle uses `@radix-ui/react-switch`.
  - Right-to-left ready (Urdu/Arabic): start/end spacing instead of left/right, the Toggle thumb slides the other way, and in a radio group ArrowLeft moves forward. Arrow keys held with Alt, Ctrl or Cmd are left to the browser.
  - SegmentedControl and AccentPicker have no disabled state (none in the design system). Avatar's ring around a camera-off video tile (stage color) is added with the VideoTile organism (F02).
- **Storybook (AC-F00-13, 14):**
  - stories for every state; a toolbar switch for theme and accent
  - `storybook-addon-pseudo-states` for hover and focus
  - the a11y addon
  - `@tailwindcss/vite` in `viteFinal`
- **Keyboard tests** (`X.test.tsx`, Testing Library `user-event`): Tab reaches the interactive atoms, Enter/Space activate them, Escape closes the Tooltip, and the non-interactive atoms are not in the Tab order.
- **Visual + a11y run (AC-F00-13, 14, 33):**
  - Playwright opens every story in the built Storybook, in **light and dark**
  - it compares screenshots (`toHaveScreenshot`) and runs **axe** (`@axe-core/playwright`); any violation fails
  - baselines are generated only in the pinned `mcr.microsoft.com/playwright` image on `linux/amd64` (locally via `pnpm test:visual:update`, or a CI `workflow_dispatch` job), so they match CI
  - on failure, the Playwright HTML report with before/after diffs is uploaded
  - **Details settled in T13:** the run lives in `tests/e2e/gallery/` (config, specs, a tiny built-in static server for `storybook-static`). Playwright and the image are pinned to the same exact version (1.63.0, `mcr.microsoft.com/playwright:v1.63.0-noble`); a unit test keeps them equal. `pnpm test:visual` builds Storybook on the Mac, then runs the tests in the image with the repository mounted at the same path (the test tools are plain JavaScript, so the Mac's `node_modules` work there); in CI it runs directly inside the image. Two projects, `light` and `dark`; one baseline per story and theme in `tests/e2e/gallery/__screenshots__/<theme>/<story>.png`, 800×600 full page, animations stopped, zero pixel difference allowed. A missing baseline fails (never created silently). A story counts as drawn when Storybook reaches its last step (`finished`, after play steps and animations); a crashed story fails. axe scans the whole page (tooltips sit outside the story box) with only the page-level rules off (`landmark-one-main`, `page-has-heading-one`, `region`), because landmarks belong to the app's screens. Two built-in proofs run every time: a Button with its padding changed must fail the comparison (TC-F00-71), and an IconButton with its name removed must produce an axe `button-name` failure (TC-F00-35).

## 9. Backend (`apps/api`)
Layers per `backend.md`: `modules/<area>/{routes,service,repository,schemas}`, plus `providers/`, `plugins/` and `config/`. Zod schemas live in `packages/contracts`.

- **Listening:** on `API_HOST` (default `127.0.0.1`) and `API_PORT` (default **3000**). The Dockerfile sets `API_HOST=0.0.0.0` only *inside* the container, and compose/CI publish it as `127.0.0.1:3000:3000` (AC-F00-23).
- **CORS:** `@fastify/cors` allows only the app's own origins (`app://meetapp`, `http://127.0.0.1:5173`).
- **Request ids:** every request gets a new UUID (an id sent by the caller is ignored), returned in the `x-request-id` header, the error body and every log line.
- **Startup order:** check settings → run migrations → listen. `SIGINT`/`SIGTERM` close the server cleanly.

| Endpoint | What it does |
|---|---|
| `GET /api/v1/health` | Checks database (`select 1`), Redis (`PING`), LiveKit (`listRooms`) and storage (`HeadBucket`) in parallel, 1.5 s timeout each. Returns 200 `{status:"ok", checks:{database:"ok", …}}` or 503 `{status:"degraded", …}` with `down` for each failing part (AC-F00-02). Schema in `packages/contracts`. |
| `GET /api/v1/flags` | `[{key, enabled}]` from `feature_flags`, server cache **10 s** (AC-F00-34). |
| `GET /metrics` | Prometheus metrics: requests, durations, errors, process CPU/memory, DB pool, Redis status. |
| `GET /docs`, `/docs/json` | Swagger UI + OpenAPI from `packages/contracts`. Registered **only when `NODE_ENV=development`**; returns 404 otherwise (AC-F00-21). |

- **Config (AC-F00-05):** `config.ts` validates `process.env` with Zod at startup. If anything is missing it prints the setting's name and "see .env.example", then exits with code 1. It never prints a setting's value. In development the API reads the root `.env` (`node --env-file-if-exists`); values already set in the shell win.
- **Logger masking:** besides `redact`, error messages and stacks are masked: email addresses and `password=…`/`token: …`-style values become `[email]`/`[redacted]`.
- **Errors (AC-F00-20):**
  - every request gets a `requestId`
  - unknown errors return `500 {error:{code:"INTERNAL_ERROR", message:"Something went wrong. Reference: <id>", requestId}}`, never a stack trace
  - the standard format in `backend.md` now includes `requestId`
- **Logging:**
  - pino JSON with `requestId` and `traceId`
  - `redact` removes authorization, cookie, password, token, secret, email, name, firstName, lastName and displayName fields, plus request bodies
  - an error serializer masks email-like strings inside messages, such as database errors (S10)
- **Traces and logs** go over OTLP to Alloy (`OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318`) when it is set (AC-F00-43). Without it the API runs normally.
- **Sentry (AC-F00-22, D036):** `@sentry/node` 11 starts only if `SENTRY_DSN` is set, from `src/instrumentation.ts` (loaded with `--import`). `dataCollection` has every category off (Sentry 11 replaced `sendDefaultPii`); it no longer sets up OpenTelemetry itself, so our own OTel runs alone. Its `beforeSend` also removes `request.data`, cookies, headers, query string and `user`. Only unexpected 500 errors are reported, tagged with the requestId.
- **Flags cache:** 10 s; requests arriving together after expiry share one database read.
- **Metrics labels:** the route pattern (e.g. `/api/v1/flags`), never the raw URL.
- **Reconnect (AC-F00-07):**
  - `pg` Pool with `pool.on('error', log)`, so stopping Postgres can't crash the API
  - ioredis with `maxRetriesPerRequest: 1` and `enableOfflineQueue: false`, so PING fails fast
  - both reconnect automatically
- **Service addresses:** `POSTGRES_HOST`, `REDIS_HOST`, `LIVEKIT_HOST`, `STORAGE_HOST`, `MAILPIT_HOST` (missing or empty = `127.0.0.1`), so the container in T18 can point at service names. `EMAIL_FROM` sets the sender.
- **Health check names:** `database`, `cache`, `callServer`, `storage`; each runs in parallel with its own 1.5 s limit (`modules/health/health.service.ts`). Providers are created in `server.ts` and passed to `buildApp`, so tests can use fakes.
- **Providers:**
  - **storage:** an S3 client on RustFS (R2 later, same code); `pnpm storage:test` and an integration test write and read an object (AC-F00-38)
  - **email:** nodemailer on Mailpit SMTP
  - **livekit:** server SDK
- **Container (AC-F00-39):**
  - `apps/api/Dockerfile`, multi-stage, on `node:24-slim`, using `pnpm deploy` with `inject-workspace-packages=true`
  - runs as the non-root `node` user
  - `.dockerignore` excludes `.env*`
  - `HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`

## 10. Data stored (`packages/db`, Drizzle)
| Table | Columns | Why |
|---|---|---|
| `feature_flags` | `id` (uuid, primary key), `key` (text, unique), `enabled` (bool, default false), `description` (text), `created_at`, `updated_at` | Turn features on and off without a restart (AC-F00-34) |

- Migrations run automatically when the API starts (AC-F00-04).
- `pnpm seed` adds sample flags (`home.welcome_banner` on, `labs.preview_features` off); seeding twice adds nothing. `pnpm seed:clear` removes only those. Users and a workspace join the seed in F01 (AC-F00-45).
- `pnpm flag <key> on|off` switches an existing flag; `pnpm flag list` shows all. Keys are lower-case words joined by `.`, `_` or `-` (max 64). Bad input is refused before the database is touched; an unknown key is an error, never silently created.
- Drivers: `drizzle-orm` 0.45 (stable) with the `pg` (node-postgres) driver, as section 9 specifies; migrations generated by `drizzle-kit` into `packages/db/migrations`.

## 11. Code-quality and safety tooling
| Check | Tool | ACs |
|---|---|---|
| Lint (limits, no `any`, no `console`, no `.only`/`.skip`, a11y) | ESLint flat config in `packages/config`, re-exported by root `eslint.config.js`: typescript-eslint strict, sonarjs, jsx-a11y, vitest plugin. ESLint and Prettier are **root** devDependencies, so the Claude hook finds them. **ESLint 9**, and lint tools use the TypeScript 6 compatibility package while `tsc` is TypeScript 7 (D034) | 27, 30 |
| Atomic levels + backend layers | `eslint-plugin-boundaries` (no importing a higher level) + **dependency-cruiser** (`.dependency-cruiser.cjs`: no higher level, no reaching into a sibling component's internal files, only through its `index.ts`; routes → service → repository; no circular imports) | 15, 28 |
| No raw colors | custom rule `meetapp/no-raw-color` (hex, rgb/hsl, palette classes) + the Tailwind palette reset | 15 |
| No hard-coded text | `eslint-plugin-i18next` (`no-literal-string` in JSX) | 16 |
| Unused code / duplication | **knip**, **jscpd** (3%) | 29 |
| Formatting | Prettier (code, JSON, YAML). Markdown is excluded so hand-made document layouts stay as written | 30 |
| Folder structure | `tools/check-structure.ts`: top folders match project-structure.md; every app/package has README.md + CLAUDE.md | 26, 36 |
| Licenses | `tools/check-licenses.ts` over `pnpm licenses list --json`. Parses SPDX expressions (`MIT OR GPL-3.0` passes) and blocks GPL, AGPL, LGPL, SSPL and unknown, except entries in `tools/license-allowlist.json`, each with a reason | 31 |
| Secrets before commit | husky pre-commit → `tools/check-secrets.mjs` (plain JavaScript so it runs on any Node) runs `gitleaks git --staged` from the gitleaks Docker image, pinned by version and digest, with the network off and the repo mounted read-only; then lint-staged. Settings in `.gitleaks.toml` (standard rules; only `tests/fixtures/` is excluded). If Docker is off, the commit fails: "Start Docker to run the secrets check" | 18 |
| Dependency updates | `.github/dependabot.yml`: npm, Docker, Actions; weekly; grouped into one PR per ecosystem | 32 |

## 12. CI (`.github/workflows`)
**`ci.yml`** runs on `pull_request` and on `push` to `main` only, with `concurrency: cancel-in-progress`. It runs on `ubuntu-latest`, installs tools with mise-action, and runs these jobs in parallel:
1. **check:** `pnpm install` (cached), `pnpm build`, lint, typecheck, dependency-cruiser, knip, jscpd, licenses, structure
2. **test:** `docker compose -f infra/docker-compose.yml up -d --wait postgres redis storage livekit`, the same file as on the Mac. Then Vitest from the root (`test.projects`, one merged report). Coverage thresholds of 80% on `apps/api/src/modules/**`, `apps/api/src/providers/**`, `packages/core/**`, `packages/design-tokens/src/**` and `apps/web/src/features/**`.
3. **e2e:** `sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0` (Ubuntu 24.04 needs this for Electron's sandbox, which stays **on**). Then the desktop build, and the Playwright Electron test under `xvfb`.
4. **ui:** Storybook build, then visual + axe run in the pinned Playwright image. Diff report uploaded on failure.
5. **security:** `pnpm audit --prod --audit-level high`, the gitleaks CLI image (not the action, which needs a license for organizations), Semgrep community rules.
6. **container:** start the same services, build and run the API image, call `/api/v1/health`, then check `id -u` ≠ 0 and that there's no `.env` in the image.

**`nightly-windows.yml`** runs daily, but exits immediately if `main` had no new commits in 24 h. Otherwise it runs install, typecheck, unit tests and the desktop build on `windows-latest`.

**Blocking merges on red (owner decision: stay free).** Claude never opens or recommends merging a PR with a red check. A failing run adds a "Do not merge" PR comment. Upgrading to GitHub Pro later adds a hard block.

## 13. Documentation
- `docs/getting-started.md`:
  - prerequisites: a Mac with a macOS version supported by current Docker Desktop (today 14+), Docker Desktop or OrbStack, and mise
  - steps: `mise install`, `pnpm install`, `pnpm dev`
  - first-time Docker image download; allowing notifications (AC-F00-25)
- Every app/package gets a README and a short CLAUDE.md. Root CLAUDE.md lists the real commands (AC-F00-26).
- `docs/runbooks/local-services.md` covers what to do when a service is red.

## Edge cases and errors
- Docker missing or off, or a port taken: a clear message within 10 s. A second `pnpm dev` while running is fine, because its own ports are ignored.
- `.env` missing: copied automatically. A required value missing: the API refuses to start, naming it.
- A service drops: health shows `down`, Gatus turns red and alerts, then everything recovers on its own.
- Sentry or OTel not configured: they stay off.
- Mac offline: fonts are bundled. Docker images must be downloaded once beforehand.

## Security and privacy
- Electron locked down: sandbox, CSP, permission denial, navigation blocking (S17).
- All ports on localhost only (AC-F00-23).
- Strict CORS.
- Logs and errors are redacted (S10, AC-F00-20).
- Secrets are blocked at commit (fails closed) and in CI (S7).
- Dependency, secret and code scans run on every PR (S19, S20).
- Docs pages only exist in development.
- Sentry is off by default and never receives personal data.
- Nothing is fetched from Google at runtime.

## Cost impact
**$0.** Rough CI budget on GitHub Free (2,000 min/month):

| Item | Minutes |
|---|---|
| Each PR run: about 6 parallel jobs × about 5 min | about 30 min |
| PRs per month (one per feature plus fixes and Dependabot) | about 30, so about 900 min |
| Windows nightly, only on days with changes: about 15 min × 2 (Windows counts double) × about 15 days | about 450 min |

That totals about **1,350 min/month**, under the 1,500-minute target. If it gets close, the visual job runs only when UI files change.

## Test approach
| AC | How it's tested | Level |
|---|---|---|
| 01, 25 | Timed manual run on the owner's Mac following getting-started; result recorded in verification.md. Failure paths (Docker off, port taken) are automated in dev-runner unit tests. | manual + unit |
| 02, 07 | Integration: health with all services up returns 200; stop Redis/Postgres → 503 `down` within 5 s; restart → `ok` within 10 s, with no API restart | integration |
| 03, 08, 09, 10 | Electron e2e: window within 5 s; theme and accent switch within 1 s and survive an app restart; `page.emulateMedia({colorScheme})` drives "System"; default sky with dark button text | e2e |
| 04 | Integration: an empty DB gets migrated on API start | integration |
| 05 | Unit: config with a missing variable exits 1 and names it | unit |
| 06 | Script: `.env.example` has no paid-account setting; getting-started lists only free accounts | unit |
| 11 | Unit: contrast matrix over tokens.json | unit |
| 12 | Unit: generated CSS matches tokens.json exactly; no color found outside design-tokens (grep check) | unit |
| 13, 14, 33 | Storybook visual + axe run (light and dark); keyboard tests per atom | ui + unit |
| 13b | e2e with the network blocked: `document.fonts.check('16px Figtree')` and `'16px "JetBrains Mono"'` are true | e2e |
| 15, 16, 27, 28, 29 | Lint fixtures: one fixture file breaks each rule; assert the check exits non-zero and names rule + file (+ line for 27) | unit |
| 17 | `pnpm test` exits non-zero when coverage < 80% (fixture project) | unit |
| 18 | A temp git repo stages a fake key; the pre-commit hook blocks it, naming file and line | integration |
| 19 | A CI dry-run on a test PR; each job is listed in the workflow and shows in the PR checks | CI |
| 20 | Integration: a forced error with a fake password and email → 500 body as specified; the log line has the requestId but no password or email | integration |
| 21 | Integration: `/docs/json` lists `/api/v1/health` in development; `/docs` returns 404 with `NODE_ENV=production` | integration |
| 22 | Unit: Sentry not initialized without `SENTRY_DSN`; `beforeSend` strips body, cookies, headers and user | unit |
| 23 | Script: every compose port is bound to 127.0.0.1; connecting to the Mac's network address is refused | integration |
| 24 | Electron e2e: read webPreferences in main; `window.open` and navigation to an outside address are blocked; permission requests are denied | e2e |
| 26, 36 | `tools/check-structure.ts` test | unit |
| 30 | Run the Claude hook script on a badly formatted fixture → exit 2 with the problem | unit |
| 31 | License checker with fake GPL and `MIT OR GPL-3.0` packages | unit |
| 32 | `dependabot.yml` schema check | unit |
| 34 | Integration + e2e: `pnpm flag x off` → the guarded element disappears within 30 s; unknown flag = off | integration + e2e |
| 35 | Integration: `pnpm email:test` → the message appears in the Mailpit API | integration |
| 37 | Unit: preflight with a fake Node 20 version prints the expected message | unit |
| 38 | Integration: write and read an object in storage (RustFS) | integration |
| 39 | CI container job: health OK, `id -u` ≠ 0, no `.env` | CI |
| 40 | Integration: `docker compose down` (no `-v`) then `up` → the flag row and the storage object still exist | integration |
| 41, 44 | Scripted monitoring check: stop Redis → Gatus API shows it down within 60 s, the "down" email arrives in Mailpit 60–120 s after the stop; restart → "recovered" email | integration |
| 42 | Scripted: Grafana API returns the "MeetApp overview" dashboard; its panels return data | integration |
| 43 | Scripted: a failing request's requestId finds Loki lines and a Tempo trace | integration |
| 45 | Integration: `pnpm seed` adds flags, `pnpm seed:clear` removes them | integration |

Detailed test cases go in `tests.md`.

## Decisions made here
- **D030** (accepted by the owner): Gatus instead of Uptime Kuma (configured from a file); Grafana Alloy as the collector; electron-vite; React 19; Tailwind v4 with a token-only theme; Lucide icons; fontsource fonts; gitleaks via Docker; Semgrep in CI; MinIO pinned to an exact release (its community images are no longer updated).
- **D035** (made in T4, owner informed): RustFS replaces MinIO for local file storage, because MinIO's free images were withdrawn. Same S3 API and ports.
