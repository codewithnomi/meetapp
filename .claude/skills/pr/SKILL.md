---
name: pr
description: Save work to GitHub the professional way - branch, commit, push and open a Pull Request with the template filled in - then give the owner the link to merge. Used AUTOMATICALLY by spec-verify (on PASS) and save-progress (for document changes); the owner can also type /pr.
argument-hint: [optional short description]
---

# Open a Pull Request for the current work

1. Run `git status` and `git diff` to see what changed. If nothing changed, say so and stop.
2. Make sure the work is complete: the relevant tests pass (if code), and docs/progress.md is updated.
3. If on `main`, create a branch named after the work: `feat/F02-meetings` (feature), `fix/F02-short-name` or `docs/short-name`.
4. Commit with a Conventional Commit message (`feat(F02): …`, `fix(F05): …`, `docs: …`) explaining *why*, ending with the attribution line from the system instructions. Never commit `.env` or secrets.
5. Push the branch (never `main`, never force).
6. Open the Pull Request on `codewithnomi/meetapp` with the GitHub MCP tools (fall back to giving the `pull/new/<branch>` link if they're unavailable). Fill in `.github/pull_request_template.md`: feature/task, ACs covered, checklist, plus the plain-English summary.
7. If CI checks exist, wait for them and report the result; if one fails, fix it and push again.
8. Give the owner the PR link and one sentence: what it contains and that they can click **Merge** when happy. **Never merge it yourself** unless the owner explicitly asks.
