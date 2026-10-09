# How We Use Claude in This Project (Plain-English Guide)

## The problem we're solving
Claude doesn't remember past conversations, and in a very long conversation older details get summarized and can be lost.
**Solution:** everything important is written in files in this project. Claude reads them again every time.

## The pieces, explained simply

### 1. CLAUDE.md: the rulebook
- **What:** a file in the project's main folder (`CLAUDE.md`).
- **How it works:** Claude reads it automatically at the start of **every** conversation.
- **What's in it:** the golden rule (documents first, code second), where the documents are, which commands exist, and "explain in simple words".
- **You can edit it** any time to add a rule, e.g. "always reply in Urdu".

### 2. The `docs/` folder: the project's memory
- `progress.md`: the diary. What's done, what's next, open questions.
- `product/`: what we're building (vision, feature list).
- `architecture/`: how it's built, and every decision with its reason.
- `specs/`: one folder per feature with three files: **requirements** (WHAT), **design** (HOW), **tasks** (STEPS).

### 3. Skills: your shortcut commands
- **What:** saved step-by-step instructions, triggered by typing `/` and the name.
- **Where:** `.claude/skills/<name>/SKILL.md`
- **Ours:**

| Command | What happens |
|---|---|
| **`/next`** | **The only command you really need.** Claude works out the next step and does it. |
| `/spec-status` | "Where are we?": shows every feature's status and the next step |
| `/spec-new F01` | Claude asks you questions about feature F01, then writes its requirements |
| `/spec-design F01` | Claude writes how F01 will be built (after you approve the requirements) |
| `/spec-tasks F01` | Claude writes the **test cases** for F01, then splits it into small steps (after you approve the design) |
| `/spec-implement F01` | Claude writes the tests for the next step, builds it, runs **all** tests, ticks it off, then stops for you |
| `/spec-verify F01` | Final check: all tests, every promise in the spec, and a security audit. **Runs automatically** when the last step is done |
| `/new-component molecule MicToggleButton` | Creates a UI component the Atomic Design way, with its visual docs (Storybook) and tests |
| `/pr` | Saves the work to GitHub as a Pull Request. You review and click **Merge** |
| `/save-progress` | Claude writes today's work into `progress.md` |

### 4. Subagents: specialist helpers
- **What:** separate Claude helpers with one job each. They work in their own space, so they don't fill up the main conversation.
- **Where:** `.claude/agents/*.md`
- **Ours:**
  - `spec-reviewer`: reads a spec like a strict reviewer and lists missing or unclear points.
  - `ac-verifier`: checks the finished code really does everything the spec promised.
  - `test-writer`: writes the list of test cases for each feature (before coding), then the automatic tests (during coding).
  - `security-auditor`: looks for security holes, e.g. someone seeing another company's meetings, leaked passwords, or tricking the AI.
  - `ui-reviewer`: checks screens follow the Atomic Design rules, work with the keyboard and screen readers, and look right in light/dark mode.
  - `code-quality-reviewer`: checks the code is clean and well-organized, uses the right design patterns, and has no copy-paste or overly complicated parts.
  - `docs-keeper`: checks the documents still match the code, so documentation never goes out of date.
  - `bug-finder`: already in your account; hunts for bugs in code.
- Claude calls them automatically inside the commands above. You can also ask: "use spec-reviewer on F02".

### 5. Hooks: automatic actions
- **What:** commands that run **automatically** on certain events, without anyone asking.
- **Where:** `.claude/settings.json`
- **Ours:**
  - **When a conversation starts** (or resumes after being summarized), Claude is automatically shown `progress.md` and the spec status. **This is what stops us losing context.**
  - **Before a long conversation is summarized**, a reminder to run `/save-progress`.
  - **Before any file edit:** code can't be written until you've said "go ahead". Only documents can change until then.
  - **Before any Git command:** saving to or uploading to `main` directly is blocked; work always goes through a Pull Request. This replaces GitHub's branch protection, which the free plan doesn't offer for private repos.
  - **When Claude needs you:** a Mac notification pops up.
  - **After every code edit**, the edited file is checked automatically for code-quality and formatting problems. Claude must fix them right away. (Active once F00 installs the tools.)
  - **When the last step of a feature is ticked**, Claude is automatically told to run `/spec-verify` (all tests + security check). A feature can't be marked finished without it.
  - Later, when coding starts: automatically check code for errors after every edit.

### 6. Permissions: what Claude may do without asking
- Also in `.claude/settings.json`.
- Claude may read files and edit `docs/` freely. It must **ask** before deleting files or pushing code online. It may **never** read the secrets file (`.env`).

### 7. MCP: extra tools (added when coding starts)
- **What:** plug-ins that give Claude new abilities.
- **Planned:** **Context7** (latest documentation of the libraries we use, so Claude doesn't guess) and **Playwright** (Claude opens the app and clicks through it to test). Later: database viewer and GitHub.
- **Where:** `.mcp.json`. Type `/mcp` to see what's connected.

### 7b. GitHub MCP: setup (one time, done by the owner)
Lets Claude open Pull Requests, read the automatic check results, and manage issues on https://github.com/codewithnomi/meetapp.

1. **Create a key (token) on GitHub:** open https://github.com/settings/personal-access-tokens/new
   - Name: `claude-meetapp` · Expiration: 90 days
   - Repository access: **Only select repositories → `codewithnomi/meetapp`**
   - Permissions (Repository): **Contents** read & write, **Pull requests** read & write, **Issues** read & write, **Actions** read-only, **Commit statuses** read-only
   - Click **Generate token** and copy it (it starts with `github_pat_`)
2. **Connect it:** open a terminal in VS Code (menu Terminal → New Terminal) in the project folder, and run (paste your token in place of `YOUR_TOKEN`):
   ```
   claude mcp add --transport http github https://api.githubcopilot.com/mcp -H "Authorization: Bearer YOUR_TOKEN"
   ```
   This stores the key **only on your computer** for this project. It is never uploaded to GitHub.
3. **Restart Claude** (close and reopen the Claude panel), then type `/mcp`. You should see `github ✔ connected`.

Safety rules:
- **Never paste the token into the chat** or into any file in the project.
- The token only works for this one repository and expires in 90 days. When it expires, create a new one and run step 2 again (first remove the old one with `claude mcp remove github`).
- Claude still asks before merging, deleting, or pushing (CLAUDE.md).

### 8. Coming when coding starts (in F00)
- **More hooks:** block edits to secret files.
- **Git hooks:** checks before every commit (format, lint, secrets).
- **MCP:** Context7 (library docs) and Playwright (test the app by clicking) are already listed in `.mcp.json`; Claude asks you once to allow them. Later: Sentry (read real errors). GitHub MCP: see 7b.

### 9. Plan mode
- Press **Shift+Tab** until you see "plan mode". Claude then only researches and proposes, and changes nothing until you approve.

## Your daily routine
1. Open the project. Claude already knows where we left off (thanks to the hook).
2. Type **`/next`**. Claude does the next step and tells you what it needs from you (usually just "approved").
3. Repeat.
4. At the end, type `/save-progress`.
