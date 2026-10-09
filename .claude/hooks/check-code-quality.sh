#!/bin/bash
# Runs after every file edit. Lints + format-checks the edited code file and, if
# there are problems, reports them back to Claude so they're fixed immediately.
# Does nothing until the project has its tooling installed (set up in F00).
python3 -I -c '
import json, os, subprocess, sys
data = json.load(sys.stdin)
path = data.get("tool_input", {}).get("file_path", "")
root = os.environ.get("CLAUDE_PROJECT_DIR", ".")
if not os.path.isfile(path):
    sys.exit(0)

def tool(*parts):
    return os.path.join(root, *parts)

checks = []
if path.endswith((".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs")):
    if os.path.exists(tool("node_modules", ".bin", "eslint")):
        checks.append([tool("node_modules", ".bin", "eslint"), "--max-warnings=0", path])
    if os.path.exists(tool("node_modules", ".bin", "prettier")):
        checks.append([tool("node_modules", ".bin", "prettier"), "--check", path])
elif path.endswith(".py"):
    for cmd in (["ruff", "check", path], ["ruff", "format", "--check", path]):
        checks.append(cmd)

problems = []
for cmd in checks:
    try:
        r = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=60)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        continue
    if r.returncode != 0:
        problems.append((r.stdout + r.stderr).strip()[-3000:])

if problems:
    print("Code quality check failed for " + path + " (see docs/engineering/code-quality.md). Fix these before continuing:\n\n" + "\n\n".join(problems), file=sys.stderr)
    sys.exit(2)
'
