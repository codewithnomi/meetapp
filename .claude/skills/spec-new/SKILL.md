---
name: spec-new
description: Start a new feature spec. Claude drafts docs/specs/FXX-name/requirements.md from what the docs already say, asks the owner only the questions that truly need their choice, and gets it reviewed. Use for "/spec-new F05" or via /next.
argument-hint: <feature id, e.g. F05>
---

# Write the requirements for feature $ARGUMENTS

The owner is not a programmer and expects Claude to lead. Use simple words.

1. Read `docs/progress.md`, `docs/product/*`, `docs/architecture/*` and `docs/specs/INDEX.md`. Most answers are already there.
2. If `docs/specs/$ARGUMENTS-*/requirements.md` already exists, continue that one instead.
3. **Draft first.** Create `docs/specs/<ID>-<short-kebab-name>/requirements.md` from `docs/specs/_templates/requirements.md`, filling in everything you can from the docs and sensible industry defaults. Rules:
   - Every acceptance criterion gets an ID `AC-<ID>-NN` and uses "WHEN … THEN …", testable with a clear pass/fail.
   - Plain English; no implementation details (those go in design.md).
4. **Ask only what really needs the owner:** product choices with no clear default (limits, who may do what, what's free vs paid). Use AskUserQuestion with at most 4 questions per round, each with a recommended option first. Don't ask technical questions; decide those yourself and note them.
5. Launch the `spec-reviewer` subagent on the file. Fix what it finds, or turn product-level gaps into questions for the owner.
6. Update `docs/specs/INDEX.md` (Requirements = draft) and `docs/progress.md`.
7. Show the owner a short plain-English summary (what this feature will do, in 5–10 bullets) and ask them to say "approved" or what to change. On approval, set `status: approved` in the file and INDEX.md.
