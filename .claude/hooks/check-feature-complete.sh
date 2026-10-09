#!/bin/bash
# Runs after every file edit. When a feature's tasks.md has all its tasks ticked,
# it tells Claude to run /spec-verify (all tests + acceptance check + security audit).
python3 -I -c '
import json, re, sys
data = json.load(sys.stdin)
path = data.get("tool_input", {}).get("file_path", "")
m = re.search(r"docs/specs/(F\d+)[^/]*/tasks\.md$", path)
if not m:
    sys.exit(0)
text = open(path, encoding="utf-8").read()
if "- [ ]" in text or "- [x]" not in text:
    sys.exit(0)
feature = m.group(1)
print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": f"All tasks in {feature} are ticked. Now run the spec-verify skill for {feature} (all tests + acceptance criteria + security audit) before telling the owner the feature is finished."
}}))
'
