# Progress Log

> Claude reads this file automatically at the start of every session (via a hook).
> Keep the "Current state" section short and up to date. Add new sessions at the top of the log.

## Current state
- **Coding go-ahead:** yes (given by the owner on 2026-10-09, together with F00 requirements approval)
- **Stage:** Building F00 Foundation on branch `feat/F00-foundation`. T1–T3 done; next is T4 (local services in Docker).
- **Design phase (D029):** design system **approved** (buttons and inputs pill-shaped): https://claude.ai/artifact/K9GV7yg9Y4QkNJ7VgAb3PJ. Screen designs v1 (8 screens) **approved**: https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ
- **Next step:** `/next` builds T4. The next pause for the owner is T5 (the start command, a milestone).

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

### 2026-10-10: Session 2 (F00 T2 code-quality tooling, T3 commit safety)
- **T2 done:** the automatic code checker is set up and `pnpm check` runs it all: lint rules (size limits, no `any`, no `console.log`, accessibility, translations, our own "no raw colors" rule, a reason required to switch any rule off), formatting, type checks, architecture rules (Atomic levels, backend layers), unused code and copy-paste detection. The after-edit hook is now active. 76 tests pass.
- **Decision D034:** TypeScript 7 does the type checks; lint tools use the official TypeScript 6 compatibility package (typescript-eslint doesn't support 7 yet). ESLint 9, because the accessibility plugin doesn't support ESLint 10 yet.
- **T3 done:** every commit now runs a secrets check first (gitleaks from Docker, pinned version). A password or key in a commit is blocked, naming the file and line. Without Docker running, commits stop with "Start Docker to run the secrets check". Then changed files are formatted and linted. 87 tests pass.
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
