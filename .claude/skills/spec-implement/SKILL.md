---
name: spec-implement
description: Build the next unchecked task of a feature whose tasks.md is approved, with its automated tests, run the whole test suite, and tick it off. Use for "/spec-implement F05".
argument-hint: <feature id, e.g. F05>
disable-model-invocation: true
---

# Build the next task for feature $ARGUMENTS

1. Find `docs/specs/$ARGUMENTS-*/tasks.md`. **If its status is not `approved` or `in-progress`, stop** and say so.
2. Read requirements.md, design.md and tests.md for this feature. Follow them exactly, plus `docs/architecture/security.md`.
3. Pick the **first unchecked task**. Tell the owner in one line what you're about to build.
4. **Tests first:** use the `test-writer` subagent (coding mode) to write the automated tests for this task's TC-… cases.
5. Build the feature code until those tests pass.
6. Run the **whole project's** tests plus typecheck, not just the new ones, so nothing that worked before is broken. Fix failures. Never tick a task while any test fails, and never weaken a test to make it pass.
6b. Make sure the code follows `docs/engineering/code-quality.md` (a hook lints every edited file automatically). For larger tasks, launch the `code-quality-reviewer` subagent and fix its "Must fix" items.
7. If the code had to differ from the design, **update design.md (and tests.md) first** and tell the owner why.
8. Tick the task `[x]` in tasks.md and set the status to `in-progress`.
   - When this was the **last** task, a hook will remind you: run the `spec-verify` skill (all tests + acceptance check + security audit). Only spec-verify may set the status to `done`.
9. Update `docs/specs/INDEX.md` and add a line to `docs/progress.md`.
10. Explain to the owner, in simple words, what now works and how they can see it. Stop and wait before starting the next task.
