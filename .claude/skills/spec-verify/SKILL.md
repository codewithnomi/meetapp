---
name: spec-verify
description: Final check before a feature is marked done - runs ALL tests (so older features are re-checked too), checks every acceptance criterion, runs security, UI and documentation reviews, then writes verification.md. Use for "/spec-verify F05". Runs automatically when the last task of a feature is ticked.
argument-hint: <feature id, e.g. F05>
---

# Verify feature $ARGUMENTS

1. Open `docs/specs/$ARGUMENTS-*/tasks.md`. If any task is unticked, list them and stop.
2. **Run every test in the project**, not only this feature's, so we catch anything that broke in earlier features. Also run the typecheck, lint (including the Atomic Design and layer rules), the code-quality tools (complexity, duplication, unused code; see docs/engineering/code-quality.md) and the Storybook build. (Commands are listed in CLAUDE.md.) Record the pass/fail counts and test coverage.
3. **Security scans:** run `pnpm audit --prod` (and `pip-audit` if Python code exists) and a secrets scan (e.g. `gitleaks` if installed). If a tool isn't installed, say so in the report; don't install it without asking.
4. **Check quality targets:** for any target in `docs/product/quality-targets.md` this feature affects (e.g. join time, caption delay), state whether it was measured and the result.
5. **Launch these helpers in parallel** (one message, several Agent calls):
   - `ac-verifier`: every acceptance criterion
   - `security-auditor`: vulnerabilities in this feature's code
   - `bug-finder`: bugs in this feature's code
   - `ui-reviewer`: only if the feature has UI; Atomic Design, accessibility, tokens, translations
   - `docs-keeper`: documentation matches the code
   - `code-quality-reviewer`: clean code, design patterns, layering, duplication, complexity
6. Write `verification.md` in the feature folder using `docs/specs/_templates/verification.md`.
7. **Verdict:**
   - **PASS** requires all tests to pass, every AC to pass, no Critical/High security issues, no "Must fix" UI or code-quality issues, and the docs to be up to date. Set the feature's status to `done`.
   - **FAIL** means you add a "Fix" task to `tasks.md` for each problem (T-fix-1, T-fix-2…), keep the status `in-progress`, and tell the owner what's wrong in simple words.
8. Update `docs/specs/INDEX.md` and `docs/progress.md`.
9. Tell the owner the result in plain words: what was checked, what passed, and what needs fixing.
