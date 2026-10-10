---
feature: F00
title: Foundation
status: approved
updated: 2026-10-10
---

# F00 Foundation: Test Cases

Written **before** the code. Each test case becomes an automated test, except those marked **manual** (recorded in `verification.md`).
Levels: unit · integration · e2e (real app flow, Playwright Electron or Playwright on Storybook) · security · performance · ci (runs in or inspects GitHub Actions) · manual.

Test names must include the TC and AC IDs, e.g. `TC-F00-07 [AC-F00-02] health returns 200 when all services are up`.

**Monitoring checks:** TC-F00-84 to 89 stop and start services and wait for alerts (about 20 minutes), so they run with `pnpm test:monitoring`, not in `pnpm test` or CI (design.md section 3).

**Neutral wording for pending owner decisions:**
- AC-F00-41/44: "the status page" means the chosen tool (Gatus proposed in D030, Uptime Kuma in the AC). Tests read its status through its HTTP API.
- AC-F00-45: "seed data" means whatever F00's seed covers (feature flags proposed; users and a workspace possibly in F01). Tests assert "every seeded record", not a fixed list.
- AC-F00-19: merge-blocking is tested as "every check appears on the PR and a failing check marks the PR failing". If branch protection is enabled, TC-F00-47 also asserts the Merge button is blocked.

## Test cases

### Starting the project

### TC-F00-01: `pnpm dev` starts everything within 2 minutes
- **Covers:** AC-F00-01, AC-F00-03
- **Level:** manual (performance)
- **Given** the owner's Mac with Docker running, images already downloaded, nothing of MeetApp running
- **When** the owner runs `pnpm dev` and starts a stopwatch
- **Then** within 2 minutes LiveKit, Postgres, Redis, storage (RustFS), Mailpit and the API are healthy, the MeetApp window is open, and the terminal prints an address table with one line per service (API, renderer, LiveKit, Postgres, Redis, MinIO, Mailpit). The time is recorded in `verification.md`.

### TC-F00-02: Docker not installed
- **Covers:** AC-F00-01
- **Level:** unit
- **Given** the dev runner with a fake environment where the `docker` command is not found
- **When** preflight runs
- **Then** it exits non-zero within 10 s with "Docker isn't installed. See docs/getting-started.md." and starts no service

### TC-F00-03: Docker installed but not running
- **Covers:** AC-F00-01
- **Level:** unit
- **Given** a fake `docker info` that (a) fails immediately and (b) hangs forever
- **When** preflight runs
- **Then** in both cases it exits non-zero within 10 s (the hang is cut at 3 s) with "Docker isn't running. Open Docker Desktop and try again."

### TC-F00-04: A needed port is taken by another program
- **Covers:** AC-F00-01
- **Level:** unit
- **Given** port 5432 is held by a process that is not one of this project's containers (also run for 7882/udp)
- **When** preflight runs
- **Then** it exits non-zero within 10 s with a message naming the port, the likely cause and the fix ("Stop it or change POSTGRES_PORT in .env")
- **Note:** the automated test holds random free ports set through the same settings, so it passes on any computer (including one with a real PostgreSQL on 5432). The address table is checked in the same test file.

### TC-F00-05: Second `pnpm dev` while already running
- **Covers:** AC-F00-01
- **Level:** unit
- **Given** all needed ports are held by this project's own containers (as listed by `docker compose ps`)
- **When** preflight runs
- **Then** the port check passes and no "port in use" error is shown

### TC-F00-06: Missing `.env` is created from `.env.example`
- **Covers:** AC-F00-01, AC-F00-05
- **Level:** unit
- **Given** a temp project folder with `.env.example` and no `.env`
- **When** preflight runs
- **Then** `.env` is created with the same content as `.env.example` and a message says so; an existing `.env` is never overwritten

### TC-F00-07: Health returns 200 when everything is up
- **Covers:** AC-F00-02
- **Level:** integration
- **Given** the API running against real Postgres, Redis, LiveKit and storage (RustFS)
- **When** `GET /api/v1/health` is called
- **Then** within 2 s it returns 200 with `status: "ok"` and `ok` for database, cache and call server (and storage); a failing part shows `down`

### TC-F00-08: Health returns 503 naming each part that is down
- **Covers:** AC-F00-02
- **Level:** integration
- **Given** the API running, and (a) Redis stopped, (b) Postgres stopped, (c) LiveKit replaced by a port that accepts connections but never answers
- **When** `GET /api/v1/health` is called
- **Then** within 2 s it returns 503 with `down` for exactly the stopped part and `ok` for the others (case c proves the 1.5 s timeout)

### TC-F00-09: Desktop window opens with the starter home screen
- **Covers:** AC-F00-03
- **Level:** e2e
- **Given** the desktop app built for development
- **When** Playwright launches Electron
- **Then** the first window is visible within 5 s and shows the placeholder "MeetApp" logo, the welcome line and a Settings button

### TC-F00-10: Empty database is migrated on start
- **Covers:** AC-F00-04
- **Level:** integration
- **Given** a freshly created empty Postgres database
- **When** the API starts
- **Then** the `feature_flags` table exists with the designed columns and the migrations journal is filled; starting the API a second time applies nothing and does not fail

