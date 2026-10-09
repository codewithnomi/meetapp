---
name: spec-tasks
description: Break an approved feature design into test cases (tests.md) and a small, ordered task checklist (tasks.md). Use for "/spec-tasks F05".
argument-hint: <feature id, e.g. F05>
disable-model-invocation: true
---

# Write the test cases and task list for feature $ARGUMENTS

1. Find `docs/specs/$ARGUMENTS-*/design.md`. **If its status is not `approved`, stop** and say so.
2. **Test cases first:** launch the `test-writer` subagent (planning mode) to write `tests.md`. Every acceptance criterion must have test cases, including security test cases from `docs/architecture/security.md`. Check its coverage table; no AC may be uncovered.
3. Write `tasks.md` using `docs/specs/_templates/tasks.md`:
   - Small tasks in build order, each finishable in one sitting.
   - Each task lists the acceptance criteria **and test cases (TC-…)** it covers. A task is done only when those tests pass.
   - Every TC-… in tests.md must belong to some task.
4. Update `docs/specs/INDEX.md` (Tests = draft, Tasks = draft) and `docs/progress.md`.
5. Show the owner both lists in simple words and ask for approval.
