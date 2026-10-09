---
name: next
description: Figure out the single next step in the project and do it (or, if it needs the owner, ask for exactly what's needed). Use when the owner types "/next", or says "what now?", "continue", "where do I start?".
---

# Do the next step

The owner shouldn't have to know the process. You lead.

1. Read `docs/progress.md` and `docs/specs/INDEX.md`.
2. Find the **first row in `docs/specs/INDEX.md` (top to bottom = build order)** that isn't `done`, and its first unfinished stage:
   requirements → design → tests + tasks → code (only after the owner's "go ahead") → verification.
3. Tell the owner in **one line** what you're about to do, e.g. "Next: writing the requirements for F00 Foundation."
4. Do it by following the matching skill's instructions (`spec-new`, `spec-design`, `spec-tasks`, `spec-implement`, `spec-verify`).
   - If the stage is waiting for the owner's approval, show a short plain-English summary of the document and ask: "approve, or what should change?"
   - If the next stage is code and the owner hasn't said "go ahead" (check `docs/progress.md`), stop and ask for it.
5. Finish by updating `docs/progress.md` and telling the owner what to say or type next (usually just "approved" or `/next`).
