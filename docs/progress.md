# Progress Log

> Claude reads this file automatically at the start of every session (via a hook).
> Keep the "Current state" section short and up to date. Add new sessions at the top of the log.

## Current state
- **Coding go-ahead:** yes (given by the owner on 2026-10-09, together with F00 requirements approval)
- **Stage:** Planning / documentation. No code exists yet (on purpose).
- **Design phase (D029):** design system **approved** (buttons and inputs pill-shaped): https://claude.ai/artifact/K9GV7yg9Y4QkNJ7VgAb3PJ. Screen designs v1 (8 screens) **approved**: https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ
- **Next step (after design):** F00 Foundation requirements are drafted and reviewed (`docs/specs/F00-foundation/requirements.md`). Owner answered all questions. **Waiting for the owner to read it and say "approved".** Then `/next` writes the F00 design. **Coding waits for the owner's "go ahead".**

## Open questions (need the owner's answer)
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

### 2026-10-09: Session 1 (F00 plan ready)
- F00 requirements approved + coding go-ahead. Wrote F00 design (reviewed by spec-reviewer, 13 must-fix items applied), tests.md (93 test cases, all ACs covered, by test-writer), tasks.md (21 steps). Owner decisions: Gatus, seed scope, macOS per Docker, free-plan merge guard (D030, D031). Waiting for owner approval of design + tests + tasks, then building starts on `feat/F00-foundation`.

### 2026-10-09: Session 1 (design approved)
- Owner approved the 8 screen designs. F00 requirements updated to follow the approved design system (D029): exact tokens, atoms as designed, fonts bundled offline. Waiting for owner approval of F00 requirements.

### 2026-10-09: Session 1 (screen designs)
- Owner approved the design system after one change (rounded buttons/inputs). Published 8 screen designs: sign in, home, pre-join, meeting room, screen share + host controls, minutes + library, Ask AI, settings (theme, accent, persona, integrations). Each has light/dark and accent switches.

### 2026-10-09: Session 1 (design system)
- Owner chose design-first (D029). Published design system v1: 63 contrast-checked color tokens (light/dark, 8 accents, sky default), Figtree + JetBrains Mono, spacing/radius/shadows, 16 components (9 atoms, 5 molecules, 2 organisms) with live previews and usage rules.

### 2026-10-09: Session 1 (automation + monitoring)
- Auto commit/push after every task; auto Pull Request when a feature passes verification (D026). Monitoring from day one in F00 (D027). Postgres MCP read-only (D028). New `/diagnose`, protected-files hook, status bar, compaction guidance. F00 ACs 41–45.

### 2026-10-09: Session 1 (Claude setup for coding)
- Added `docs/engineering/project-structure.md` (code map + naming), hooks that enforce rules (no code before go-ahead; no commits/pushes to main; Mac notification), `/pr` command, Context7 + Playwright MCP (`.mcp.json`), development permissions. Server infrastructure plan drafted in `docs/architecture/infrastructure.md` (for later).

### 2026-10-09: Session 1 (GitHub)
- Created the Git repository and uploaded all documents and Claude setup to GitHub (`main`). From now on: branch + Pull Request per change (docs/engineering/git-ci-release.md).

### 2026-10-09: Session 1 (production-readiness review)
- Full review of the setup. Added F13 Scheduling, host controls, meetings library, personal workspace, desktop links (D022); Mailpit, feature flags, visual tests, license check, Dependabot, TURN (D023); glossary; F00 ACs 31–35. Rewrote `docs/product/features.md` as the complete feature plan for the owner.

### 2026-10-09: Session 1 (sign-in + code quality)
- Confirmed Google + Microsoft sign-in (D020; Apple sign-in needed later for iPhone).
- Added code-quality rules (`docs/engineering/code-quality.md`), `code-quality-reviewer` helper, auto-lint hook after every edit, quality checks in CI and `/spec-verify`, F00 ACs 27–30 (D021).

### 2026-10-09: Session 1 (Flutter + first spec)
- Mobile switched to **Flutter** (D019): owner had bad React Native experience.
- Added `/next` (Claude leads; owner approves). `/spec-new` now drafts first and only asks real product questions.
- Drafted F00 Foundation requirements (26 acceptance criteria), reviewed by spec-reviewer, fixes applied.

### 2026-10-09: Session 1 (owner answers)
- Free way first, no domain, no logo yet, user-selectable color themes with sky-blue default. No coding until go-ahead. Decisions D017, D018.

### 2026-10-09: Session 1 (production-grade additions)
- Added: engineering rules (frontend **Atomic Design**, backend, Git/CI/releases, operations), quality targets, privacy & legal, Foundation feature F00. New helpers `ui-reviewer` and `docs-keeper`; new command `/new-component`; `/spec-verify` now also checks UI, docs and quality targets. Decisions D011–D016.

### 2026-10-09: Session 1 (continued)
- Added testing and security: `test-writer` and `security-auditor` helpers, the `/spec-verify` command, a hook that triggers verification when a feature's last task is ticked, test-case and verification templates, and security rules (`docs/architecture/security.md`). Decision D010.

### 2026-10-09: Session 1
- Discussed the idea. Chose the main technologies (see `docs/architecture/decisions.md`).
- Owner decided: **documentation first, code later**. All early prototype code was deleted.
- Created the documentation structure and the Claude setup (rules, skills, helpers, hooks).
