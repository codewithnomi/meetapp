# MeetApp — Rules for Claude

MeetApp is a Teams/Zoom-style meeting app (desktop first, then web, then mobile) with AI built in:
transcripts with speaker names, minutes of meeting, "Ask AI" about past meetings, user persona, MCP integrations.

The owner is not a programmer. **Explain things in simple, plain words. Avoid jargon; if a technical term is needed, explain it in one short sentence.**

## The golden rule: documents first, code second
0. **No coding at all until the owner explicitly says "go ahead".** Writing and discussing documents is fine.
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
- `docs/engineering/code-quality.md`: clean code, design patterns, hard limits. Follow strictly.
- `docs/engineering/frontend.md`: React + **Atomic Design** rules. Follow strictly.
- `docs/engineering/backend.md`: API, database, AI worker rules.
- `docs/engineering/git-ci-release.md`: Git, CI checks, environments, releases.
- `docs/engineering/operations.md`: monitoring, backups, incidents.
- `docs/specs/INDEX.md`: status of every feature spec.
- `docs/specs/_templates/`: templates for new specs.
- `docs/claude-guide.md`: plain-English guide to the Claude features used here.

## Workflow commands (skills in `.claude/skills/`)
- **`/next`: the owner's main command. Claude figures out the next step and does it. Claude leads; the owner approves.**
- `/spec-new <feature>`: draft `requirements.md` from the docs, ask the owner only real product choices
- `/spec-design <feature>`: write `design.md` (only after requirements are approved)
- `/spec-tasks <feature>`: write `tests.md` (test cases) and `tasks.md` (only after design is approved)
- `/spec-implement <feature>`: build the next unchecked task with its tests (only after tasks are approved)
- `/spec-verify <feature>`: run ALL tests + acceptance check + security audit; the only way a feature becomes `done`. Runs automatically when the last task is ticked (hook).
- `/new-component <level> <Name>`: create an Atomic Design component with story + test
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
- Ask before: deleting files, `git push`, installing global tools, spending money (paid APIs).
