#!/bin/bash
# Status bar at the bottom of Claude Code: branch, coding go-ahead, next feature.
cd "${CLAUDE_PROJECT_DIR:-.}" 2>/dev/null || exit 0
branch=$(git branch --show-current 2>/dev/null)
if grep -q '\*\*Coding go-ahead:\*\* yes' docs/progress.md 2>/dev/null; then coding="coding unlocked"; else coding="coding locked"; fi
next=$(grep -E '^\| F[0-9]+ ' docs/specs/INDEX.md 2>/dev/null | grep -v -E '\| PASS \|$' | head -1 | awk -F'|' '{gsub(/^ +| +$/,"",$2); gsub(/^ +| +$/,"",$3); print $2" "$3}')
echo "MeetApp · ${branch:-no branch} · ${coding} · next: ${next:-n/a}"
