# Progress Log

> Claude reads this file automatically at the start of every session (via a hook).
> Keep the "Current state" section short and up to date. Add new sessions at the top of the log.

## Current state
- **Coding go-ahead:** yes (given by the owner on 2026-10-09, together with F00 requirements approval)
- **Stage:** Building F00 Foundation on branch `feat/F00-foundation`. T1–T19 done. Next is T20 (monitoring: status page, dashboards, alerts; a milestone). Draft PR #3 (F00) has all GitHub checks green.
- **Design phase (D029):** design system **approved** (buttons and inputs pill-shaped): https://claude.ai/artifact/K9GV7yg9Y4QkNJ7VgAb3PJ. Screen designs v1 (8 screens) **approved**: https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ
- **Next step:** `/next` builds T20. `pnpm test` runs every test (Docker must be running); `pnpm desktop` opens the app. Storybook (`pnpm --filter @meetapp/ui storybook`) shows all 9 atoms and the 2 Settings molecules.

## Open questions (need the owner's answer)
0c. **IconButton "off" state (optional, design system):** a muted microphone button says "Unmute" and is also marked "pressed", so screen readers say "Unmute, toggle button, pressed". This matches the approved design system. Keep it, or change the design system to use only the label (recommended: only the label)?
0d. **Theme switch: chosen option is faint (optional, design system):** in the Light / Dark / Same-as-computer switch, the chosen option differs only by a slightly lighter background and a soft shadow. It may be hard to see for people with low vision. Keep it as designed, or make the chosen option stronger in the design system (recommended: stronger)?
1. **App name:** is "MeetApp" final, or a working name?
2. **Pricing:** free plan limits (e.g. 40-minute meetings? number of participants?) and paid plan price?
3. **Recording:** should meetings be recorded (video files)? It costs storage. Or only transcripts?
4. **AI on/off:** should AI transcription be on for every meeting, or only when the host turns it on?
5. **Languages:** which spoken languages must transcription support at launch? (English only? Urdu? others?)
6. **Guests:** can people without an account join a meeting via link?
7. **Data location / privacy:** any customers needing data stored in a specific country?
8. **Local AI:** which minimum computer should "Local AI mode" support?
9. **Quality targets:** are the numbers in `docs/product/quality-targets.md` OK?

