#!/bin/bash
# Runs when a conversation starts or resumes after compaction.
# 1) Makes Claude's shell use the project's locked tool versions (mise.toml), not the Mac's defaults.
# 2) Shows where the project stands, kept short so it doesn't fill the context.
ROOT="${CLAUDE_PROJECT_DIR:-.}"
SHIMS="${MEETAPP_MISE_SHIMS:-$HOME/.local/share/mise/shims}"
if [ -n "$CLAUDE_ENV_FILE" ] && [ -d "$SHIMS" ]; then
  echo "export PATH=\"$SHIMS:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

echo "=== MeetApp progress (docs/progress.md: current state, open questions, latest sessions) ==="
# Everything up to and including the 3 most recent session entries; older entries live in docs/history/.
awk '/^### /{n++} n>3{exit} {print}' "$ROOT/docs/progress.md"
echo
echo "=== Spec status (docs/specs/INDEX.md) ==="
grep -E '^\|' "$ROOT/docs/specs/INDEX.md"
echo
echo "Branch: $(git -C "$ROOT" branch --show-current 2>/dev/null)"
