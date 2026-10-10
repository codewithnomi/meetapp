#!/bin/bash
# Runs before every file edit. Code may only change when:
#   1) the owner gave the coding go-ahead (docs/progress.md: "**Coding go-ahead:** yes"), and
#   2) at least one feature is being built with approved tasks (docs/specs/INDEX.md: Tasks approved, Code in progress).
# Documentation and project-setup files can always change. Enforces CLAUDE.md golden rules 0 and 1.
python3 -I -c '
import json, os, sys
data = json.load(sys.stdin)
path = os.path.abspath(data.get("tool_input", {}).get("file_path") or data.get("tool_input", {}).get("notebook_path") or "")
root = os.path.abspath(os.environ.get("CLAUDE_PROJECT_DIR", "."))
if not path.startswith(root + os.sep):
    sys.exit(0)  # files outside the project (e.g. Claude memory) are not code
rel = os.path.relpath(path, root)
allowed_dirs = ("docs/", ".claude/", ".github/pull_request_template.md")
allowed_files = {"CLAUDE.md", "README.md", ".gitignore", ".mcp.json"}
if rel in allowed_files or rel.startswith(allowed_dirs):
    sys.exit(0)

def read(name):
    try:
        return open(os.path.join(root, name), encoding="utf-8").read()
    except OSError:
        return ""

if "**Coding go-ahead:** yes" not in read("docs/progress.md"):
    print(f"Blocked: {rel} is a code/config file, and the owner has not given the coding go-ahead yet (docs/progress.md). Only documents may change. Ask the owner.", file=sys.stderr)
    sys.exit(2)

# A feature row: | ID | Feature | Phase | Requirements | Design | Tests | Tasks | Code | Verified |
building = []
for line in read("docs/specs/INDEX.md").splitlines():
    cells = [c.strip() for c in line.strip().strip("|").split("|")]
    if len(cells) >= 9 and cells[0].startswith("F") and cells[6] == "approved" and cells[7] == "in progress":
        building.append(cells[0])
if not building:
    print(f"Blocked: {rel} is code, but no feature is being built with approved tasks (docs/specs/INDEX.md needs Tasks = approved and Code = in progress). Finish the spec steps first (/next).", file=sys.stderr)
    sys.exit(2)
'
