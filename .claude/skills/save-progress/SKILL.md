---
name: save-progress
description: Save what happened in this session to docs/progress.md so nothing is lost when the conversation ends or gets long. Use at the end of a session, before a big switch of topic, or when the owner says "save progress".
---

# Save progress

1. Read `docs/progress.md`.
2. Update **Current state** (stage + next step), keeping it short.
3. Update **Open questions**: remove the answered ones (and write each answer into the right document), add new ones.
4. Add a new entry at the top of **Session log** with today's date: what was decided, what was written or built, and which files changed.
5. Make sure every decision made in this session is in `docs/architecture/decisions.md`.
6. Make sure `docs/specs/INDEX.md` matches the spec files.
7. **Auto-save to GitHub:** if you're on a feature branch, commit and push there. Otherwise (document-only changes) follow the `pr` skill: `docs/<short-name>` branch, commit, push, open a Pull Request.
8. Tell the owner in one or two lines what was saved, with the Pull Request link if one was opened.