## Answered
- **Ports on this Mac (2026-10-10):** MeetApp moved to spare ports in the local `.env`: database 5433, cache 6380, backend 3010 (`VITE_API_URL` http://127.0.0.1:3010). The owner's own PostgreSQL, Redis and Open WebUI keep running.
- **GitHub MCP:** connected (token stored on the owner's computer only).
- **Code repository:** https://github.com/codewithnomi/meetapp (private). The first upload went straight to `main`; every change after that goes through a branch + Pull Request.
- **Budget:** free way for now; no paid accounts, nothing deployed online yet (D017).
- **Domain:** none yet. Everything runs locally for now.
- **Logo:** not decided yet (placeholder for now).
- **Colors:** light + dark theme, user can pick an accent color, default sky blue (D018).
- **Coding:** do NOT start coding until the owner explicitly says "go ahead".
- **Accent colors:** sky blue (default), blue, purple, pink, red, orange, green, teal.
- **GitHub:** owner has an account.
- **Windows:** no Windows PC; GitHub builds/tests Windows daily.
- **Decisions:** owner accepted all decisions D001–D019.

## Session log

### 2026-10-10: Session 3 (F00 T19 GitHub checks)
- **T19 done (milestone):** every Pull Request now runs six checks on GitHub (code checks; unit + integration tests with coverage; desktop window tests; component screenshots + accessibility; security: vulnerable libraries, secrets in the whole history, Semgrep code scan; backend container). A failing check posts a "Do not merge" comment showing the lines before each error. A Windows check runs nightly when `main` changed. Every GitHub action is pinned to an exact version.
- **Proven on GitHub (owner approved three PRs):** draft PR #3 (the real F00) is all green; throwaway #4 (forbidden `console.log`) went red with the comment; throwaway #5 (`lodash@4.17.20` + `eval`) failed the security check. #4 and #5 are closed and their branches deleted.
- **Found by the first GitHub runs and fixed:** coverage-rule sample projects weren't in Git (a folder named `coverage` is ignored), the backend container couldn't reach the services on Linux (now joins their network), a real start-up bug (a light/dark switch during start-up was missed), and one desktop test really opened the browser (now recorded instead). Notes in `docs/runbooks/ci.md`.

### 2026-10-10: Session 3 (F00 T18 backend container)
- **T18 done:** the backend can now be packed into a container image (the format used to run it online later). `pnpm check:container` builds it, starts it against the local services and confirms: healthy, runs as a normal (non-root) user, no `.env` inside, and a secret scan of its files finds nothing. Passed on the owner's Mac. The image installs our packages the same way as on the Mac (the design's `pnpm deploy` would have broken Node's built-in TypeScript support); design updated.

### 2026-10-10: Session 3 (F00 T17 licenses and library updates)
- **T17 done:** `pnpm check` now also checks every library's license (800 packages: all fine). Copyleft licenses (GPL, AGPL, LGPL, SSPL) and unknown ones fail, naming the library. Three exceptions are written down with reasons: two development-only code-checking parts (LGPL) and Sentry's command-line helper (FSL: only forbids competing with Sentry). Dependabot will open one update Pull Request per area each week (libraries, service images, the backend image, GitHub Actions). TC-F00-70 (a real Dependabot PR) can only be confirmed on GitHub a week after these settings reach `main`.

### 2026-10-10: Session 3 (F00 T16 the test command)
- **Owner answered the port question:** MeetApp moved to spare ports in the local `.env` (database 5433, cache 6380, backend 3010); the owner's own PostgreSQL, Redis and Open WebUI keep running.
- **T16 done:** `pnpm test` runs everything in one go: starts the services (or stops at once if Docker is off), all unit and integration tests with one coverage report, then the real-window tests against a running backend, including the flag test (switching `demo` off hides it within 30 s, no restart). Prints a ✓/✗ summary. Result on the owner's Mac: 781 tests + 16 window tests pass; business-logic coverage 92–99% (rule: at least 80%, checked per folder group; a test proves 70% fails and 80% passes). `pnpm test:unit` is the quick run without Docker.
- To reach the coverage rule honestly: new direct tests for the backend's connections (database, cache, call server, storage, flags), edge-case tests for the design-token tools, and the contrast math simplified (same results).

### 2026-10-10: Session 3 (F00 T15 desktop app)
- **Decision D039 (owner chose):** the desktop app is built with plain Vite instead of electron-vite (its Vite 8 version is still a beta).
- **T15 done (milestone):** `apps/desktop`, the Electron window around the screens. `pnpm desktop` opens it; `pnpm dev` starts it with the services. Locked down: sandbox and isolation on, no Node.js in pages, every permission/device/download refused, no navigation or new windows outside the app (https links go to the browser), strict Content Security Policy, built screens served from app://meetapp only. Sentry only with `SENTRY_DSN` and without personal data. 15 real-window tests (`pnpm test:e2e`) and 33 unit tests; 736 unit tests in total pass.
- Found and fixed along the way: the window never opened (waiting for "ready" at the top level deadlocks Electron); in development the security policy blocked the dev server's live-reload script (now allowed by a development-only nonce); VS Code's terminal setting ELECTRON_RUN_AS_NODE starts Electron without a window (all start scripts remove it).
- **Security audit:** no critical issues in the new code; 3 medium and several small findings, all fixed (D040). It also found 2 critical flaws in a library inside the lint tools: fixed by forcing the patched version; lint tools are now marked as development tools. Two development-only advisories remain, accepted in D040. Packaging hardening (Electron fuses) is listed in D040 for F04.
- The flag test in the real window (TC-F00-72) moves to T16, which sets up the test backend it needs.

### 2026-10-10: Session 3 (F00 T14 first app screens)
- **Decision D038 (owner approved):** cheaper models for simple helper jobs (Haiku for docs-keeper, `/spec-status`, `/save-progress`; Sonnet for test-writer and the UI, code-quality and acceptance reviewers; Opus for security, spec review and the main work).
- **T14 done:** `apps/web`, the app's screens. A starter home screen (MeetApp name, welcome line, Settings button) and the Settings screen's Appearance section (Light / Dark / Same as my computer, 8 accent colors, a preview). Choices apply at once, are remembered on this computer, and are in place before the first paint (no wrong-theme flash). Broken saved values fall back to the defaults. Feature switches are checked every 15 s; anything unknown or failing means off. All text comes from the translation file (a test checks every key). Fonts are bundled. `pnpm dev` now also starts the screens and lists their address. New rule: only screens may use the app's data and state code. UI and code-quality reviews: no must-fix items; useful suggestions applied (focus moves to the new screen's title, clearer screen-reader labels). 703 unit tests pass.
- The gallery's own test files are now type-checked too; this found and fixed a wrong import in the T13 code.

### 2026-10-10: Session 3 (F00 T13 screenshot and accessibility check)
- **T13 done (milestone):** `pnpm test:visual` builds the gallery and checks all 70 stories in light and dark (140 pictures) against approved pictures, plus an accessibility scan of each: 0 problems found. It runs inside the official Playwright 1.63.0 Linux image (the same as CI will use, so pictures match exactly). `pnpm test:visual:update` makes new pictures after an intended change. Proven: a 4-pixel padding change on the Button fails with before, after and difference pictures; a button without a name fails the accessibility scan. 600 unit tests pass.
- Details are in design.md section 8 ("Details settled in T13"). TC-F00-35 wording updated: the unnamed-button proof removes the name inside the test instead of adding a broken story to the gallery.

### 2026-10-10: Session 2 (F00 T2 code-quality tooling, T3 commit safety, T4 local services, T5 start command, T6 database, T7 backend core, T8 health and services, T9 flags and observability, T10 design tokens, T11 UI atoms, T12 Settings components)
- **T2 done:** the automatic code checker is set up and `pnpm check` runs it all: lint rules (size limits, no `any`, no `console.log`, accessibility, translations, our own "no raw colors" rule, a reason required to switch any rule off), formatting, type checks, architecture rules (Atomic levels, backend layers), unused code and copy-paste detection. The after-edit hook is now active. 76 tests pass.
- **Decision D034:** TypeScript 7 does the type checks; lint tools use the official TypeScript 6 compatibility package (typescript-eslint doesn't support 7 yet). ESLint 9, because the accessibility plugin doesn't support ESLint 10 yet.
- **T3 done:** every commit now runs a secrets check first (gitleaks from Docker, pinned version). A password or key in a commit is blocked, naming the file and line. Without Docker running, commits stop with "Start Docker to run the secrets check". Then changed files are formatted and linted. 87 tests pass.
- **T4 done:** the local services run in Docker: LiveKit (calls), PostgreSQL with pgvector (database), Redis (cache and job queue), file storage and Mailpit (fake inbox). Only this computer can connect, and data survives restarts. Every setting is explained in `.env.example`.
- **Decision D035:** MinIO's free images were withdrawn, so file storage uses **RustFS** instead (free, same S3 language and ports, web file browser at http://127.0.0.1:9001).
- **Found on the owner's Mac:** a separate PostgreSQL (port 5432), Redis (port 6379) and an Open WebUI container (port 3000) are already running. They clash with MeetApp's default ports. The T5 start command will detect this and explain the choices.
- **T5 done (milestone):** `pnpm dev` checks Docker, creates `.env` if missing, checks every port (naming the clash and the fix within a second), starts the services and prints their addresses. A second `pnpm dev` while running works. `pnpm dev:stop` stops the services and keeps the data. 115 tests pass.
- **Owner's first `pnpm dev`:** preflight stopped it (Node 20 from nvm instead of Node 24). Fixed by turning mise on in the owner's terminal: one line added at the end of `~/.zshrc` (backup in `~/.zshrc.backup-before-mise`). nvm and pyenv still work outside MeetApp. Added to the T21 getting-started notes.
- **T6 done:** database package with the `feature_flags` table and automatic migrations. `pnpm seed` / `pnpm seed:clear` load and remove sample flags; `pnpm flag <key> on|off` and `pnpm flag list` switch features, refusing bad input before touching the database. 147 unit + 46 integration tests pass.
- **T7 done:** the backend (`apps/api`) starts on 127.0.0.1, refuses to start if a setting is missing (naming it, never showing values), updates the database automatically, gives every request an id, answers errors in one safe format (no stack traces or input), keeps passwords/emails/tokens out of the logs, allows only the app's own origins, and shows API docs at `/docs` in development only. The database package now uses the `pg` driver the design names. 229 unit + 134 integration tests pass.
- **T8 done:** the backend connects to the database, cache, call server, file storage and email. `GET /api/v1/health` answers within 2 s with `ok`/`down` per service (200 or 503). Stopping and restarting the database or cache is detected within 5 s and recovered within about 2 s, without restarting the backend. `pnpm storage:test` and `pnpm email:test` check storage and email. `pnpm dev` now also starts the backend. 257 unit + 174 integration tests pass.
- **T9 done:** `GET /api/v1/flags` lists the feature switches (changes visible within 10 s), `GET /metrics` gives Prometheus numbers (requests, response times, database connections, cache status, CPU/memory), tracing to the monitoring tools and Sentry crash reports start only when their setting is filled in. **Decision D036:** Sentry 11 collects personal data by default, so every collection category is switched off explicitly. 287 unit + 205 integration tests pass.
- **T10 done:** owner approved the color fix (D037): design system version 8 has dark `line-strong` #637282, copied into MeetApp; contrast check passes for all 208 pairs. Also fixed: mise's `activate_shims` made `python3` loop outside MeetApp; turned off in `~/.config/mise/config.toml`. Details: `packages/design-tokens` with the approved `tokens.json` (hash-checked), generated `tokens.css` (identical to the design system's 134 variables), the Tailwind theme with only token classes (`bg-blue-500` produces nothing) and a contrast check over 8 accents × 2 themes. It found one failing pair in the approved design, fixed by D037. The no-raw-color rule now also catches named colors like `"red"`.
- **T12 done:** atoms Input (label, hint, error), Toggle (on/off switch), Avatar (photo or initials, green ring while speaking) and Badge (status words), and the Settings molecules SegmentedControl (theme choice) and AccentPicker (8 colors). Both choosers work like standard radio groups: one Tab stop, arrow keys to choose. Everything is ready for right-to-left languages, and no component has its own English text. Two reviews (UI and code quality) found no must-fix items; the useful suggestions were applied. 596 unit + 288 integration tests pass.
- **T11 done:** `packages/ui` with Storybook (light/dark and 8-accent toolbar, accessibility check, hover/focus states) and the atoms Button, IconButton, Icon (Lucide icons under the design system's names), Spinner and Tooltip, with bundled Figtree and JetBrains Mono fonts. A UI review found 2 must-fix items (spinner speed, spinner announcement) and several smaller ones; all fixed. 478 tests pass.
- **Follow-ups for a dependency update:** ESLint 9 is no longer supported (move to ESLint 10 with `eslint-plugin-jsx-a11y-x`, which supports it); `prom-client` is replaced by `@prometheus-io/client`.
- A code-quality review found no must-fix items. The useful suggestions were applied; ones that need apps that don't exist yet are noted under T10 and T14 in tasks.md.

### 2026-10-09: Session 1 (architecture review)
- Solution-architecture review of the setup. Fixed: Claude's shell now uses the locked Node 24 (session-start hook), progress.md trimmed with history archived, tests for every hook, coding also requires a feature with approved tasks, Context7/Playwright/Postgres MCP enabled, faster lint hook. New skills: /fix-ci, /deps-update, /add-dependency, /db-migration (D032).

### 2026-10-09: Session 1 (building starts)
- Owner approved F00 design, tests and tasks. Building on branch `feat/F00-foundation`.
- **T1 done:** mise installed (Homebrew); Node 24.21.0, pnpm 10.34.6, Python 3.12.15 pinned in mise.toml; workspace, shared TS config, preflight version check, structure check; containers reach the Mac via host.docker.internal (verified). 8 tests pass.

### 2026-10-09: Session 1 (F00 plan ready)
- F00 requirements approved + coding go-ahead. Wrote F00 design (reviewed by spec-reviewer, 13 must-fix items applied), tests.md (93 test cases, all ACs covered, by test-writer), tasks.md (21 steps). Owner decisions: Gatus, seed scope, macOS per Docker, free-plan merge guard (D030, D031). Waiting for owner approval of design + tests + tasks, then building starts on `feat/F00-foundation`.

### 2026-10-09: Session 1 (design approved)
- Owner approved the 8 screen designs. F00 requirements updated to follow the approved design system (D029): exact tokens, atoms as designed, fonts bundled offline. Waiting for owner approval of F00 requirements.

Older sessions: [history/progress-archive.md](history/progress-archive.md)
