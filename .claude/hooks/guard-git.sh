#!/bin/bash
# Runs before every shell command. Replaces GitHub branch protection (not available
# on free private repos): no commits on main, no pushes to main, no force pushes.
python3 -I -c '
import json, os, re, shlex, subprocess, sys
cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")
if "git" not in cmd:
    sys.exit(0)
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
try:
    branch = subprocess.run(["git", "-C", root, "branch", "--show-current"], capture_output=True, text=True, timeout=5).stdout.strip()
except Exception:
    branch = ""

def block(reason):
    print("Blocked by git rules (docs/engineering/git-ci-release.md): " + reason, file=sys.stderr)
    sys.exit(2)

# Look only at real commands: split on newlines and shell separators, keep segments starting with git.
for segment in re.split(r"\n|;|&&|\|\||\|", cmd):
    try:
        words = shlex.split(segment.strip())
    except ValueError:
        words = segment.split()
    if len(words) < 2 or words[0] != "git":
        continue
    # skip global options like -C <dir>
    i = 1
    while i < len(words) and words[i].startswith("-"):
        i += 2 if words[i] in ("-C", "-c") else 1
    if i >= len(words):
        continue
    sub, args = words[i], words[i + 1:]
    if sub == "push":
        if any(a in ("--force", "-f", "--force-with-lease") or a.startswith("--force") or a.startswith("+") for a in args):
            block("force pushes are not allowed.")
        if any(a in ("main", "master") or a.endswith(":main") or a.endswith(":master") for a in args):
            block("never push to main. Push your feature branch; the Pull Request is opened automatically.")
        if branch in ("main", "master"):
            block("you are on main. Push a feature branch instead.")
    if sub == "commit" and branch in ("main", "master"):
        block("you are on main. Create a branch first, e.g. git switch -c feat/F00-foundation")
'
