# MeetApp — Rules for Claude

MeetApp is a Teams/Zoom-style meeting app (desktop first, then web, then mobile) with AI built in:
transcripts with speaker names, minutes of meeting, "Ask AI" about past meetings, user persona, MCP integrations.

The owner is not a programmer. **Explain things in simple, plain words. Avoid jargon; if a technical term is needed, explain it in one short sentence.**

## The golden rule: documents first, code second
0. **No coding at all until the owner explicitly says "go ahead".** Writing and discussing documents is fine. A hook enforces this. When the owner says "go ahead", set `**Coding go-ahead:** yes` in docs/progress.md.
1. No code is written for a feature until its spec in `docs/specs/` has `status: approved`.
2. If the code needs to differ from the spec, update the spec first and tell the owner.
3. Every important decision goes into `docs/architecture/decisions.md`.
4. At the end of every work session (or before context runs out), update `docs/progress.md`, or run `/save-progress`.

## Where things are
- `docs/progress.md`: **read first.** What's done, what's next, open questions.
- `docs/product/vision.md`: what we're building and why.
- `docs/product/features.md`: complete feature plan (F00–F13) and build order.
- `docs/product/glossary.md`: meaning of terms (workspace, segment, minutes…).
- `docs/architecture/overview.md`: how the system is built (technology choices).
- `docs/architecture/decisions.md`: decisions log, with the reason for each.
- `docs/architecture/security.md`: security rules every feature must follow.
- `docs/product/quality-targets.md`: measurable targets (speed, scale, quality, platforms).
- `docs/product/privacy-legal.md`: consent, user data rights, legal documents.
- `docs/engineering/project-structure.md`: **where every file goes**, naming rules. Follow strictly.
- `docs/architecture/infrastructure.md`: where things run (local now, online later).
- **Design system (approved look, D029):** https://claude.ai/artifact/K9GV7yg9Y4QkNJ7VgAb3PJ. Read its README before any UI work. **Screen designs:** https://claude.ai/artifact/7Arjr3rCB8iTMM5KA3XXDJ
- `docs/engineering/code-quality.md`: clean code, design patterns, hard limits. Follow strictly.
- `docs/engineering/frontend.md`: React + **Atomic Design** rules. Follow strictly.
- `docs/engineering/backend.md`: API, database, AI worker rules.
- `docs/engineering/git-ci-release.md`: Git, CI checks, environments, releases.
- `docs/engineering/operations.md`: monitoring, backups, incidents.
- `docs/specs/INDEX.md`: status of every feature spec.
- `docs/specs/_templates/`: templates for new specs.
- `docs/claude-guide.md`: plain-English guide to the Claude features used here.

## Commands
Setup on a new Mac: `docs/getting-started.md`. Run from the project root:
- **Start:** `pnpm dev` (services + backend + desktop app), `pnpm dev:stop` (stop services, data kept), `pnpm desktop` (only the window).
- **Test:** `pnpm test` (everything, needs Docker), `pnpm test:unit` (quick, no Docker), `pnpm test:integration`, `pnpm test:e2e` (desktop windows), `pnpm test:visual` (component screenshots, needs Docker), `pnpm test:monitoring` (about 12 minutes; close `pnpm dev` first).
- **Check:** `pnpm check` (lint, formatting, types, architecture, unused code, duplication, structure, licenses), `pnpm check:container` (backend container).
- **Data:** `pnpm seed`, `pnpm seed:clear`, `pnpm flag list`, `pnpm flag <key> on|off`, `pnpm email:test`, `pnpm storage:test`.
- **Monitoring:** `pnpm monitoring` (status page, dashboards, alerts), `pnpm monitoring:stop`.
- **Gallery:** `pnpm --filter @meetapp/ui storybook`.

## Workflow commands (skills in `.claude/skills/`)
- **`/next`: the owner's main command. Claude figures out the next step and does it. Claude leads; the owner approves.**
- `/spec-new <feature>`: draft `requirements.md` from the docs, ask the owner only real product choices
- `/spec-design <feature>`: write `design.md` (only after requirements are approved)
- `/spec-tasks <feature>`: write `tests.md` (test cases) and `tasks.md` (only after design is approved)
- `/spec-implement <feature>`: build the next unchecked task with its tests (only after tasks are approved)
- `/spec-verify <feature>`: run ALL tests + acceptance check + security audit; the only way a feature becomes `done`. Runs automatically when the last task is ticked (hook).
- `/new-component <level> <Name>`: create an Atomic Design component with story + test
- `/fix-ci`: a GitHub check is red: read logs, reproduce, fix, confirm green
- `/deps-update`: review library updates (Dependabot), fix breakages, recommend merge
- `/add-dependency`: vet a new library (need, license, maintenance, size) before adding it
- `/db-migration`: change the database safely (no data loss, no long locks, tested)
- `/diagnose`: something is down or broken: find the root cause, explain, fix
- `/pr`: branch + commit + push + Pull Request (runs automatically after spec-verify PASS and save-progress)
- `/spec-status`: show where every feature stands
- `/save-progress`: update `docs/progress.md` with what happened this session

## Helpers (subagents in `.claude/agents/`)
- `spec-reviewer`: checks a spec for gaps and unclear points before approval
- `ac-verifier`: checks the code really meets every acceptance criterion
- `test-writer`: writes test cases (tests.md) and the automated tests
- `security-auditor`: finds security vulnerabilities
- `ui-reviewer`: checks Atomic Design, accessibility, tokens, translations
- `docs-keeper`: checks the documentation matches the code
- `code-quality-reviewer`: checks clean code, design patterns, layering, duplication
- `bug-finder` (user-level): finds bugs

## Conventions (apply once coding starts)
- Main language: TypeScript. Python only for the AI worker. See the decisions log.
- Every acceptance criterion has an ID like `AC-F05-03`, every test case one like `TC-F05-07`. Tests and tasks reference these IDs.
- Tests are written before or with the code, never after. The whole test suite must pass before any task is ticked. Never weaken a test to make it pass.
- A feature is `done` only after `/spec-verify` gives PASS (all tests green, every AC met, no Critical/High security issues).
- Production grade from day one: follow `docs/engineering/*` and `docs/architecture/security.md`. If a rule is in the way, propose changing the doc. Don't silently ignore it.
- Documentation is part of "done": code without updated docs is not finished.
- **Free first (D017):** use free tools and free tiers only; nothing deployed online until the owner decides. Ask before anything that costs money.
- **Git (D026):** repo https://github.com/codewithnomi/meetapp. Never commit to `main`. One branch per feature (`feat/F02-meetings`); commit + push automatically after each finished task; spec-verify PASS opens the Pull Request automatically; the owner merges.
- Ask before: deleting files, `git push`, installing global tools, spending money (paid APIs).

## Working rules for Claude
- Commands run with the locked tool versions (mise shims on PATH via the session-start hook). If `node -v` isn't 24, prefix commands with `mise x --`.
- Read current library docs (Context7 MCP) before using a library; don't code library APIs from memory.
- Start dev servers, Storybook and Electron in the background; stop them when done.
- One feature branch at a time. `docs/progress.md` and `docs/specs/INDEX.md` are only changed on the active branch, to avoid merge conflicts.
- Pace (D033): keep building task after task; pause only at milestones, unfixable failures, or decisions/costs/installs.
- Hooks are code too: when a hook changes, update `tools/hooks.test.ts`.

## When compacting a long conversation, keep
The current feature and task, the branch, failing tests and their errors, decisions made this session that aren't written down yet, and what the owner asked for last. Everything else is in `docs/`.