### TC-F00-11: Missing required setting stops the backend
- **Covers:** AC-F00-05
- **Level:** unit
- **Given** a valid environment with one required variable removed (repeated for each required variable)
- **When** the config loader runs
- **Then** the process exits with code 1 and prints that variable's name and "see .env.example"; it does not print the values of other variables

### TC-F00-12: Every required setting is documented in `.env.example`
- **Covers:** AC-F00-05, AC-F00-06
- **Level:** unit
- **Given** the Zod config schema and `.env.example`
- **When** the test compares them
- **Then** every schema key appears in `.env.example` with a comment, and `.env.example` contains no real-looking secret (gitleaks finds nothing)

### TC-F00-13: Only free accounts are needed
- **Covers:** AC-F00-06
- **Level:** unit
- **Given** `.env.example` and `docs/getting-started.md`
- **When** the test scans them against a list of paid-only services and words ("credit card", "billing", paid plan names)
- **Then** nothing matches; every optional external setting (e.g. `SENTRY_DSN`) is empty by default

### TC-F00-14: Postgres drop and recovery without restart
- **Covers:** AC-F00-07, AC-F00-02
- **Level:** integration
- **Given** the API running and healthy
- **When** the Postgres container is stopped, then started again
- **Then** health shows database `down` within 5 s of the stop; the API process does not exit (same PID); health shows `ok` within 10 s of Postgres being healthy again

### TC-F00-15: Redis drop and recovery without restart
- **Covers:** AC-F00-07, AC-F00-02
- **Level:** integration
- **Given** the API running and healthy
- **When** the Redis container is stopped, then started again
- **Then** health shows cache `down` within 5 s (no request hangs on an offline queue); the API stays up; health shows `ok` within 10 s of Redis returning

### Look and feel

### TC-F00-16: Theme switch is instant and remembered
- **Covers:** AC-F00-08, AC-F00-17
- **Level:** e2e
- **Given** the desktop app open on the home screen in light mode
- **When** the user opens Settings and picks Dark, then closes and relaunches the app
- **Then** `<html data-theme="dark">` and the page background change within 1 s with no window reload (a marker set on `window` survives), and after relaunch the app starts in dark mode

### TC-F00-17: No wrong-theme flash on start
- **Covers:** AC-F00-08
- **Level:** e2e
- **Given** dark mode saved
- **When** the app is relaunched
- **Then** `data-theme="dark"` is already set on `<html>` at the first paint (checked via an init script that records the attribute on `DOMContentLoaded`, before React mounts)

### TC-F00-18: Corrupted saved preferences fall back to defaults
- **Covers:** AC-F00-08, AC-F00-10
- **Level:** unit
- **Given** `localStorage` holds an invalid theme (`"purple"`) and an invalid accent (`"<script>"`)
- **When** the appearance store loads
- **Then** theme falls back to system and accent to sky, and the invalid value is never written into `data-*` attributes

### TC-F00-19: "System" follows the computer
- **Covers:** AC-F00-09
- **Level:** e2e
- **Given** System selected in Settings
- **When** the test emulates `colorScheme: "dark"`, then `"light"`
- **Then** the app's computed background matches the dark, then light tokens, each within 1 s; with Light explicitly selected, emulating dark changes nothing

### TC-F00-20: Accent color switch for all 8 accents
- **Covers:** AC-F00-10
- **Level:** e2e
- **Given** the Settings panel open
- **When** the user picks each accent in turn (sky blue, blue, purple, pink, red, orange, green, teal), then relaunches after the last
- **Then** each time, within 1 s, a primary Button's background, a link's color and the focus outline use that accent's token values; after relaunch the last accent is still applied

### TC-F00-21: Default accent is sky blue with dark button text
- **Covers:** AC-F00-10
- **Level:** e2e
- **Given** a fresh profile (empty `localStorage`)
- **When** the app starts
- **Then** `data-accent="sky"` is set and the primary Button's text color equals the sky `on-accent` token (dark), not white

### TC-F00-22: Contrast matrix passes for every accent and theme
- **Covers:** AC-F00-11
- **Level:** unit
- **Given** `tokens.json`
- **When** the contrast test runs over 8 accents × 2 themes
- **Then** every pair listed in design §7 meets its ratio: 4.5:1 for text pairs (`on-accent`/`accent`, `accent-text` on surfaces and `accent-soft`, ink levels, status colors), 3:1 for `focus-ring` and `line-strong`

### TC-F00-23: Contrast check names the failing color and mode
- **Covers:** AC-F00-11
- **Level:** unit
- **Given** a fixture token file where teal `on-accent` on `accent` in dark mode is 3.9:1
- **When** the contrast test runs on it
- **Then** it fails with a message naming the token pair, "dark" and "teal", and the measured ratio

### TC-F00-24: Tokens are the approved design system, unchanged
- **Covers:** AC-F00-12
- **Level:** unit
- **Given** `packages/design-tokens/tokens.json` and the SHA-256 of the approved design-system token file recorded in the package README
- **When** the test hashes the file
- **Then** the hashes match

