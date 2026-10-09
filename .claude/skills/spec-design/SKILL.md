---
name: spec-design
description: Write the technical design (design.md) for a feature whose requirements are approved. Use for "/spec-design F05".
argument-hint: <feature id, e.g. F05>
disable-model-invocation: true
---

# Write the design for feature $ARGUMENTS

1. Find `docs/specs/$ARGUMENTS-*/requirements.md`. **If its status is not `approved`, stop** and tell the owner it must be approved first.
2. Read `docs/architecture/overview.md`, `docs/architecture/decisions.md`, and the designs of any features this one depends on.
3. Research where needed (library docs via the Context7 MCP tools if available, or web search). Don't guess library APIs.
4. Write `design.md` next to the requirements using `docs/specs/_templates/design.md`:
   - Start with a plain-English summary the owner can understand.
   - Every acceptance criterion (AC-…) must appear in the test plan.
   - Include cost impact for any paid service.
   - Any new technology choice becomes a new entry in `docs/architecture/decisions.md` (status: proposed).
5. Launch the `spec-reviewer` subagent to check the design against the requirements. Fix what it finds.
6. Update `docs/specs/INDEX.md` (Design = draft) and `docs/progress.md`.
7. Explain the design to the owner in simple words (5–10 bullet points) and ask for approval.
