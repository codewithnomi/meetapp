# Progress Log

> Claude reads this file automatically at the start of every session (via a hook).
> Keep the "Current state" section short and up to date. Add new sessions at the top of the log.

## Current state
- **Coding go-ahead:** yes (given by the owner on 2026-10-09, together with F00 requirements approval)
- **Stage:** Building F00 Foundation on branch `feat/F00-foundation`. T1–T9 done. **T10 (design tokens) is built but waiting for the owner:** one approved color fails the contrast rule (Open question 0b).
- **Design phase (D029):** design system **approved** (buttons and inputs pill-shaped): https://claude.ai/artifact/K9GV7yg9Y4QkNJ7VgAb3PJ. Screen designs v1 (8 screens) **approved**: https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ
- **Next step:** owner answers Open question 0b; then T10 is finished and `/next` builds T11. The owner's port question (Open question 0) is still open; Claude uses spare ports through temporary settings meanwhile.

## Open questions (need the owner's answer)
0b. **Design system color fix (T10):** in dark mode, `line-strong` (outline color of controls, #5d6b7b) on `surface-raised` (raised panels) is 2.88:1; the rule and the design system itself require 3:1. Proposed fix: change dark `line-strong` to **#637282** (3.18:1, looks almost the same). Approve, and Claude updates the design system and copies the new tokens.
0. **Port clashes on this Mac (T5):** your own PostgreSQL (5432), Redis (6379) and Open WebUI (3000) use MeetApp's default ports. Either stop them while working on MeetApp, or let Claude set POSTGRES_PORT=5433, REDIS_PORT=6380 and API_PORT=3010 in your `.env` (recommended: nothing of yours has to change).
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

### 2026-10-10: Session 2 (F00 T2 code-quality tooling, T3 commit safety, T4 local services, T5 start command, T6 database, T7 backend core, T8 health and services, T9 flags and observability)
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
- **T10 built (not ticked):** `packages/design-tokens` with the approved `tokens.json` (hash-checked), generated `tokens.css` (identical to the design system's 134 variables), the Tailwind theme with only token classes (`bg-blue-500` produces nothing) and a contrast check over 8 accents × 2 themes. The check found one failing pair in the approved design (Open question 0b). The no-raw-color rule now also catches named colors like `"red"`.
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