### TC-F00-25: Generated CSS matches tokens.json exactly
- **Covers:** AC-F00-12
- **Level:** unit
- **Given** the token build output
- **When** the test parses `tokens.css`
- **Then** every token in `tokens.json` appears with the same name and value under `:root`, `[data-theme="dark"]` or its `[data-accent]` block, and there are no extra color variables

### TC-F00-26: No color defined outside design-tokens
- **Covers:** AC-F00-12, AC-F00-15
- **Level:** unit
- **Given** the repository source (excluding `packages/design-tokens`, `tests/fixtures` and `node_modules`)
- **When** the test scans `.ts/.tsx/.css` files for hex, `rgb(`/`rgba(`/`hsl(`/`hsla(` color values
- **Then** it finds none

### UI building blocks

### TC-F00-27: Every atom has stories for every state
- **Covers:** AC-F00-13
- **Level:** unit
- **Given** the Storybook story index (`index.json` from the build)
- **When** the test lists stories per component
- **Then** Button, IconButton, Icon, Input, Avatar, Badge, Spinner, Tooltip and Toggle each exist; interactive ones have normal, hover, focused and disabled stories, and Button has loading
- **Note:** IconButton has no loading state in the approved design system (D029), so only Button is checked for it (corrected in T11).

### TC-F00-28: Visual screenshots of every story in light and dark
- **Covers:** AC-F00-13, AC-F00-33
- **Level:** e2e
- **Given** the built Storybook and baselines generated in the pinned Playwright image
- **When** the visual run opens every story in light and dark
- **Then** every screenshot matches its baseline; computed styles on Button/Input show `border-radius` equal to the `radius-full` token and `font-family` starting with Figtree

### TC-F00-29: Owner judges the gallery against the design system
- **Covers:** AC-F00-13
- **Level:** manual
- **Given** `pnpm storybook` running
- **When** the owner compares each atom side by side with the approved design system (sizes, pill shapes, colors, icon names, Figtree)
- **Then** the owner records "matches" or the differences in `verification.md`

### TC-F00-30: Fonts display with no internet
- **Covers:** AC-F00-13b
- **Level:** e2e
- **Given** the desktop app launched with all non-local network requests blocked (Playwright route abort for anything not `127.0.0.1`/`app://`)
- **When** the home screen has loaded and `document.fonts.ready` resolves
- **Then** `document.fonts.check('16px Figtree')` and `document.fonts.check('16px "JetBrains Mono"')` are true, and the font files were served from the app bundle

### TC-F00-31: Nothing is fetched from Google at runtime, security
- **Covers:** AC-F00-13b
- **Level:** security
- **Given** the desktop app and Storybook with request logging on
- **When** the home screen and Settings panel are opened
- **Then** no request goes to `fonts.googleapis.com`, `fonts.gstatic.com` or any non-local host; the built CSS contains no `googleapis` URL

### TC-F00-32: Interactive atoms work with the keyboard only
- **Covers:** AC-F00-14
- **Level:** unit
- **Given** Button, IconButton, Input and Toggle rendered with an `onClick`/`onChange` spy
- **When** the test presses Tab, then Enter and Space (Input: types "abc")
- **Then** each receives focus in order, the handler fires for Enter and Space, Input holds "abc", Toggle flips state, and the focused element has a visible outline (non-zero `outline-width` using the focus-ring token); a disabled Button is skipped and fires nothing

### TC-F00-33: Tooltip opens on focus and closes with Escape
- **Covers:** AC-F00-14
- **Level:** unit
- **Given** a Tooltip on a Button
- **When** the test tabs to the Button, then presses Escape
- **Then** the tooltip appears (role `tooltip`, linked by `aria-describedby`) on focus and disappears on Escape, while focus stays on the Button

### TC-F00-34: Non-interactive atoms are not in the Tab order
- **Covers:** AC-F00-14
- **Level:** unit
- **Given** Icon, Avatar, Badge and Spinner rendered between two Buttons
- **When** the test presses Tab from the first Button
- **Then** focus goes straight to the second Button

### TC-F00-35: Zero accessibility violations in every story
- **Covers:** AC-F00-14
- **Level:** e2e
- **Given** the built Storybook
- **When** axe runs on every atom and molecule story in light and dark
- **Then** there are 0 violations; an IconButton story with its name removed (done by the test itself, so the gallery stays clean) produces a `button-name` violation

### TC-F00-36: Lower Atomic level importing a higher level fails
- **Covers:** AC-F00-15
- **Level:** unit
- **Given** fixture files: an atom importing a molecule, an atom importing an organism, a molecule importing an organism
- **When** the lint and dependency-cruiser checks run on them
- **Then** each exits non-zero and names the boundaries rule and the file; an organism importing an atom passes
- **Added in T2:** importing another component's internal file instead of its `index.ts` fails `atomic-no-sibling-internals` (same level and other levels); importing through `index.ts` passes.

