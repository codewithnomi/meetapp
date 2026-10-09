#!/bin/bash
# Runs before every shell command. Replaces GitHub branch protection (not available
# on free private repos): no commits on main, no pushes to main, no force pushes.
python3 -I -c '
import json, os, re, subprocess, sys
cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
if not re.search(r"\bgit\b", cmd):
    sys.exit(0)
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
try:
    branch = subprocess.run(["git", "-C", root, "branch", "--show-current"], capture_output=True, text=True, timeout=5).stdout.strip()
except Exception:
    branch = ""

def block(reason):
    print("Blocked by git rules (docs/engineering/git-ci-release.md): " + reason, file=sys.stderr)
    sys.exit(2)

if re.search(r"\bgit\s+push\b[^;&|]*(\s--force\b|\s-f\b|\s--force-with-lease\b|\s\+\S)", cmd):
    block("force pushes are not allowed.")
if re.search(r"\bgit\s+push\b[^;&|]*\b(main|master)\b", cmd):
    block("never push to main. Push your branch and open a Pull Request (use /pr).")
if branch in ("main", "master"):
    if re.search(r"\bgit\s+commit\b", cmd):
        block("you are on main. Create a branch first: git checkout -b feat/F00-T1-short-name")
    if re.search(r"\bgit\s+push\b", cmd):
        block("you are on main. Push a feature branch and open a Pull Request instead.")
'
