#!/bin/bash
# Runs before every file edit. Until the owner gives the coding go-ahead
# (docs/progress.md contains "**Coding go-ahead:** yes"), only documentation and
# project-setup files may be changed. Enforces CLAUDE.md golden rule 0.
python3 -I -c '
import json, os, sys
data = json.load(sys.stdin)
path = os.path.abspath(data.get("tool_input", {}).get("file_path") or data.get("tool_input", {}).get("notebook_path") or "")
root = os.path.abspath(os.environ.get("CLAUDE_PROJECT_DIR", "."))
if not path.startswith(root + os.sep):
    sys.exit(0)  # files outside the project (e.g. Claude memory) are not code
rel = os.path.relpath(path, root)
allowed_dirs = ("docs/", ".claude/", ".github/")
allowed_files = {"CLAUDE.md", "README.md", ".gitignore", ".mcp.json"}
if rel in allowed_files or rel.startswith(allowed_dirs):
    sys.exit(0)
try:
    progress = open(os.path.join(root, "docs", "progress.md"), encoding="utf-8").read()
except OSError:
    progress = ""
if "**Coding go-ahead:** yes" in progress:
    sys.exit(0)
print(f"Blocked: {rel} is a code/config file, and the owner has not given the coding go-ahead yet (docs/progress.md says \"Coding go-ahead: no\"). Only documents may be changed. Ask the owner if you think it is time to start coding.", file=sys.stderr)
sys.exit(2)
'