### TC-F00-37: Raw colors fail the check
- **Covers:** AC-F00-15
- **Level:** unit
- **Given** fixture components using `#0ea5e9`, `#fff`, `rgb(0,0,0)`, `hsl(200 50% 50%)`, `className="bg-blue-500"` and `text-[#123456]`
- **When** the lint check runs
- **Then** each fails naming `meetapp/no-raw-color` and the file; a token class such as `bg-accent` passes; a build using `bg-blue-500` produces no blue CSS rule (palette reset)
- **Added in T2:** `text-shadow-blue-500` also fails; a link anchor `href="#abc"` and a room number `#101` pass. The palette-reset part is tested in T10.

### TC-F00-38: Hard-coded visible text fails the check
- **Covers:** AC-F00-16
- **Level:** unit
- **Given** a fixture component with `<button>Save</button>` and one with `aria-label="Close"`, plus a correct component using `t("common.save")`
- **When** the lint check runs
- **Then** the two fixtures fail naming the file; the correct one passes; every `t()` key used in `apps/web` exists in `locales/en.json`
- **Note:** the `en.json` key check is tested in T14, when `apps/web` exists.

### Automatic checks and safety

### TC-F00-39: Test command runs every suite with a summary
- **Covers:** AC-F00-17
- **Level:** integration
- **Given** Docker running
- **When** `pnpm test` runs
- **Then** unit, integration (real Postgres/Redis) and the Electron e2e (TC-F00-09, TC-F00-16) all run; the output shows passed/failed counts and one merged coverage report; exit code 0

### TC-F00-40: Coverage below 80% fails the test command
- **Covers:** AC-F00-17
- **Level:** unit
- **Given** a fixture project using the shared Vitest config, with business-logic coverage at 70%
- **When** the test command runs on it
- **Then** it exits non-zero and names the file group below the threshold; at 80% it passes

### TC-F00-41: Test command without Docker fails clearly
- **Covers:** AC-F00-17
- **Level:** unit
- **Given** Docker not running
- **When** `pnpm test` starts
- **Then** it fails with the "Docker isn't running" message instead of timing out in integration tests

### TC-F00-42: Pre-commit blocks a secret, security
- **Covers:** AC-F00-18
- **Level:** security
- **Given** a temp git repo with the project's husky hook, and a staged file containing (a) a fake AWS-style key, (b) a fake PEM private key
- **When** `git commit` runs
- **Then** the commit is refused and the message names the file and line; the same file without the secret commits fine

### TC-F00-43: Secrets check fails closed without Docker, security
- **Covers:** AC-F00-18
- **Level:** security
- **Given** the pre-commit hook with Docker unavailable
- **When** `git commit` runs
- **Then** the commit is refused with "Start Docker to run the secrets check"

### TC-F00-44: Fixture secrets are excluded only in `tests/fixtures`, security
- **Covers:** AC-F00-18, AC-F00-19
- **Level:** security
- **Given** the repo's gitleaks config
- **When** a fake key is placed in `apps/api/src/` (not in `tests/fixtures`)
- **Then** the scan flags it; the allowlist covers no path outside `tests/fixtures`

### TC-F00-45: CI workflow contains every required check
- **Covers:** AC-F00-19
- **Level:** unit
- **Given** `.github/workflows/ci.yml`
- **When** the test parses it
- **Then** it triggers on `pull_request` and `push` to `main`, and has steps for: install + build; lint, typecheck, dependency-cruiser, knip, jscpd; unit + integration with Postgres/Redis; e2e; coverage threshold; `pnpm audit --audit-level high`; gitleaks; Semgrep; Storybook build + visual run; license check; container check

### TC-F00-46: Windows nightly workflow
- **Covers:** AC-F00-19
- **Level:** unit
- **Given** `.github/workflows/nightly-windows.yml`
- **When** the test parses it
- **Then** it runs on a daily `schedule` on `windows-latest`, skips when `main` had no commits in 24 h, and runs install, typecheck, unit tests and the desktop build

### TC-F00-47: Every check appears on a PR and a failing check marks it failing
- **Covers:** AC-F00-19
- **Level:** ci
- **Given** a test branch with (a) a clean change and (b) a change that breaks one rule (e.g. adds `console.log`)
- **When** each is opened as a Pull Request
- **Then** for (a) every job from TC-F00-45 appears in the PR checks and is green; for (b) that check is red and the PR's overall status is failing (and, if branch protection is on, merging is blocked)

### TC-F00-48: Dependency and code scans fail on real findings, security
- **Covers:** AC-F00-19
- **Level:** security
- **Given** a throwaway branch that (a) adds a dependency version with a known High advisory, (b) adds code matching a Semgrep community rule (e.g. `eval` of input)
- **When** CI runs
- **Then** the security job fails and names the package/advisory or rule and file

### TC-F00-49: Unexpected error returns the safe 500 body
- **Covers:** AC-F00-20
- **Level:** integration
- **Given** a test-only route that throws `new Error("db password=hunter2 for alice@example.com")`
- **When** it is called with a JSON body `{ "password": "hunter2", "email": "alice@example.com" }`
- **Then** the response is 500 with exactly `{ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Reference: <id>", requestId: <id> } }`, the same id in both places, and no stack, error message or input echoed

