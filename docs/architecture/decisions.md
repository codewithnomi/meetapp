# Decisions Log

Each important decision, with the reason. New decisions go at the bottom.
Status: **accepted** (decided) or **proposed** (waiting for the owner's OK).

---

### D001: Documents first, code second
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Every feature gets a written spec, approved by the owner, before any code.
- **Why:** The owner isn't a programmer and Claude's memory resets between sessions. Written documents keep everything clear and nothing gets lost.

### D002: Desktop app first
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Build order: desktop, then web, then mobile.

### D003: Electron for the desktop app (not Tauri)
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Use Electron.
- **Why:** Electron includes Chrome's calling engine (WebRTC), which is the most tested one. It's also what Discord and Slack use. Tauri uses each operating system's own browser engine, and calling support there is inconsistent (weak on Linux). Call quality depends mostly on the call server and the internet connection, not on the app framework.
- **Downside:** bigger app size (~100 MB) and more memory. We accept this for call quality.

### D004: LiveKit as the call server, self-hosted
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Use LiveKit (open source). Run it ourselves in Docker on the owner's computer during development (D017), and on our own servers later.
- **Why:** Built for large meetings (sends each viewer only the video quality they need). Running it ourselves on cheap servers is the biggest cost saving, since internet traffic is the main cost of video calls.

### D005: TypeScript as the main language, Python only for AI
- **Status:** accepted (2026-10-09, owner; updated by D019: mobile uses Flutter/Dart)
- **Why:** One language for desktop, web and backend means less to learn and maintain. Python has the best speech/AI tools.

### D006: PostgreSQL + pgvector instead of a separate vector database
- **Status:** accepted (2026-10-09, owner)
- **Why:** One database for everything is cheaper and simpler. pgvector handles millions of transcript pieces. We can move to a dedicated vector database (e.g. Qdrant) later if needed.

### D007: Transcribe each person's audio separately
- **Status:** accepted (2026-10-09, owner)
- **Why:** This gives 100% correct speaker names without guessing. Known limitation: if several people share one microphone in a meeting room, they appear as one speaker.

### D008: Cloud AI by default, local AI as an option
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Default is Deepgram (speech-to-text) and Claude (AI). Optional "Local AI mode" uses Whisper and Ollama on the user's computer.
- **Why:** Cloud gives the best quality, and transcript quality is critical. The local option is for privacy-focused customers. Local AI answers are weaker, and the app will say so.

### D009: AI actions always need user confirmation
- **Status:** accepted (2026-10-09, owner)
- **Why:** Creating tickets or sending messages in other tools must never happen by mistake.

### D010: Every feature is tested and security-checked before it's called done
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Test cases are written as `tests.md` before coding. Automated tests are written with the code. When a feature's last task is done, `/spec-verify` automatically runs **all** tests (old features too), checks every acceptance criterion, and runs a security audit.
- **Why:** to catch errors and security holes early, and to make sure new features never break old ones.
- **Tools:** Vitest (TypeScript tests), pytest (Python tests), Playwright (clicking through the real app), `pnpm audit` / `pip-audit` (vulnerable libraries), gitleaks (leaked secrets). Later: run all of this automatically on every code upload (GitHub Actions).

### D011: Atomic Design for the React UI, shared design system
- **Status:** accepted (2026-10-09, owner)
- **Decision:** UI built in levels (tokens → atoms → molecules → organisms → templates → pages) in a shared `packages/ui`, documented in Storybook. Rules in `docs/engineering/frontend.md`, enforced by a lint rule and the `ui-reviewer` helper.
- **Why:** consistent look, reusable parts across desktop/web, easier testing and documentation.

### D012: Frontend libraries
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Tailwind CSS + CSS-variable tokens, Radix UI (accessible base parts), TanStack Query (server data), Zustand (app state), React Hook Form + Zod (forms), i18next (languages), Storybook (component docs).
- **Why:** widely used, well documented, accessible, and Claude knows them very well.

### D013: GitHub + CI checks on every change
- **Status:** accepted (2026-10-09, owner)
- **Decision:** private GitHub repo, branch + Pull Request per task, Conventional Commits, GitHub Actions running build, lint, tests, security scans and the Storybook build. Nothing reaches `main` without passing.
- **Why:** catches problems automatically, before they reach users.

### D014: Three environments: local, staging, production
- **Status:** accepted (2026-10-09, owner)
- **Why:** test safely online (staging) before real users see changes.

### D015: Monitoring with Sentry + Prometheus/Grafana
- **Status:** accepted (2026-10-09, owner)
- **Why:** see crashes, call quality and costs in real time; LiveKit supports Prometheus natively.

### D016: Foundation feature (F00) before user features
- **Status:** accepted (2026-10-09)
- **Why:** project setup, CI, design system basics and environments must exist before F01, so every feature is built the production-grade way from the first line.

### D017: Free way first, nothing deployed yet
- **Status:** accepted (2026-10-09, owner)
- **Decision:** During development everything runs **on the owner's computer** and uses only free tools:
  - Call server (LiveKit), database and Redis run locally in Docker (free).
  - GitHub free plan for code and automatic checks (CI).
  - Desktop app is **not signed** for now (no Apple/Windows certificates). On Mac you open it with right-click → Open the first time. Signing is only needed before giving the app to real users.
  - No domain: meetings are tested locally (`localhost`).
  - AI features: use free options first: **local Whisper** (speech-to-text) and **Ollama** (local AI) on the owner's computer, plus free starting credits from cloud providers (e.g. Deepgram) where available. Claude API needs paid credits; ask the owner before using it.
  - Sentry free plan for error tracking when needed.
- **Why:** prove the product works before spending money.
- **Later:** paid accounts (Apple Developer, code signing, hosting, domain) when we're ready for real users.

### D018: Themes: light/dark + user-selectable accent color, sky blue by default
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Every user can choose **light, dark, or "same as my computer"**, and an **accent color** from 8 options: sky blue, blue, purple, pink, red, orange, green, teal. Default: **sky blue**. The choice is saved to the user's account, so it follows them across devices (until F01 adds accounts, it's saved on the device only).
- **How:** all colors are design tokens (CSS variables); changing the theme just swaps the variables. Every accent color is checked for readable contrast in both light and dark mode.
- **Logo:** placeholder until a logo is chosen.

