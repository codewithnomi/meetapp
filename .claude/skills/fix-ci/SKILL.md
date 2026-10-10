---
name: fix-ci
description: A GitHub Actions check failed (on a Pull Request, main, the Windows nightly, or a Dependabot PR). Reads the failing job's logs, reproduces the failure locally, finds the root cause, fixes it the normal way, pushes, and confirms the check is green. Use when CI is red, the owner says "the checks failed", or before telling the owner a PR is ready.
argument-hint: [PR number or branch]
---

# Fix a failing CI check: $ARGUMENTS

Goal: green checks without weakening anything. Never skip, delete or loosen a test, rule, threshold or scan to make CI pass.

1. **Find the failure.** With the GitHub MCP tools (repo `codewithnomi/meetapp`), find the latest run for the PR or branch and the failing job(s). Read the failing step's log; keep only the relevant lines.
2. **Classify it:**
   - **Real bug:** the code is wrong. Go to step 3.
   - **Environment difference** (works on the Mac, fails on Linux/Windows): line endings, file-name case, paths, missing system package, timezone, locale, AppArmor/xvfb for Electron, screenshot font rendering.
   - **Flaky test** (passes on re-run): never just re-run and move on. Find the cause (timing, shared state, network, test order) and make the test deterministic.
   - **Outside cause:** a service outage, a GitHub runner problem, rate limits. Re-run once; if it persists, tell the owner in one line.
   - **Budget:** the run was cancelled for lack of free CI minutes. Tell the owner and suggest trimming (docs/architecture/infrastructure.md).
3. **Reproduce locally** with the same command CI runs, on the same versions (mise). For Linux-only problems, use a matching Docker image (e.g. the pinned Playwright image for visual tests).
4. **Fix** through the normal flow: a failing test first if it's a bug, then the fix, the whole test suite, a commit on the same branch, and a push.
5. **Confirm:** wait for the new run and read its result. Repeat if needed (at most 3 rounds, then explain to the owner what's blocking).
6. **Prevent:** if the same kind of failure could recur, add a check or a note to `docs/runbooks/ci.md`.
7. Tell the owner in plain words: what failed, why, what changed, and that the checks are green.
