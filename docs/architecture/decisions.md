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
- **Decision:** See `docs/architecture/infrastructure.md`. Everything local for now; tool versions locked with mise (**Node 24 LTS**, since Node 20 on the owner's Mac is past end-of-life; Python 3.12); MinIO for local file storage; LiveKit Cloud free tier when testing calls with people elsewhere; Hetzner + Cloudflare when going live.

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
