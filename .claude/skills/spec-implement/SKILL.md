---
name: spec-implement
description: Build the next unchecked task of a feature whose tasks.md is approved, with its automated tests, run the whole test suite, tick it off, and automatically commit + push it to the feature branch. Use for "/spec-implement F05" or via /next.
argument-hint: <feature id, e.g. F05>
---

# Build the next task for feature $ARGUMENTS

1. Find `docs/specs/$ARGUMENTS-*/tasks.md`. **If its status is not `approved` or `in-progress`, stop** and say so. Check `docs/progress.md` has `**Coding go-ahead:** yes` (a hook also enforces this).
2. **Branch:** make sure you're on the feature branch `feat/<ID>-<short-name>` (e.g. `feat/F02-meetings`). Create it from an up-to-date `main` if it doesn't exist (`git fetch`, `git switch -c … origin/main`). One branch per feature; it carries that feature's specs and code.
3. Read requirements.md, design.md and the task's test cases (only the TC sections this task lists in tests.md, not the whole file). Follow them exactly, plus `docs/architecture/security.md`, `docs/engineering/project-structure.md` and `docs/engineering/code-quality.md`.
3b. **Docs before code:** for every library or tool this task uses, read its current documentation with the Context7 MCP (or the official docs) before writing code; never rely on memory for APIs or config formats. Adding a library the design doesn't name → `add-dependency` skill. Changing the database → `db-migration` skill.
4. Pick the **first unchecked task**. Tell the owner in one line what you're about to build.
5. **Tests first:** use the `test-writer` subagent (coding mode) to write the automated tests for this task's TC-… cases.
6. Build the feature code until those tests pass. A hook lints every edited file; fix what it reports.
7. Run the **whole project's** tests, typecheck and lint, not just the new ones. Start long-running processes (dev servers, Storybook, Electron) in the background and stop them when done, so ports don't stay busy. Fix failures. Never tick a task while any test fails, and never weaken or skip a test to make it pass.
8. For larger tasks, launch the `code-quality-reviewer` subagent and fix its "Must fix" items.
9. If the code had to differ from the design, **update design.md (and tests.md) first** and tell the owner why.
10. Tick the task `[x]` in tasks.md, set the status to `in-progress`, and update `docs/specs/INDEX.md` and `docs/progress.md`.
11. **Auto-save to GitHub:** commit everything for this task with a Conventional Commit message (`feat(<ID>): <task> (T<n>)`, with the attribution line) and push the feature branch. Never push to `main`, never force-push.
11b. If CI runs for this branch and fails, use the `fix-ci` skill before moving on.
12. If this was the **last** task, a hook will remind you to run the `spec-verify` skill. It opens the Pull Request automatically on PASS. Only spec-verify may set the status to `done`.
13. Explain to the owner, in simple words, what now works and how they can see it. Stop and wait before starting the next task.
