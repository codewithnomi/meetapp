# Progress archive

Older session-log entries moved out of `docs/progress.md` to keep it short (it is loaded into every conversation). Newest first.

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