### D019: Flutter for the mobile app (not React Native)
- **Status:** accepted (2026-10-09, owner)
- **Decision:** The iPhone/Android app (F11) is built with **Flutter**.
- **Why:** The owner had bad experiences with React Native, where a design fixed for iPhone breaks on Android. Flutter draws every pixel itself, so screens look identical on both. LiveKit has an official Flutter SDK, so call quality is the same.
- **Keeping things consistent across languages:**
  - **Design tokens** (colors, spacing, fonts, themes from D018) live in one shared file and are automatically converted to CSS (desktop/web) and a Dart theme (mobile).
  - The mobile app talks to the backend through an **API client generated automatically** from the backend's OpenAPI description, so it can't drift from the server.
  - Atomic Design applies in Flutter too (atoms, molecules, organisms as widgets).
- **Why not Flutter for desktop and web too:** the desktop calling engine in Electron (Chrome's) is more proven for big calls and screen sharing, and Flutter web apps are heavy and weaker for text-rich pages (transcripts, minutes). We keep Electron/React for desktop and web.
- **Downside:** mobile code is in a second language (Dart) and can't reuse React components. Acceptable, since mobile comes last (Phase 4).

### D020: Sign in with Google and Microsoft (plus email)
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Users can sign up / sign in with email, **Google** or **Microsoft** accounts (Microsoft covers work accounts too, important for companies). Built with Better Auth; both providers are free to set up. Detailed in the F01 spec.
- **Note:** when the iPhone app ships (F11), Apple requires **"Sign in with Apple"** too if other social logins are offered. It's planned for then.

### D021: Clean code and design patterns are enforced
- **Status:** accepted (2026-10-09, owner)
- **Decision:** `docs/engineering/code-quality.md` defines principles, patterns (Repository, Service layer, Dependency injection, Strategy/Adapter, Factory, Observer, Atomic Design) and hard limits (function/file size, complexity, duplication, no `any`, no unused code). Enforced by a Claude hook after every edit, CI on every Pull Request, and the `code-quality-reviewer` helper in `/spec-verify`.
- **Why:** the app must stay easy to change as it grows.

### D022: Added features from the production-readiness review
- **Status:** accepted (2026-10-09)
- **Decision:** Added **F13 Scheduling & calendar** (Phase 1), **host controls** (waiting room, mute others, remove, lock) to F02, a **meetings library** to F06, a **personal workspace** for individual users to F01, and **`meetapp://` links that open the desktop app** to F04.
- **Why:** these are expected by anyone coming from Teams/Zoom.

### D023: Production essentials added to the foundation
- **Status:** accepted (2026-10-09)
- **Decision:** Local fake inbox (Mailpit) for emails, feature flags, visual screenshot tests, license checks, Dependabot updates, and a TURN relay for calls behind firewalls (when online). Privacy-friendly analytics with F10.
- **Why:** standard practice for production apps; all free.

### D024: Claude enforces the rules with hooks, not just instructions
- **Status:** accepted (2026-10-09)
- **Decision:** Hooks block code edits before the owner's go-ahead, block commits/pushes to `main` and force pushes (instead of GitHub branch protection, which free private repos lack), and notify the owner on the Mac when input is needed. Code map in `docs/engineering/project-structure.md`; each app gets its own small CLAUDE.md in F00.
- **Why:** written rules can be forgotten in long sessions; hooks can't be.

### D025: Infrastructure stages and tool versions
- **Status:** Stage 1 accepted, rest proposed (2026-10-09)
- **Decision:** See `docs/architecture/infrastructure.md`. Everything local for now; tool versions locked with mise (**Node 24 LTS**, since Node 20 on the owner's Mac is past end-of-life; Python 3.12); MinIO for local file storage (later replaced by RustFS, D035); LiveKit Cloud free tier when testing calls with people elsewhere; Hetzner + Cloudflare when going live.

### D026: Automatic commit, push and Pull Request
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Claude commits and pushes after every finished task (feature branch `feat/FXX-name`). When `/spec-verify` passes, Claude opens the Pull Request automatically and waits for CI; the owner clicks **Merge**. A failed verification never opens a PR. Document-only changes are pushed/PR'd by `/save-progress`. Pushes to `main` and force pushes stay blocked by a hook.
- **Why:** nothing is lost, no extra commands for the owner; the merge click is the last human check (free private repos have no branch protection).

### D027: Monitoring from day one: Gatus (status page, see D030), Prometheus, Grafana, Loki, Tempo (OpenTelemetry), optional Sentry
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Built in F00 as a local Docker "monitoring" profile, then reused unchanged on servers. Status page = what's down; dashboards, logs and traces = why. Alerts via notification/email. Claude reads them through `/diagnose`.
- **Why:** the owner wants to see in real time what is down and why, and problems are cheaper to fix when caught early.

### D028: Database access for Claude via Postgres MCP (read-only)
- **Status:** accepted (2026-10-09)
- **Decision:** `postgres-mcp` in restricted (read-only) mode, connected only to the local database. Claude can inspect tables, data, slow queries and indexes, but cannot change or delete anything. Schema changes only through migration files (a hook blocks editing old migrations).
- **Later MCPs:** Sentry MCP (when a Sentry account exists) and Grafana MCP (query metrics/logs) are added when those services are in use.

### D029: Design first: design system, then screens, then code
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Before coding, the look is designed with Claude's design tools and approved by the owner:
  1. **Design system** (colors in light/dark with 8 accents, fonts, spacing, Atomic components): https://claude.ai/artifact/K9GV7yg9Y4QkNJ7VgAb3PJ
  2. **Screen designs** on a design canvas (sign in, home, pre-join, meeting room, minutes, Ask AI, settings): https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ
     - F01 "Accounts and workspaces" section (11 screens: password step, create account, code entry, new password, workspace switcher, create workspace, join a workspace, people, requests and invitations, profile and account, invitation web page) approved by the owner on 2026-10-11.
  F00 then builds `packages/design-tokens` and the atoms **exactly** from the approved design system; each feature's design.md links its screens. `ui-reviewer` checks built screens against them.
- **Fonts:** Figtree (interface) + JetBrains Mono (codes, timestamps), both free (Google Fonts).
- **Why:** changing a design takes minutes; changing built code takes hours.

### D030: F00 tooling choices
- **Status:** accepted (2026-10-09, owner approved the Gatus change)
- **Decision:** **Gatus** instead of Uptime Kuma for the status page (configured from a file kept in Git, alerts by email/webhook); **Grafana Alloy** to collect logs/traces/container metrics; **MinIO** pinned to an exact release (its community Docker images are no longer updated); **electron-vite** to build the desktop app; **React 19**; **Tailwind v4** with a theme generated from the design tokens; **Lucide** icons (mapped to the design system's icon names); fonts bundled via **fontsource**; **gitleaks** run from its Docker image (nothing installed on the Mac); **husky + lint-staged** for commit checks; **Semgrep** community rules in CI.
- **Why:** all free, widely used, configured as code, and they keep the owner's Mac clean.

### D031: Merge guard on GitHub's free plan
- **Status:** accepted (2026-10-09, owner)
- **Decision:** Stay on the free plan. Claude never opens or recommends merging a Pull Request with a failing check, and failing runs post a "Do not merge" comment. GitHub Pro (~$4/month, hard block) can be added later.

### D032: Architecture review: guard rails for smooth development
- **Status:** accepted (2026-10-09)
- **Decision:** A session-start hook puts mise's locked tools on Claude's PATH. `progress.md` is kept short (5 newest sessions; older entries go to `docs/history/`). Every hook has automated tests (`tools/hooks.test.ts`). Code edits also require a feature with approved tasks in progress. Context7, Playwright and Postgres MCP are enabled for the project. The lint hook uses a cache. New skills: `/fix-ci`, `/deps-update`, `/add-dependency`, `/db-migration`. VS Code extension recommendations added.
- **Why:** remove the recurring sources of friction (wrong tool versions, context bloat, silent hook breakage, stale library knowledge, CI and dependency toil, risky database changes) before they cost development time.

### D033: Build pace: pause at milestones
- **Status:** accepted (2026-10-09, owner)
- **Decision:** During building, Claude continues from task to task on its own (each tested, committed, pushed, with a one-line update) and pauses only at milestones the owner can see or try, on failures it can't fix, or when a decision, cost or install is needed. Milestone tasks are marked "(milestone)" in tasks.md.

### D034: TypeScript 7 for type checks, TypeScript 6 for lint tools; ESLint 9
- **Status:** accepted (2026-10-10, made during F00 T2; owner informed)
- **Decision:** Type checking uses **TypeScript 7** (the new, much faster compiler), installed under the name `@typescript/native`, so `tsc` is TypeScript 7. Lint and analysis tools (typescript-eslint, knip, dependency-cruiser) need the older TypeScript programming interface, so the `typescript` package name points to Microsoft's official compatibility package **`@typescript/typescript6`** (set in `pnpm-workspace.yaml`). This is the setup typescript-eslint itself recommends. **ESLint 9** (still maintained) is used instead of ESLint 10, because the accessibility plugin `eslint-plugin-jsx-a11y` does not support ESLint 10 yet.
- **Why:** typescript-eslint refuses to run on TypeScript 7. This keeps fast type checks and working lint rules. Revisit when typescript-eslint supports TypeScript 7 (their issue #10940) and jsx-a11y supports ESLint 10; `/deps-update` checks this.

### D035: RustFS replaces MinIO for local file storage
- **Status:** accepted (2026-10-10, made during F00 T4; owner informed). Changes part of D030.
- **Decision:** Local file storage uses **RustFS** (`rustfs/rustfs`, Apache-2.0 license, version 1.0.1), pinned by version and digest. It speaks the same "S3" language as Cloudflare R2, uses the same ports (9000 for the app, 9001 for a web file browser) and keeps files in a named Docker volume. The app's bucket is created by the storage service's own health check, so "healthy" means "ready to use" and no extra setup container is needed.
- **Why:** MinIO's free Docker images are no longer available: the Docker Hub copy was removed and its other registry now requires a login. RustFS was built as a drop-in replacement for MinIO. SeaweedFS (also free) was the alternative; it is older but less of a drop-in. Because the app only talks "S3", switching storage later needs no code changes.

### D036: Sentry 11 privacy settings, and observability details
- **Status:** accepted (2026-10-10, made during F00 T9; owner informed)
- **Decision:** Sentry 11 removed `sendDefaultPii` and now collects user info, cookies, headers, request bodies and more **by default**. MeetApp sets Sentry's `dataCollection` with **every category off**, and still strips request data, cookies, headers and user in `beforeSend` as a second safety net. Sentry 11 also no longer sets up its own tracing, so the design's "skip OpenTelemetry setup" option is unnecessary. Tracing and Sentry start from `apps/api/src/instrumentation.ts`, loaded before the backend, and only when their setting is filled in.
- **Why:** error reports must never contain personal data (security rule S10, AC-F00-22). Relying on a changed default would have silently sent it.

### D037: Design system fix: dark control borders reach 3:1
- **Status:** accepted (2026-10-10, owner approved)
- **Decision:** In the approved design system, dark-mode `line-strong` changes from #5d6b7b to **#637282**. Published as design system version 8; `packages/design-tokens/tokens.json` copied from it (new SHA-256 in the package README).
- **Why:** the contrast check in F00 T10 found dark `line-strong` on `surface-raised` at 2.88:1, below the 3:1 that both WCAG and the design system's own text require for control borders. #637282 gives 3.18:1 and looks almost identical.

### D038: Cheaper models for simple helper jobs
- **Status:** accepted (2026-10-10, owner approved)
- **Decision:** each helper names its model. **Haiku** (fast, cheapest): `docs-keeper`, `/spec-status`, `/save-progress`. **Sonnet** (middle): `test-writer`, `ui-reviewer`, `code-quality-reviewer`, `ac-verifier`. **Opus** (most capable): `security-auditor`, `spec-reviewer`, and the main conversation (design, building, hard bugs).
- **Why:** saves usage on routine checks and status updates; security and spec gaps are where a miss costs most, so they keep the strongest model.
- **Risk:** a cheaper reviewer may miss something. spec-verify still runs the Opus security audit before any feature is `done`; if a cheaper helper misses things, move it back up.

### D039: Desktop app built with plain Vite instead of electron-vite
- **Status:** accepted (2026-10-10, owner chose it during F00 T15). Changes part of D030.
- **Decision:** `apps/desktop` builds its main process (ES module) and preload (CommonJS) with Vite 8's own build API in a small script. The screens are built and served by `apps/web` as they already are: in development Electron loads the Vite dev server (127.0.0.1:5173); otherwise it serves `apps/web/dist` from the `app://meetapp` scheme.
- **Why:** electron-vite's stable release (5.0) supports Vite only up to 7, and our screens use Vite 8. Its Vite 8 version is still a beta that changed six times in two weeks. The replacement is about 50 lines we own, using only stable tools.
- **Cost:** none. Packaging (F04) uses electron-builder on the built output either way.

### D040: Desktop privacy and security hardening from the T15 audit
- **Status:** accepted (2026-10-10, F00 T15; owner informed).
- **Decision:**
  - **Crash reports (Sentry, only with `SENTRY_DSN`):** no Sentry bridge in the pages (no injected preload, no `sentry-ipc://` scheme); native crash dumps off (they hold raw memory that can't be cleaned); console messages never collected; addresses in reports cut to their origin; every data category off (D036).
  - **Development settings** (`MEETAPP_RENDERER_URL`, `MEETAPP_USER_DATA_DIR`, `VITE_API_URL`) are ignored by the packaged app; a dev server must be on this computer, and the backend must be on this computer or use https.
  - **Extra guards:** redirects and frame navigation checked like navigation; download requests refused (camera, microphone and screen: see the F02 update below); screen-share requests refused (**updated by F02 T10, 2026-10-15:** camera, microphone and screen capture are allowed only for the app's own page in the window's top frame; the screen goes only to the source chosen in our picker, once, within 10 seconds, never with computer sound; speaker choice allowed for the same page; **added 2026-10-19 (F02 verification):** writing to the clipboard (`clipboard-sanitized-write`, for the Copy buttons) for the same page, never reading it; every other permission and every other site still refused; the CSP's `connect-src` adds the call server); `form-action 'none'` added to the CSP; app:// answers only for host `meetapp` and never follows a shortcut out of the screens' folder; `app.enableSandbox()`.
  - **Lint tools are devDependencies** of `@meetapp/config`, so `pnpm audit --prod` reports only what ships. `handlebars` is forced to ≥ 4.7.10 (2 critical fixes).
  - **Accepted for now (development tools only, never shipped):** `braces` ≤ 3.0.3 inside the lint plugin (slowdown risk, no fixed version exists yet); an old `esbuild` inside drizzle-kit (the issue only affects esbuild's own dev server, which we don't run). Re-checked by `/deps-update`.
- **Why:** the security audit of T15 found these; none were critical in our code, all were small to fix now.
- **For F04 (packaging):** Electron fuses `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off, `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on, `OnlyLoadAppFromAsar` on, `EnableCookieEncryption` on, `GrantFileProtocolExtraPrivileges` off; hardened runtime with only camera and microphone entitlements; DevTools off when packaged; signed updates (S18). For F02/F03: camera and microphone through an allow-list by permission and origin; outside links from chat through a confirmation.

### D041: How local monitoring collects, alerts and is tested
- **Status:** accepted (2026-10-10, F00 T20; owner informed). Refines D030.
- **Decision:**
  - **One collector:** Grafana Alloy gathers every number (the backend, LiveKit, and its built-in exporters for PostgreSQL, Redis, containers and the Docker disk) and pushes it to Prometheus, which only stores. No separate postgres-exporter or redis-exporter images. File storage (RustFS) has no metrics endpoint, so only the status page watches it.
  - **Only MeetApp's containers:** logs and CPU/memory are collected only from containers of the `meetapp` Docker project. Other programs the owner runs in Docker (e.g. Open WebUI) are never read.
  - **Alert timing:** checks every 30 s, alert after **3** failed checks in a row (60–90 s after a stop = "down for more than a minute"), "recovered" after 2 good checks. The design's earlier `2` would have alerted after only 30–60 s.
  - **Older `.env` files are filled in:** `pnpm dev`, `pnpm test` and `pnpm monitoring` add any setting that `.env.example` has and `.env` lacks (with its comment), and say so. Existing values are never changed. Without this, Docker refuses to start anything once a new setting is added.
  - **Slow checks run separately:** the monitoring checks (TC-F00-84 to 89) stop services and wait for alerts, about 12 minutes, so they run with `pnpm test:monitoring`, not in `pnpm test` or CI. Fast unit tests check the settings files on every run.
  - **Access, local only (narrowed in T-fix-2):** Alloy is no longer privileged and no longer reads the whole disk. To read container numbers it still needs the Docker and containerd sockets (Docker Desktop's cAdvisor can't work without containerd), and either socket allows full control of Docker. A read-only Docker proxy was considered and left out, because the containerd socket would still give the same power. Accepted only because this is local and optional; revisit before anything runs online. "Only MeetApp's containers" is a filter in Alloy's settings, not a hard wall. Prometheus (9090) and the Alloy page (12345) have no login and no web-address check: on this Mac only, and accepted for local use; Grafana is the only one that enforces 127.0.0.1. Before anything runs online, they go behind a login.
  - **Other T-fix-2 protections:** a read-only `meetapp_monitor` database login (pg_monitor) for the monitoring; container logs cleaned in Alloy (emails and secrets masked, database error details dropped) and PostgreSQL errors logged briefly (a value inside an error message is masked by the cleaning step); secrets in web addresses hidden in logs and traces; Grafana answers only to 127.0.0.1; the notifier accepts only JSON sent to its own address; traces and logs go only to this computer or over https; `.env` readable only by its owner.
- **Why:** fewer images to pin and update; the owner's other programs stay private; the alert matches the requirement (AC-F00-44); an updated project keeps working on an older `.env`.
- **Cost:** none (all free, local only).

### D042: Getting-started walk-through by the owner skipped for F00
- **Status:** accepted (2026-10-10, owner: "it doesn't matter now, let's move forward").
- **Decision:** the manual check TC-F00-92 (someone follows `docs/getting-started.md` on a clean Mac) is not done for F00. Instead: Claude made a fresh copy of the project, installed it and started the screens following the guide's commands; that run found and fixed a real problem (the screens didn't load until the design tokens were built). The automated test TC-F00-93 checks that every command the guide mentions exists.
- **Why:** the owner's time; the main risk (a fresh copy not starting) was checked and fixed.
- **Follow-up:** repeat the walk-through when a second person or a new Mac joins. TC-F00-83 (data after a real Mac restart) stays open until the owner's next restart.

### D043: Libraries chosen while building F00
- **Status:** accepted (2026-10-11, recorded after the F00 documentation review; each was vetted when added).
- **Backend and data:** Fastify (web server), Drizzle ORM with the `pg` driver (database), ioredis (cache), Pino (logs), Zod (input and output checks, shared through packages/contracts), nodemailer (email), the AWS S3 client (files, works with RustFS and Cloudflare R2), livekit-server-sdk (call server), OpenTelemetry (traces and logs, with its http, pg, ioredis and pino instrumentation packages), prom-client (metrics), @sentry/node (optional crash reports), @fastify/cors, @fastify/swagger + @fastify/swagger-ui (API docs, development only), @fastify/type-provider-zod (Zod checks on routes).
- **App screens and desktop:** React 19 with Vite 8 (D039), Tailwind CSS v4 (styles from the design tokens), i18next + react-i18next (translations), Zustand (small app state), Radix UI (switch, tooltip, dropdown menu and dialog since F01 T14: accessible building blocks; MIT, versions pinned at least two weeks old), Lucide (icons), Fontsource (fonts bundled, nothing fetched from Google), Electron with @sentry/electron (optional crash reports).
- **Building and checking:** pnpm workspaces + Turborepo (one repository, tasks in order), Vitest (unit and integration tests), Playwright (desktop and gallery tests, pinned image for screenshots), Storybook (component gallery), axe-core (accessibility), ESLint + Prettier, dependency-cruiser (layer rules), knip (unused code), jscpd (duplication), gitleaks and Semgrep (security, via Docker), osascript (macOS's own tool for the Mac notifications).
- **Why:** free, widely used and maintained, permissive licenses (checked by `pnpm check:licenses`), and each does one job. New libraries still go through `/add-dependency`.
- **Cost:** none.

### D044: Owner's last two hands-on checks deferred for F00
- **Status:** accepted (2026-10-11, owner: "make it pending for later and move to the next phase").
- **Decision:** TC-F00-83 (data survives a real Mac restart) and TC-F00-90 (a Mac notification really appears when a service is down for over a minute, and on recovery) are deferred; F00 can be verified and merged without them. Their behaviour is covered automatically: TC-F00-82 (services stopped and started keep their data) and TC-F00-88 (the notifier receives the "down" and "recovered" calls).
- **Follow-up:** the owner does them when convenient (instructions and the data snapshot are in progress.md); any problem becomes a fix on the next feature branch.

### D045: F01 account and workspace choices
- **Status:** accepted (2026-10-11, owner)
- **Decision:** anyone can sign up (email, Google, Microsoft); people join a company workspace by email invitation or by an invite link that the owner and admins can turn on, off or replace; **any member can invite** (members invite as member only, the owner and admins can also invite admins); two-step sign-in (authenticator codes) comes later with the admin console (F10).
- **Why:** open sign-up matches the vision (individuals and teams); invite links make onboarding quick while staying under the admins' control; letting members invite helps teams grow without waiting for an admin; Google and Microsoft sign-in already offer their own two-step protection, so F01 stays smaller.
- **Cost:** none (Google and Microsoft sign-in are free to set up).

### D046: F01 email links, invitations and member visibility
- **Status:** accepted (2026-10-11, owner)
- **Decision:** ~~links in emails (verify, reset password) open small MeetApp web pages~~ (replaced by D047: codes typed into the app; only the invitation email keeps a small web page); an **email invitation works only for the invited email address**; **every member sees the member list** with names, photos, emails, roles and join dates; ~~a removed person can rejoin through the invite link~~ (replaced by D047: using the join link or code sends a request that the owner or an admin approves, so a removed person can ask again and an admin decides).
- **Why:** the web pages work on any device (even a phone) without waiting for the web app (F10) or `meetapp://` links (F04); a forwarded invitation can't let a stranger in; coworkers can see who's in the workspace, like Teams and Slack; admins keep control by replacing the invite link.
- **Cost:** none.

### D047: F01 follows how Microsoft Teams handles accounts and joining
- **Status:** accepted (2026-10-11, owner: "update according to how Teams actually handles it")
- **Decision:** sign-in asks for the email first, then the password; confirming an email, resetting a password and (optionally) signing in without a password use a **6-digit code sent by email and typed into the app**, as Microsoft accounts do; a workspace's **join link and join code** (like a Teams team code) send a **request to join** that the owner or an admin approves or rejects, as for a private team in Teams; email invitations need no further approval. Replaces parts of D046 (email web pages for verify/reset; rejoining without approval).
- **Why:** people coming from Teams find the same steps; codes work in the desktop app without a web app (F10) or `meetapp://` links (F04); accounts exist only after the email is proven, which removes the risk of someone registering another person's email; approval keeps admins in control of who joins.
- **Sources:** Microsoft support, "Use a link or code to join a team"; Microsoft 365 message MC1437678 (join by code needs owner approval for private teams, rolled out Aug–Sep 2026).
- **Cost:** none.

### D048: How sign-in and workspaces are built (F01)
- **Status:** accepted (2026-10-11, owner approved F01 design.md; proposed, with F01 design.md)
- **Decision:** Better Auth (D020) is used for **identity only**: passwords (scrypt), email codes (emailOTP plugin), Google/Microsoft, sessions, sign out everywhere. **Workspaces, roles, invitations and join requests are our own module** (routes → service → repository) so our rules hold (one owner, any member can invite, approval for join requests) and every query filters by workspace (S2). The desktop app's sign-in token is kept **only in the Electron main process, encrypted with safeStorage** (Keychain), added to API requests as a bearer token and hidden from the page. Google/Microsoft use a **browser hand-off with a secret verifier** (the PKCE idea) that the app collects by polling, so no `meetapp://` link or local web server is needed. Sign-up is our own wrapper so an account exists only after the email code. Sign-in calls are made by the main process (the page never receives a token), and the browser hand-off shows a 4-digit match code the user confirms. **Remaining risk:** a user who is tricked into opening someone else's sign-in link *and* confirms a code without comparing it could sign the attacker's app in; the 60-second start window, the browser cookie and the code make this hard. Revisit with `meetapp://` links in F04. **Session tokens (T3):** Better Auth 1.7 stores session tokens readable, so a small wrapper around its database adapter stores only their SHA-256 fingerprint (AC-33).
- **Why:** Better Auth's organization plugin has different rules (several owners, only admins invite, no join requests) and bypasses our layers; keeping the token out of the page protects it from any script injected into a page.
- **Cost:** none.

### D049: New libraries for F01
- **Status:** accepted (2026-10-11, owner approved F01 design.md; proposed, with F01 design.md); each vetted with `/add-dependency` before it is added.
- **Decision:** `better-auth` (sign-in), `react-router` (screens), `@tanstack/react-query` and `react-hook-form` (already planned in frontend.md), `sharp` (photo resizing and removing location data), `oauth2-mock-server` (dev only: a fake Google/Microsoft for tests), **BullMQ** (background jobs: emails and the daily join-request expiry; already named in overview.md, worker inside the API for now), and a list of the 10,000 most common passwords (offline check).
- **Why:** widely used, maintained, free, permissive licenses; each does one job.
- **Vetted (T1, 2026-10-11):** better-auth 1.7.7 (MIT; design written against 1.6 docs, re-checked in T3), bullmq 6.3.12 (MIT), sharp 0.35.5 (Apache-2.0), react-router 8.4.0 (MIT), @tanstack/react-query 5.104.1 (MIT), react-hook-form 7.89.0 + @hookform/resolvers 5.9.1 (MIT; Zod forms, frontend.md), oauth2-mock-server 9.2.0 (MIT, dev only); common passwords from **@zxcvbn-ts/language-common** 4.1.3 (MIT, its password dictionary, first 10,000 used). All released within the last 2 months. Each is installed in the task that first uses it (unused libraries fail `pnpm check`).
- **License note (T7, 2026-10-11):** sharp itself is Apache-2.0, but its image engine (`@img/sharp-libvips-*`, libvips) is LGPL-3.0-or-later, which the license check blocks by default. Allowed in `tools/license-allowlist.json`: it is an unchanged, separate library file that runs only on the backend server and is never shipped to users; the LGPL only asks to share changes to libvips itself. Owner informed.
- **Cost:** none.
- **Added in T14 (2026-10-12):** `@radix-ui/react-dropdown-menu` 2.1.24 and `@radix-ui/react-dialog` 1.1.23 (MIT, actively maintained, the same family as the switch and tooltip already in use), pinned to exact versions at least two weeks old; used by WorkspaceSwitcher, MemberRow and Dialog.

### D050: Choices made while building F01
- **Date:** 2026-10-13. **Status:** accepted (recorded during `/spec-verify F01`; details in the F01 design's "Built in Tn" notes).
- **Rate limits when Redis is down:** requests are let through and a warning is logged (availability over the limit, which S5 allows only as a short outage). Better Auth's own limiter turned out to be off (it needs IP tracking, which we disable), so wrong passwords are now also limited per network address in our code: 100 per 15 minutes. Every limit is counted *before* the check (and given back when the password was right), so tries sent at the same moment can't slip past it; sign-up code tries use one Redis INCR for the same reason.
- **`MICROSOFT_AUTHORITY`** may be plain http only on 127.0.0.1/localhost and never in production: the desktop tests point Microsoft sign-in at a local fake.
- **Join link and code:** AES-256-GCM with keys from `DATA_ENCRYPTION_KEY` via HKDF and a key version, looked up through two HMAC columns (one for the link, one for the code; migration 0002).
- **Waiting sign-ups** keep the name, email and password *hash* in Redis for at most 30 minutes, until the code is confirmed; the code itself only as a hash.
- **Better Auth's deprecated** `forget-password/email-otp` is replaced by `email-otp/request-password-reset`.
- **CORS** allows PUT, PATCH and DELETE from the app's own origins (the default blocked the app's own calls).
- **Photo upload** sends the file as the request body (no multipart library); the content decides the type.
- **Desktop test runs** start their backend with a key of their own, so attempt counters start fresh each run.
- **Production refuses** the example secrets from `.env.example` (`local_dev…`) for `BETTER_AUTH_SECRET` and `DATA_ENCRYPTION_KEY`.
- **Cost:** none.

### D051: Two F01 items left for later, by the owner
- **Date:** 2026-10-13. **Status:** accepted (owner, during `/spec-verify F01`).
- **Desktop Google/Microsoft hand-off phishing (security review, Medium):** someone could send a person a start link of their own; if that person signs in and presses Continue in the browser, the attacker's app receives the session. Left as it is for now and **must be fixed before anything goes online**. The planned fix: the browser hands the result straight back to the app on the same computer (a loopback address, RFC 8252), or at least the person types the app's code into the page.
- **"Terms" and "Privacy Policy" on Create account** stay plain text, not links as on the approved canvas, until the real documents exist (privacy-legal.md, "Documents needed before launch").
- **Why:** nothing runs online yet (D017), so neither can harm anyone today; both are tracked in docs/progress.md.
- **Cost:** none.

### D052: Full test runs only at the end of a feature
- **Date:** 2026-10-13. **Status:** accepted (owner).
- **Decision:** while a feature's tasks are being built, each task runs only its own tests plus typecheck and lint. The whole suite (unit, integration, desktop windows) and the screenshot checks run once, at `/spec-verify`, before the Pull Request. Tests are still written with each task, and GitHub still checks every push.
- **Why:** in F01 each full run took 15–25 minutes and many runs were made; the owner wants faster development and fewer tokens. A break is still caught before the feature is marked done, at most one feature late.
- **Cost:** none (less time and fewer tokens).
- **Extended 2026-10-15 (owner):** during a feature, focus on finishing tasks. A task writes and runs only the tests it needs to move on (its main logic, plus typecheck and lint). Small UI tests (component tests for looks and states, story checks, screenshots, accessibility scans) are written and run at the end of the feature, at `/spec-verify`, since the screens aren't required for the MVP yet.

### D053: F02 meetings follow Microsoft Teams
- **Date:** 2026-10-14. **Status:** accepted (owner: "same as Microsoft Teams" for the lobby, guests, link expiry and host roles).
- **Decision:** a Teams organization is a MeetApp workspace. Meetings follow Teams' documented behaviour:
  - **Ways in:** Meet now and meeting links; join by link or by meeting ID and passcode.
  - **Lobby:** workspace members skip it by default; external people and guests wait. Guests can't start a meeting alone, and the workspace's owner or admins can switch guests off.
  - **Roles:** organizer, co-organizers (up to 10, named by the organizer, workspace members only), presenters (everyone by default) and attendees.
  - **Lifetimes:** Meet now expires 60 days after creation; link meetings 60 days after the last join or change. A meeting lasts at most 30 hours, and the lobby wait is 15 minutes.
  - **Records:** a meeting's record is visible to its participants.
- **Sources:** Microsoft Learn "Limits and specifications for Microsoft Teams" (meeting expiration, 30 hours), "Roles in Microsoft Teams meetings", "Add co-organizers", "Manage lobby options" (checked 2026-10-14).
- **Why:** the owner wants people coming from Teams to find nothing new, as for accounts (D047).
- **Cost:** none.


### D054: How meetings are built (F02)
- **Date:** 2026-10-14. **Status:** accepted (owner approved F02 design.md, 2026-10-14).
- **Decision:**
  - **The backend decides who gets in; LiveKit enforces it.** Every join goes through our API: link or ID+passcode, lobby, lock, guests, the 100 limit and expiry. Only then does the API issue a one-room LiveKit pass (10 minutes for the first use) whose rights come from the meeting role (`canPublishSources`). Rooms are made only by the backend (`auto_create: false`).
  - **The lobby is polling, not a call connection:** waiting apps ask the API every 2 seconds. People in the lobby never touch the call server and never see who is inside.
  - **A meeting ticket per join** (random, stored only as a fingerprint) authenticates every in-call action, so members and guests use the same rules. Same account twice = two attendances.
  - **Shared state** is set only by the backend: participant attributes (role, group, hand), room metadata (options, lock, end time) and server data messages. Apps trust control messages only from the server. Reactions are the one thing apps send to each other.
  - **LiveKit webhooks** fill the meeting record (joins, leaves, end) and refuse reused passes. A cleanup job every minute repairs anything a lost webhook missed.
  - **Link and passcode** are stored encrypted, with HMAC columns for lookups (as D050).
- **Why:** a changed or hacked app can't skip the rules (S1, S4). Polling for the lobby keeps it simple and works without a second real-time channel. Server-only state means one source of truth.
- **Cost:** none.

### D055: New libraries for F02
- **Date:** 2026-10-14. **Status:** accepted (owner approved F02 design.md, 2026-10-14); each is vetted with `/add-dependency` before it's added.
- **Decision:**
  - `livekit-client`: the calling engine in the app;
  - `@livekit/components-react`: its React hooks only, already named in frontend.md, with all visuals from our own components;
  - the `livekit/livekit-cli` Docker image (pinned): simulated participants for the 100-person load test, development only.
- **Why:** they come from the makers of the call server we use (D004), are free and Apache-2.0, and are widely used.
- **Cost:** none.
- **Vetted (T1, 2026-10-14):** livekit-client 2.22.3 (Apache-2.0; the newer 2.22.4 is under two weeks old), @livekit/components-react 2.9.24 (Apache-2.0), livekit/livekit-cli image v2.18.8 (Apache-2.0, 22 Sep 2026, pinned by digest when added in T18). The backend's livekit-server-sdk (2.19.1) is already in use since F00. Each is installed in the task that first uses it.
- **Built (T14, T18):** only `livekit-client` 2.22.3 was added to the app; `@livekit/components-react` was **not** added, because our own hooks in `apps/web/src/features/meetings/call` cover what the meeting screen needs. The `livekit/livekit-cli` image is pinned by digest in `infra/load/docker-compose.load.yml`.

### D056: How smooth and how light a big meeting must be (F02 load tests)
- **Date:** 2026-10-15. **Status:** accepted (owner: "handle this as MS Teams is handling this").
- **Decision:**
  - **Smoothness:** like Teams, each video is sent at the size and speed its tile needs; small gallery tiles get the small, 15-frames-a-second version. A tile counts as smooth when it shows at least 90% of the frames it receives (measured 5 seconds after a page appears). The load test also records the frames received, so a slow sender and a slow app are told apart.
  - **Memory:** the desktop app stays under **700 MB** in a 25-person video meeting (was 600 MB). Teams uses about 800 MB to 1 GB in such a meeting.
- **Measured (2026-10-15, owner's MacBook):** 25-person meeting 470–650 MB over 5 minutes; 100-person meeting: tiles 14.5–15 frames a second from 15 received, sound delay 63 ms, joins 1.2 s (95th percentile).
- **Measured again (2026-10-20, F02's final runs, Mac busy with VS Code, Teams, Firefox and Docker):** sound delay 70 ms, joins 1.9 s (95th percentile), 25-person meeting at most 598 MB: met. Smoothness: the worst tile showed 73% (page 1) and 63% (page 2) of the frames it received: **not met** on the busy Mac. The owner chose not to re-run it on an idle Mac and accepted the earlier idle-Mac result (2026-10-20); to re-check before going online.
- **Why:** the old numbers expected more than the senders send (15) and less memory than comparable apps use. Memory is the person's own computer while a meeting is open: nothing is stored on a server and nothing costs money.
- **Cost:** none.

### D057: Meeting chat follows Microsoft Teams (F03)
- **Date:** 2026-10-20. **Status:** accepted (owner: "we will follow how microsoft teams is handling this").
- **Decision:** the meeting chat is one shared conversation for everyone in the meeting: **no private messages inside it** (in Teams, private one-to-one chat is the separate Chat tab; for us a "later" item). **Guests** can chat but can't share files. Files up to **25 MB**. People can edit and delete their own messages; the organizer and co-organizers can delete anyone's. The organizer or a co-organizer sets meeting chat to On, In-meeting only, or Off.
- **Added (owner, 2026-10-20):** as in Teams: emoji picker, reactions, replies with a quote, rich text with code blocks, pinned messages (organizer and co-organizers, up to 3), polls (organizer, co-organizers, presenters create; everyone votes), GIFs from an outside GIF service (family-safe, admins can turn it off) and a built-in sticker set. F03 grows from small to medium.
- **Why:** people coming from Teams find nothing new; fewer ways for unknown people to upload files; less storage.
- **Cost:** none (files use the existing storage).

### D058: New libraries for F03 (chat)
- **Date:** 2026-10-20. **Status:** accepted (owner approved the F03 design, 2026-10-20; each library vetted in F03 T1 with `/add-dependency`).
- **Decision:** TipTap (rich text editor on ProseMirror, MIT), Frimousse (emoji picker, MIT), file-type (finds a file's real type from its bytes, MIT), `@fastify/multipart` (file uploads, MIT), and emojibase-data (the emoji list, MIT), bundled so the picker never downloads it from a CDN.
- **Vetted (T1, 2026-10-20), versions at least two weeks old:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm` and the underline, link and placeholder extensions 3.31.4 (MIT, 6 maintainers, monthly releases); `frimousse` 0.4.0 (MIT, Liveblocks, React 18/19, about 300 KB); `emojibase-data` 17.0.0 (MIT; only the needed languages are copied into the app); `file-type` 22.1.1 (MIT, needs Node 22+, we run 24; 4 small dependencies); `@fastify/multipart` 10.1.2 (MIT, Fastify team, Fastify 5). Each is installed in the task that first uses it.
- **Changed in T6:** `@fastify/multipart` is not used: uploads send the file itself as the body, as the F01 photo upload does. Downloads go through our backend with a signed 5-minute link (storage links can't carry the `nosniff` header), so no link-signing library is needed.
- **Why:** a safe, Teams-like message box with formatting and code; a small emoji picker we can style; file checks that don't trust the file name.
- **Cost:** none.

### D059: GIF service for meeting chat
- **Date:** 2026-10-20. **Status:** accepted (owner, 2026-10-20: KLIPY; GIFs load straight from KLIPY, as Teams does with GIPHY; old .doc/.xls/.ppt files not accepted in chat).
- **Decision (as built, see the T1 change below):** KLIPY's free API, called by each person's own app with a family-safe filter and only a random per-meeting id; GIF images load from KLIPY's image servers; nothing about GIFs is stored on our server. Our backend only hands the app the key and the id, and an admin can turn GIFs off. GIPHY was the first fallback idea and is not built. Tenor's API closed on 30 June 2026.
- **Changed in F03 T1 (2026-10-20, owner: "whatever is free… we will not store anything on our server… it will load on users' internet"):** KLIPY's integration rules require searches and GIF loads to come from the person's own app, not through partner servers, and forbid storing or re-hosting GIFs. So each app searches KLIPY directly with a per-meeting random `customer_id` and the family-safe filter; our backend only hands out the key and that id, and checks that sent GIFs point to `static.klipy.com`. Ads are optional in KLIPY and we never ask for them. Free; a production key is requested from KLIPY before going online.
- **Why:** free; used by WhatsApp and Discord since Tenor closed; our backend keeps the key secret and hides who is searching.
- **Cost:** none (free terms confirmed in T1).

### D060: How chat is built (F03)
- **Date:** 2026-10-20. **Status:** accepted (owner approved the F03 design, 2026-10-20).
- **Decision:** one chat per meeting; the backend checks and saves every action, then LiveKit delivers server-only events on topic `meetapp.chat`; messages are a strict JSON document drawn by our own renderer (never HTML); files are checked by content, cleaned and kept in private storage with 5-minute links; spell check is Electron's built-in one with bundled dictionaries.
- **Why:** the app can't skip the rules, nothing typed can run as code, and no new server is needed.
- **Cost:** none.

### D061: Chat looks and reacts like Teams (F03)
- **Date:** 2026-10-20. **Status:** accepted (owner asked for it after trying the chat).
- **Decision:** one reaction per person per message (a different emoji replaces it; the same one removes it); messages of only 1–3 emoji show larger without a bubble; a person's messages within the same minute are grouped as connected bubbles under one name and time. Replaces the earlier "up to 20 reactions per person" and "messages are not grouped".
- **Why:** the owner wants the chat to behave as in Microsoft Teams, which people already know.
- **Cost:** none.

### D062: MeetApp is a complete Teams-style app, not only a meeting app
- **Date:** 2026-10-21. **Status:** accepted (owner: "this is not just a meeting app … it's a complete app like MS Teams … we should do [it] right now").
- **Decision:** add **F14 Chats** (one-to-one and group chats that stay, contacts for personal accounts and colleagues in organizations, meeting chats in the same list) and **F15 Calls from chat** (audio and video calls from any chat, ringing, missed calls), built right after F03 and before F04. They reuse F03's chat building blocks and F02's calling. When unsure how something works, follow Teams.
- **Why:** the owner wants people to use MeetApp every day like Teams, not only for scheduled meetings.
- **Cost:** none now (same free tools and call server); more work in Phase 1.

### D063: Typing an exact email in "New chat" shows whether it uses MeetApp (F14)
- **Date:** 2026-10-21. **Status:** proposed (with the F14 requirements; owner: "follow Teams").
- **Decision:** as in Teams, a person who types an exact email in New chat sees whether it has a MeetApp account, so they can chat or invite. Only exact emails (no lists, no partial matches), at most 30 lookups a minute per person.
- **Why:** chatting with people outside the workspace needs it, and Teams does the same. F01 hides it at sign-in (AC-F01-02, 13), where it would help someone guess passwords; here the lookup is signed in, limited and logged.
- **Cost:** none.