### TC-F00-50: Error logs are redacted, security
- **Covers:** AC-F00-20
- **Level:** security
- **Given** the request from TC-F00-49 with an `Authorization` and `Cookie` header, and the captured pino output
- **When** the log lines for that request are inspected
- **Then** they contain the same requestId and none of: `hunter2`, `alice@example.com`, the authorization/cookie values, or the request body

### TC-F00-51: Docs available in development
- **Covers:** AC-F00-21
- **Level:** integration
- **Given** the API with `NODE_ENV=development`
- **When** `/docs` and `/docs/json` are requested
- **Then** `/docs` returns the docs page and `/docs/json` is valid OpenAPI listing `GET /api/v1/health` (and every registered route)

### TC-F00-52: Docs hidden in production, security
- **Covers:** AC-F00-21
- **Level:** security
- **Given** the API with `NODE_ENV=production` (and with `NODE_ENV` unset)
- **When** `/docs`, `/docs/json` and `/docs/static/index.html` are requested
- **Then** all return 404

### TC-F00-53: Everything works without Sentry
- **Covers:** AC-F00-22
- **Level:** unit
- **Given** `SENTRY_DSN` unset (and, separately, `OTEL_EXPORTER_OTLP_ENDPOINT` unset)
- **When** the API and the Electron main start
- **Then** Sentry/OTel init is not called, startup succeeds and health returns 200

