---
feature: F00
title: Foundation
status: approved
updated: 2026-10-09
---

# F00 Foundation: Requirements (WHAT)

## Goal
Build the invisible base of MeetApp: the project setup, the look-and-feel system (themes and basic UI pieces), and the automatic quality and security checks. Every later feature (F01, F02…) is then built the production-grade way from its first line, at zero cost (D017).

## Who uses it
- **The owner:** starts the app on their computer, sees the design pieces, and sees the checks pass.
- **Claude / future developers:** build every feature on top of it.
- **End users** see only the result: the app window, themes and colors.

## Depends on decisions
D003, D004, D005, D006, D010, D011, D012, D013, D015, D016, D017, D018, D019, D021, D023, D024, D025, D026, D027, D028, D029.

## Design source (D029)
The approved **MeetApp design system** (https://claude.ai/artifact/K9GV7yg9Y4QkNJ7VgAb3PJ) is the source of truth for every color, font, spacing step, radius and atom in F00. The approved screens (https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ) are built in later features. All must be **accepted** before this spec is approved.

## User stories
- As the owner, I want **one command** to start everything on my Mac, so I can try the app without technical steps.
- As the owner, I want to **see all the UI building blocks** in one place (a component gallery), so I can judge the look before screens are built.
- As a user, I want to choose **light, dark or "same as my computer"** and an **accent color**, so the app looks the way I like.
- As the owner, I want **automatic checks** on every change (tests, security, code rules), so mistakes are caught before they pile up.
- As the owner, I want the project to **refuse to run with missing settings or leaked passwords**, so problems are caught early.

## Acceptance criteria

### Starting the project
- **AC-F00-01:** WHEN the owner runs `pnpm dev` on their Mac with Docker running, THEN within 2 minutes (not counting first-time downloads) the call server, database, cache and backend are running, the desktop app window opens, and the command prints the address of each service. WHEN Docker is not running or a needed port is already in use, THEN the command stops within 10 seconds with a message naming the problem and how to fix it.
- **AC-F00-02:** WHEN `GET /api/v1/health` is called, THEN within 2 seconds it returns HTTP 200 with `ok` for database, cache and call server when all are up, or HTTP 503 with `down` for each part that is down.
- **AC-F00-03:** WHEN the desktop app is started in development mode, THEN a MeetApp window opens within 5 seconds, showing a starter home screen with a placeholder logo and a Settings button. (Development mode only; the 3-second start-up target in quality-targets.md applies to the packaged app in F04.)
- **AC-F00-04:** WHEN the backend starts for the first time on an empty database, THEN the database structure is created automatically (migrations), with no manual steps.
- **AC-F00-05:** WHEN the backend starts with a required setting missing, THEN it refuses to start and prints which setting is missing and where to set it (`.env`, explained in `.env.example`).
- **AC-F00-06:** WHEN the project is set up from the Getting started guide, THEN every AC passes using only free accounts (GitHub free, optionally Sentry free), no credit card is entered anywhere, and `.env.example` has no setting that requires a paid account.
- **AC-F00-07:** WHEN the database or cache is stopped and restarted while the backend runs, THEN the health check shows `down` within 5 seconds, and the backend reconnects by itself within 10 seconds of the service returning, without a restart.

### Look and feel (D018)
- **AC-F00-08:** WHEN the user picks light, dark or system mode in the Settings panel, THEN the whole app switches within 1 second without reloading the window, and the choice is remembered after the app restarts. (Saved on this device until F01 adds accounts.)
- **AC-F00-09:** WHEN "system" is selected and the computer switches between light and dark, THEN the app follows within 1 second.
- **AC-F00-10:** WHEN the user picks one of the 8 accent colors (**sky blue, blue, purple, pink, red, orange, green, teal**), THEN buttons, links, focus outlines and highlights change to that color within 1 second and stay after restart. The default for new users is **sky blue**. Where white text isn't readable on a light accent (e.g. sky blue), buttons use dark text instead.
- **AC-F00-11:** WHEN the automatic checks run, THEN every accent color is checked in light and dark mode: text on accent backgrounds and accent-colored text need at least 4.5:1 contrast, and focus outlines and other UI parts need at least 3:1. The check fails and names the color and mode if any is below.
- **AC-F00-12:** WHEN the design tokens are built, THEN the CSS variables are generated from the single file `packages/design-tokens/tokens.json`, which holds exactly the approved design system's tokens (same names and values), and no color is defined anywhere else.

### UI building blocks (Atomic Design, D011)
- **AC-F00-13:** WHEN the owner opens the component gallery (Storybook), THEN they see these atoms, each in all its states (normal, hover, focused, disabled, loading where relevant) and in both themes: Button, IconButton, Icon, Input, Avatar, Badge, Spinner, Tooltip, Toggle. They look and behave like the approved design system: same sizes, pill-shaped buttons and inputs, same colors and icons names, Figtree text.
- **AC-F00-13b:** WHEN the desktop app runs without internet, THEN the fonts (Figtree, JetBrains Mono) still display correctly, because they are bundled with the app and not loaded from Google at runtime (privacy and offline use).
- **AC-F00-14:** WHEN the interactive atoms (Button, IconButton, Input, Toggle) are used with only the keyboard, THEN each can be reached with Tab, activated with Enter/Space (Input accepts typing), and shows a visible focus outline. A Tooltip appears when its trigger gets keyboard focus and closes with Escape. Non-interactive atoms (Icon, Avatar, Badge, Spinner) are not in the Tab order. Every atom's story passes the automated accessibility check with 0 violations.
- **AC-F00-15:** WHEN code in a lower Atomic level imports a higher level (e.g. an atom uses an organism), or a component uses a raw color (hex, rgb/hsl, or a fixed palette class such as `bg-blue-500`) instead of a token, THEN the automatic code check fails and names the rule and file.
- **AC-F00-16:** WHEN visible text is written directly in a component instead of the translation file, THEN the automatic code check fails and names the file.

### Automatic checks and safety
- **AC-F00-17:** WHEN the owner runs the test command, THEN all tests run: unit tests, integration tests with a real database, and at least one end-to-end test that launches the desktop app and checks the home screen and the theme switch. A summary shows passed/failed counts and coverage, and the command fails if coverage on business logic is below 80%.
- **AC-F00-18:** WHEN a commit contains a secret matched by the secrets scanner's standard rules (e.g. a fake API key or private key in a test file), THEN the commit is blocked with a message naming the file and line.
- **AC-F00-19:** WHEN a change is uploaded to GitHub as a Pull Request, THEN these checks run automatically:
  - install + build
  - lint + typecheck + Atomic Design and layer rules + code-quality limits (AC-F00-27 to 29)
  - unit + integration tests (real Postgres/Redis)
  - the end-to-end test
  - coverage ≥ 80% on business logic
  - dependency vulnerability scan (fails on Critical/High)
  - secrets scan
  - code security scan (Semgrep, free)
  - Storybook build + visual screenshot tests
  - license check

  The Pull Request is marked failing if any check fails. Claude never opens or recommends merging a Pull Request with a failing check, and a failing PR shows a clear "Do not merge" warning (free plan, owner decision 2026-10-09; GitHub Pro would make GitHub block it). The checks run on macOS/Linux; a **Windows** build and test run once a day on `main` (the owner has no Windows PC, and this keeps us within GitHub's free limits).
- **AC-F00-20:** WHEN the backend hits an unexpected error, THEN the caller gets HTTP 500 with `{ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Reference: <requestId>", requestId } }` and no stack trace or internal details. The log entry has the same requestId and contains no passwords, tokens, email addresses, names or request bodies. This is verified by a test that triggers an error with a fake password and email in the request.
- **AC-F00-21:** WHEN the backend runs in development, THEN an API documentation page lists every endpoint (just health for now) and an OpenAPI file is available at `/docs/json`. The docs page is not served in production mode.
- **AC-F00-22:** WHEN the error-tracking key (Sentry) is not set (the default), THEN everything works normally without it. When it is set, crashes from the backend and desktop app are reported, with no personal data or request bodies.
- **AC-F00-23:** WHEN the project is running, THEN the database, cache, call server and backend accept connections only from this computer; another device on the same Wi-Fi cannot connect. This is checked by a test that connects to the machine's network address and expects refusal.
- **AC-F00-24:** WHEN the desktop app runs, THEN context isolation and sandbox are on, Node access from pages is off, and the app blocks navigation and new windows to any address outside the app. This is checked by an automated test.

### Code quality (D021)
- **AC-F00-27:** WHEN code breaks a hard limit from `docs/engineering/code-quality.md` (function > 50 lines, file > 300 lines, complexity > 15, more than 4 parameters, nesting > 3, `any` type, `console.log`), THEN the automatic code check fails and names the file, line and rule.
- **AC-F00-28:** WHEN code skips a layer (e.g. a route reads the database directly instead of going through a service and repository), THEN the architecture check fails and names the rule.
- **AC-F00-29:** WHEN the checks run, THEN unused files/exports/dependencies and duplicated code above 3% are reported and fail the check.
- **AC-F00-30:** WHEN Claude edits a code file, THEN that file is linted and format-checked automatically right after the edit, and any problem is reported back so it gets fixed immediately.

### Production readiness
- **AC-F00-31:** WHEN the checks run and a library's license is on the blocked list (GPL, AGPL and similar), THEN the check fails and names the library.
- **AC-F00-32:** WHEN a used library gets a new version or security fix, THEN an automatic Pull Request (Dependabot) is opened within a week and goes through all checks.
- **AC-F00-33:** WHEN a component's look changes unexpectedly, THEN the visual screenshot test fails and shows the before/after difference until the change is approved.
- **AC-F00-34:** WHEN a feature flag is switched off in the settings/database, THEN the feature it guards is hidden or disabled without restarting the backend (within 30 seconds); flags default to off.
- **AC-F00-35:** WHEN the project runs locally, THEN a local fake inbox (Mailpit) is available, so every email the app sends can be viewed without sending real emails.

### Project structure & tooling (D024, D025)
- **AC-F00-36:** WHEN F00 is done, THEN the folders and file names match `docs/engineering/project-structure.md`, and each app and package has its own short CLAUDE.md with the rules for that area.
- **AC-F00-37:** WHEN someone runs the setup step, THEN the exact versions of Node.js (24 LTS), pnpm and Python (3.12) from `mise.toml` are used, and the start command refuses to run with a different major version, naming the expected one.
- **AC-F00-38:** WHEN the project runs locally, THEN local file storage (RustFS, same S3 API as Cloudflare R2; replaces MinIO, D035) is available, and the backend can store and read back a test file.
- **AC-F00-39:** WHEN CI runs, THEN the backend is built into a container image that starts and answers the health check; the image runs as a non-root user and contains no secrets.
- **AC-F00-40:** WHEN the Mac restarts, THEN local data (database, files, queued jobs) is still there.

### Monitoring (D027)
- **AC-F00-41:** WHEN the owner runs the monitoring command, THEN a status page (Gatus, D030) shows green/red for backend, database, cache, call server, file storage and email, checked every 30 seconds; stopping any one turns it red within 1 minute.
- **AC-F00-42:** WHEN the monitoring is running, THEN a Grafana "MeetApp overview" dashboard shows live request count, error rate, response times, database connections, cache status and CPU/memory for each service.
- **AC-F00-43:** WHEN a request fails, THEN its request ID can be used to find the matching log lines (Loki) and the request's trace (Tempo) showing which step failed.
- **AC-F00-44:** WHEN a service is down for more than 1 minute, THEN an alert is sent (Mac notification and an email visible in Mailpit), and another when it recovers.
- **AC-F00-45:** WHEN the project is set up, THEN local seed data for the tables that exist (feature flags in F00; sample users and a workspace are added to the seed in F01) can be loaded with one command and removed with one command.

### Documentation
- **AC-F00-25:** WHEN someone follows the "Getting started" guide on a Mac with a macOS version supported by current Docker Desktop (today 14+) that has only the prerequisites listed in the guide (Docker, Node LTS, pnpm), THEN they can run the project using only the steps written there.
- **AC-F00-26:** WHEN F00 is done, THEN every app and package has a short README (what it is, how to run it, how to test it), and the CLAUDE.md "commands" section lists the real start, test and check commands.

## Security & privacy
- Desktop app security settings follow rule S17 (AC-F00-24).
- Local services are reachable only from the owner's computer (AC-F00-23).
- Secrets live only in `.env` (never committed); `.env.example` documents every setting without real values (S7, AC-F00-18).
- Logs and error reports never contain secrets or personal data (S10, AC-F00-20, AC-F00-22).
- Dependency, secrets and code scans run on every change (S19, S20, AC-F00-19).
- S6 (HTTPS) doesn't apply on the owner's computer during development; it applies from the first online environment.

## Out of scope
- Accounts and login (F01), meetings and calls (F02), chat (F03), desktop installer / auto-update / packaging (F04).
- A browser version for users (F10). The browser build is used only for Storybook and automated checks.
- AI worker and transcription (F05+); no `apps/ai-worker` code in F00.
- Mobile app (F11); no `apps/mobile` code and no Dart theme output in F00.
- Anything online: staging server, domain, app signing. Deferred by D017.
- Real logo (placeholder until chosen).

## Open questions
None. Design-review changes approved by the owner on 2026-10-09: Gatus status page (AC-41), seed limited to existing tables (AC-45), macOS per Docker Desktop support (AC-25), merge guard on the free plan (AC-19). Earlier answers, 2026-10-09: palette as in AC-F00-10; the owner has a GitHub account; Mac only, with Windows checked daily by GitHub; all listed decisions accepted.
