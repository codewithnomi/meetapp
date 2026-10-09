# Progress Log

> Claude reads this file automatically at the start of every session (via a hook).
> Keep the "Current state" section short and up to date. Add new sessions at the top of the log.

## Current state
- **Stage:** Planning / documentation. No code exists yet (on purpose).
- **Next step:** F00 Foundation requirements are drafted and reviewed (`docs/specs/F00-foundation/requirements.md`). Owner answered all questions. **Waiting for the owner to read it and say "approved".** Then `/next` writes the F00 design. **Coding waits for the owner's "go ahead".**

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