### TC-F00-54: Sentry receives no personal data, security
- **Covers:** AC-F00-22
- **Level:** security
- **Given** a Sentry event with `request.data`, cookies, headers and `user` set
- **When** the API `beforeSend` processes it
- **Then** all four are removed; both API and desktop init options switch off every category of `dataCollection` (Sentry 11's replacement for `sendDefaultPii: false`, D036)

### TC-F00-55: All compose ports bind to localhost
- **Covers:** AC-F00-23
- **Level:** unit
- **Given** `infra/docker-compose.yml` with all profiles
- **When** the test parses every published port
- **Then** each starts with `127.0.0.1:`; the API default host is `127.0.0.1`; Storybook and Vite use `--host 127.0.0.1`

### TC-F00-56: Other devices cannot connect, security
- **Covers:** AC-F00-23
- **Level:** security
- **Given** the project running (with the monitoring profile) and the Mac's LAN address
- **When** the test tries TCP connections to each published port and the API on the LAN address
- **Then** every connection is refused, while the same ports on `127.0.0.1` accept

### TC-F00-57: CORS allows only the app's own origins, security
- **Covers:** AC-F00-23
- **Level:** security
- **Given** the API running
- **When** a request is sent with `Origin: https://evil.example` and with `Origin: app://meetapp`
- **Then** the evil origin gets no `Access-Control-Allow-Origin`; `app://meetapp` and `http://127.0.0.1:5173` are allowed

### TC-F00-58: Electron security settings are on, security
- **Covers:** AC-F00-24
- **Level:** security
- **Given** the app launched by Playwright
- **When** the test reads the main window's `webPreferences` in the main process and checks the page
- **Then** `contextIsolation`, `sandbox`, `webSecurity` are true, `nodeIntegration` and `webviewTag` false; in the page `typeof require`, `typeof process` are `"undefined"` and `window.meetapp` has only `platform`

### TC-F00-59: Outside navigation and new windows are blocked, security
- **Covers:** AC-F00-24
- **Level:** security
- **Given** the app running
- **When** the page sets `location.href = "https://example.com"`, calls `window.open("https://example.com")`, and calls `window.open("file:///etc/passwd")`
- **Then** the URL stays on the app, no new window opens, and `shell.openExternal` is called only for the `https:` URL (never for `file:`)

### TC-F00-60: Permission requests are denied, security
- **Covers:** AC-F00-24
- **Level:** security
- **Given** the app running
- **When** the page requests camera/microphone (`getUserMedia`) and notifications
- **Then** each is denied

### TC-F00-61: CSP blocks inline and remote scripts, security
- **Covers:** AC-F00-24
- **Level:** security
- **Given** the production build of the app
- **When** the test injects `<script>window.pwned=1</script>` and a `<script src="https://evil.example/x.js">`
- **Then** `window.pwned` is undefined, the remote script is not loaded, and a CSP violation is reported; the response CSP header equals the one in design §5

### Code quality

### TC-F00-62: Each hard limit fails and names file, line and rule
- **Covers:** AC-F00-27
- **Level:** unit
- **Given** one fixture per rule: function of 51 lines, file of 301 lines, complexity 16, 5 parameters, nesting depth 4, an `any` type, a `console.log`
- **When** the lint check runs on each
- **Then** each exits non-zero and the output names the file, line and rule
- **Added in T2:** an `eslint-disable` comment without a reason fails (code-quality.md: a limit may be broken only with a comment explaining why); one with `-- reason` passes.

### TC-F00-63: Code exactly at the limits passes
- **Covers:** AC-F00-27
- **Level:** unit
- **Given** fixtures with a 50-line function, 300-line file, complexity 15, 4 parameters, nesting 3
- **When** the lint check runs
- **Then** it passes

### TC-F00-64: Skipping a backend layer fails
- **Covers:** AC-F00-28
- **Level:** unit
- **Given** fixtures where a route imports a repository, and a route imports `packages/db` directly
- **When** the architecture check runs
- **Then** it exits non-zero naming the rule; a route → service → repository fixture passes
- **Added in T2:** a route importing `drizzle-orm` fails `no-route-to-db`; a service importing `@meetapp/db` fails `no-service-to-db`.

### TC-F00-65: Unused code and duplication fail
- **Covers:** AC-F00-29
- **Level:** unit
- **Given** fixture projects with (a) an unused file, (b) an unused export, (c) an unused dependency, (d) duplicated code at 4%, (e) duplicated code at 2%
- **When** knip and jscpd run
- **Then** a–d fail and name the item; e passes

### TC-F00-66: Claude edit hook lints and formats the edited file
- **Covers:** AC-F00-30
- **Level:** unit
- **Given** the hook script and the hook input JSON for (a) a badly formatted `.ts` file, (b) a `.ts` file with a lint error, (c) a clean file, (d) a `.md` file
- **When** the hook runs
- **Then** a and b exit 2 with the problem (file, rule) on stderr; c and d exit 0

### Production readiness

### TC-F00-67: Blocked licenses fail the check
- **Covers:** AC-F00-31
- **Level:** unit
- **Given** a fake license list with packages licensed GPL-3.0, AGPL-3.0, LGPL-2.1, SSPL-1.0 and an unknown license
- **When** the license checker runs
- **Then** it exits non-zero and names each package and license

### TC-F00-68: SPDX expressions and the allowlist
- **Covers:** AC-F00-31
- **Level:** unit
- **Given** fake packages with `MIT OR GPL-3.0`, `(MIT AND GPL-3.0)`, `Apache-2.0 WITH LLVM-exception`, and a GPL package listed in `license-allowlist.json` with and without a reason
- **When** the license checker runs
- **Then** `MIT OR GPL-3.0` and the `WITH` exception pass, the `AND` expression fails, the allowlisted entry with a reason passes and the one without a reason fails

### TC-F00-69: Dependabot is configured
- **Covers:** AC-F00-32
- **Level:** unit
- **Given** `.github/dependabot.yml`
- **When** the test validates it against the Dependabot schema
- **Then** it has `npm`, `docker` and `github-actions` ecosystems, each `weekly`, grouped

### TC-F00-70: Dependabot PRs go through all checks
- **Covers:** AC-F00-32
- **Level:** ci
- **Given** the repository on GitHub for at least one week
- **When** Dependabot opens an update PR
- **Then** it was opened within 7 days of the first schedule and the full check list from TC-F00-47 runs on it

### TC-F00-71: Unexpected look change fails with a diff
- **Covers:** AC-F00-33
- **Level:** ci
- **Given** a branch changing the Button padding
- **When** the visual job runs
- **Then** it fails and the uploaded report shows before, after and diff images; after `pnpm test:visual:update` (baseline approved) the job passes

### TC-F00-72: Switching a flag off hides the feature without restart
- **Covers:** AC-F00-34
- **Level:** e2e
- **Given** the app open with a test-only element guarded by `useFlag("demo")`, and the flag on
- **When** `pnpm flag demo off` runs (then `on` again)
- **Then** the element disappears within 30 s and reappears within 30 s; the API PID is unchanged

### TC-F00-73: Flags API reflects changes within the cache window
- **Covers:** AC-F00-34
- **Level:** integration
- **Given** the API running and a flag row
- **When** `enabled` is changed in the database
- **Then** `GET /api/v1/flags` shows the new value within 10 s; a newly inserted row without `enabled` is `false`

### TC-F00-74: Unknown flag or failed fetch means off
- **Covers:** AC-F00-34
- **Level:** unit
- **Given** `useFlag` with (a) a key not in the response, (b) the fetch rejecting, (c) the fetch returning 503 or malformed JSON
- **When** the hook evaluates
- **Then** it returns `false` in every case

### TC-F00-75: Flag command rejects bad input
- **Covers:** AC-F00-34
- **Level:** unit
- **Given** `tools/flag.ts`
- **When** called with no key, with `maybe` instead of on/off, or with a key containing `'; drop table`
- **Then** it exits non-zero with a usage message and nothing changes in the database (parameterized queries)

### TC-F00-76: Emails land in the local fake inbox
- **Covers:** AC-F00-35
- **Level:** integration
- **Given** Mailpit running
- **When** `pnpm email:test` runs
- **Then** the Mailpit API lists the message with the expected subject and recipient, and no external SMTP host was contacted

### Project structure and tooling

### TC-F00-77: Structure check passes and catches drift
- **Covers:** AC-F00-36, AC-F00-26
- **Level:** unit
- **Given** the repo, and fixture copies with (a) a package missing CLAUDE.md, (b) an app missing README.md, (c) an unexpected top folder, (d) an `apps/mobile` or `apps/ai-worker` folder
- **When** `tools/check-structure.ts` runs
- **Then** the real repo passes; each fixture fails naming the missing file or unexpected folder

### TC-F00-78: Wrong tool version is refused
- **Covers:** AC-F00-37
- **Level:** unit
- **Given** preflight with a faked Node 20 (and separately a faked pnpm 9)
- **When** it runs
- **Then** it exits non-zero with "Expected Node 24, found 20. Run `mise install`" (or the pnpm equivalent); Node 24.x with any minor passes; preflight itself parses on Node 18

### TC-F00-79: Versions are pinned in one place
- **Covers:** AC-F00-37
- **Level:** unit
- **Given** `mise.toml`, root `package.json` and the CI workflows
- **When** the test reads them
- **Then** `mise.toml` pins Node 24, pnpm 10 and Python 3.12; `packageManager` is `pnpm@10.x`; every workflow installs tools with `mise-action`

### TC-F00-80: Backend stores and reads back a file
- **Covers:** AC-F00-38
- **Level:** integration
- **Given** storage (RustFS) running with bucket `meetapp-dev`
- **When** the storage provider writes a test object with random content, then reads it
- **Then** the bytes match; reading a missing key returns a not-found error, not a crash

### TC-F00-81: Container image is healthy, non-root and secret-free, security
- **Covers:** AC-F00-39
- **Level:** ci
- **Given** the CI container job with the services running
- **When** the API image is built and started
- **Then** `/api/v1/health` returns 200 and the Docker HEALTHCHECK reports healthy; `id -u` is not 0; no `.env*` file exists in the image; gitleaks over the exported image filesystem finds nothing

### TC-F00-82: Local data survives a restart
- **Covers:** AC-F00-40
- **Level:** integration
- **Given** a flag row in Postgres, an object in storage (RustFS) and a key in Redis
- **When** `docker compose down` (without `-v`) and `up --wait` run
- **Then** all three still exist

### TC-F00-83: Data survives a real Mac restart
- **Covers:** AC-F00-40
- **Level:** manual
- **Given** seeded data and a stored test file
- **When** the owner restarts the Mac and runs `pnpm dev`
- **Then** the data and file are still there; result recorded in `verification.md`

### Monitoring

### TC-F00-84: Status page shows every service green
- **Covers:** AC-F00-41
- **Level:** integration
- **Given** `pnpm dev` and `pnpm monitoring` running
- **When** the test reads the status page's API
- **Then** it lists backend, database, cache, call server, file storage and email, all healthy, each with a 30 s check interval

### TC-F00-85: Stopping a service turns it red within 1 minute
- **Covers:** AC-F00-41
- **Level:** integration
- **Given** monitoring running and all green
- **When** each service in turn (Redis, Postgres, LiveKit, storage, Mailpit, API) is stopped, then restarted
- **Then** the status page shows that service red within 60 s and only that one (plus backend, if its health depends on it); green again after restart

### TC-F00-94: The backend exposes its numbers for monitoring
- **Covers:** AC-F00-42
- **Level:** unit
- **Given** the API with fake database-pool and cache sources
- **When** a few requests are made and `GET /metrics` is read
- **Then** request counts and response times appear per route pattern (never the raw URL), the pool and cache gauges show the source values, process CPU/memory are present, and `/metrics` is not in the API docs

### TC-F00-86: Grafana overview dashboard has live data
- **Covers:** AC-F00-42
- **Level:** integration
- **Given** monitoring running and some API traffic generated
- **When** the test queries the Grafana API
- **Then** the "MeetApp overview" dashboard exists, and its request count, error rate, response time, DB connections, cache status and per-container CPU/memory panels each return non-empty data

### TC-F00-87: A request ID finds its logs and trace
- **Covers:** AC-F00-43
- **Level:** integration
- **Given** monitoring running and the test route from TC-F00-49
- **When** the failing request is made and its requestId taken from the response
- **Then** within 30 s Loki returns log lines with that requestId and a traceId, and Tempo returns that trace with the failing span marked as error; the log lines still pass the redaction checks of TC-F00-50

### TC-F00-88: Down and recovered alerts are sent
- **Covers:** AC-F00-44
- **Level:** integration
- **Given** monitoring and the notifier running
- **When** Redis is stopped for 2 minutes, then started
- **Then** a "down" email appears in Mailpit 60–120 s after the stop and the notifier webhook receives a "down" call; after restart a "recovered" email and webhook call arrive

### TC-F00-89: Short blips do not alert
- **Covers:** AC-F00-44
- **Level:** integration
- **Given** monitoring running
- **When** Redis is stopped for 20 s, then started
- **Then** no "down" alert email is sent

### TC-F00-95: Monitoring settings say what the design says
- **Covers:** AC-F00-41, AC-F00-44
- **Level:** unit
- **Given** the files in `infra/monitoring/` and `infra/docker-compose.yml`
- **When** the test reads them
- **Then** Gatus watches backend, database, cache, call server, file storage and email every 30 s with `failure-threshold: 3`, `success-threshold: 2` and `send-on-resolved: true`, alerting by email and the notifier; every monitoring service is in the `monitoring` profile; Grafana has the "MeetApp overview" dashboard with panels for request count, error rate, response time, database connections, cache status and CPU/memory per container, plus the "error spike" and "disk nearly full" alert rules sent to email and the notifier; every new `.env` setting is documented in `.env.example`

### TC-F00-96: The notifier shows only well-formed alerts, safely
- **Covers:** AC-F00-44
- **Level:** unit
- **Given** the notifier with a fake "show notification" step
- **When** it receives a Gatus "TRIGGERED"/"RESOLVED" call, a Grafana "firing"/"resolved" call, a wrong path, a wrong method, a body that is not JSON, a body over 16 KB, and a service name containing quotes and `do shell script`
- **Then** valid calls show "<service> is down" / "<service> recovered" (204); the others answer 404/405/400/413 and show nothing; the macOS command receives the text as separate arguments, never inside the script text

### TC-F00-90: macOS notification appears
- **Covers:** AC-F00-44
- **Level:** manual
- **Given** notifications allowed for the notifier
- **When** a service is stopped for over 1 minute
- **Then** a macOS notification naming the service is shown, and another on recovery

### TC-F00-91: Seed and clear with one command each
- **Covers:** AC-F00-45
- **Level:** integration
- **Given** a migrated empty database
- **When** `pnpm seed` runs twice, then `pnpm seed:clear` runs
- **Then** after the seed every seeded record exists exactly once (no duplicates); after clear every seeded record is gone and a non-seed row created by the test is untouched; seed data contains no real personal data

### Documentation

### TC-F00-92: Getting-started walk-through on a clean Mac
- **Covers:** AC-F00-25, AC-F00-06, AC-F00-01
- **Level:** manual
- **Given** a Mac (or a fresh macOS user account) with only the prerequisites listed in `docs/getting-started.md`
- **When** someone follows only the written steps
- **Then** the app runs and `pnpm test` passes, no step outside the guide was needed, and no credit card was entered; result recorded in `verification.md`

### TC-F00-93: Docs list real commands
- **Covers:** AC-F00-26
- **Level:** unit
- **Given** the root CLAUDE.md "commands" section, `docs/getting-started.md` and each app/package README
- **When** the test extracts every `pnpm <script>` they mention
- **Then** each exists in the matching `package.json` scripts; each README has "what", "run" and "test" sections

## Coverage
| Acceptance criterion | Test cases |
|---|---|
| AC-F00-01 | TC-F00-01, 02, 03, 04, 05, 06, 92 |
| AC-F00-02 | TC-F00-07, 08, 14, 15 |
| AC-F00-03 | TC-F00-01, 09 |
| AC-F00-04 | TC-F00-10 |
| AC-F00-05 | TC-F00-06, 11, 12 |
| AC-F00-06 | TC-F00-12, 13, 92 |
| AC-F00-07 | TC-F00-14, 15 |
| AC-F00-08 | TC-F00-16, 17, 18 |
| AC-F00-09 | TC-F00-19 |
| AC-F00-10 | TC-F00-18, 20, 21 |
| AC-F00-11 | TC-F00-22, 23 |
| AC-F00-12 | TC-F00-24, 25, 26 |
| AC-F00-13 | TC-F00-27, 28, 29 |
| AC-F00-13b | TC-F00-30, 31 |
| AC-F00-14 | TC-F00-32, 33, 34, 35 |
| AC-F00-15 | TC-F00-26, 36, 37 |
| AC-F00-16 | TC-F00-38 |
| AC-F00-17 | TC-F00-16, 39, 40, 41 |
| AC-F00-18 | TC-F00-42, 43, 44 |
| AC-F00-19 | TC-F00-44, 45, 46, 47, 48 |
| AC-F00-20 | TC-F00-49, 50 |
| AC-F00-21 | TC-F00-51, 52 |
| AC-F00-22 | TC-F00-53, 54 |
| AC-F00-23 | TC-F00-55, 56, 57 |
| AC-F00-24 | TC-F00-58, 59, 60, 61 |
| AC-F00-25 | TC-F00-92 |
| AC-F00-26 | TC-F00-77, 93 |
| AC-F00-27 | TC-F00-62, 63 |
| AC-F00-28 | TC-F00-64 |
| AC-F00-29 | TC-F00-65 |
| AC-F00-30 | TC-F00-66 |
| AC-F00-31 | TC-F00-67, 68 |
| AC-F00-32 | TC-F00-69, 70 |
| AC-F00-33 | TC-F00-28, 71 |
| AC-F00-34 | TC-F00-72, 73, 74, 75 |
| AC-F00-35 | TC-F00-76 |
| AC-F00-36 | TC-F00-77 |
| AC-F00-37 | TC-F00-78, 79 |
| AC-F00-38 | TC-F00-80 |
| AC-F00-39 | TC-F00-81 |
| AC-F00-40 | TC-F00-82, 83 |
| AC-F00-41 | TC-F00-84, 85, 95 |
| AC-F00-42 | TC-F00-86, 94 |
| AC-F00-43 | TC-F00-87 |
| AC-F00-44 | TC-F00-88, 89, 90, 95, 96 |
| AC-F00-45 | TC-F00-91 |

**Security rules covered:** S7 (TC-F00-12, 42, 43, 44, 81), S10 (TC-F00-50, 54, 87), S17 (TC-F00-58 to 61), S19/S20 (TC-F00-45, 47, 48), local-only access (TC-F00-55, 56, 57), docs only in development (TC-F00-52), no runtime Google fetch (TC-F00-31). S6 does not apply locally (see requirements).
