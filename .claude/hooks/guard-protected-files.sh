#!/bin/bash
# Runs before every file edit. Blocks hand-editing files that must never be edited
# directly: already-written database migrations, lock files and generated files.
python3 -I -c '
import json, os, re, sys
data = json.load(sys.stdin)
path = data.get("tool_input", {}).get("file_path", "")
if not path:
    sys.exit(0)
name = os.path.basename(path)

def block(reason):
    print("Blocked: " + reason, file=sys.stderr)
    sys.exit(2)

if name in ("pnpm-lock.yaml", "package-lock.json", "uv.lock", "pubspec.lock"):
    block(f"{name} is generated. Change dependencies with pnpm/uv commands instead of editing it.")
if re.search(r"/migrations/[^/]+$", path) and os.path.exists(path):
    block("existing database migrations must never be edited (they may already be applied). Create a NEW migration instead (docs/engineering/backend.md).")
if os.path.isfile(path):
    try:
        head = open(path, encoding="utf-8", errors="ignore").read(400)
    except OSError:
        head = ""
    if re.search(r"(AUTO-GENERATED|@generated|DO NOT EDIT)", head):
        block(f"{name} is a generated file. Change its source (e.g. tokens.json, the Zod schemas) and regenerate it.")
'
