// Tests for the Claude Code hooks in .claude/hooks. A broken hook silently blocks (or stops guarding)
// all work, so each one is exercised here with the same JSON input Claude Code sends it.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const HOOKS = new URL("../.claude/hooks/", import.meta.url).pathname;
const ROOT = new URL("..", import.meta.url).pathname;

function runHook(hook: string, input: unknown, projectDir: string, extraEnv: Record<string, string> = {}) {
  const result = spawnSync(join(HOOKS, hook), {
    input: typeof input === "string" ? input : JSON.stringify(input),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir, ...extraEnv },
    encoding: "utf8",
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

let project: string;

function write(relative: string, text: string) {
  const full = join(project, relative);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, text);
  return full;
}

const INDEX_HEADER =
  "| ID | Feature | Phase | Requirements | Design | Tests | Tasks | Code | Verified |\n|---|---|---|---|---|---|---|---|---|\n";

beforeEach(() => {
  project = mkdtempSync(join(tmpdir(), "meetapp-hooks-"));
  execFileSync("git", ["init", "-q", "-b", "main", project]);
});

describe("guard-git: replaces branch protection", () => {
  const bash = (command: string) => ({ tool_input: { command } });

  it("blocks pushing to main and force pushes", () => {
    expect(runHook("guard-git.sh", bash("git push origin main"), project).code).toBe(2);
    expect(runHook("guard-git.sh", bash("git push --force origin feat/x"), project).code).toBe(2);
    expect(runHook("guard-git.sh", bash("git push origin +feat/x"), project).code).toBe(2);
    expect(runHook("guard-git.sh", bash("cd /tmp && git push origin main"), project).code).toBe(2);
  });

  it("blocks committing while on main", () => {
    const result = runHook("guard-git.sh", bash("git commit -m test"), project);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("Create a branch first");
  });

  it("allows feature-branch pushes and text that only mentions git", () => {
    execFileSync("git", ["-C", project, "switch", "-q", "-c", "feat/F00-x"]);
    expect(runHook("guard-git.sh", bash("git push -u origin feat/F00-x"), project).code).toBe(0);
    expect(runHook("guard-git.sh", bash("git commit -m 'feat: x'"), project).code).toBe(0);
    expect(runHook("guard-git.sh", bash('python3 - <<EOF\nx += ["git push origin main"]\nEOF'), project).code).toBe(0);
  });
});

describe("guard-coding: code only after go-ahead and with an approved feature", () => {
  const edit = (relative: string) => ({ tool_input: { file_path: join(project, relative) } });

  it("always allows documentation", () => {
    expect(runHook("guard-coding.sh", edit("docs/x.md"), project).code).toBe(0);
    expect(runHook("guard-coding.sh", edit("CLAUDE.md"), project).code).toBe(0);
  });

  it("blocks code without the go-ahead", () => {
    write("docs/progress.md", "- **Coding go-ahead:** no\n");
    const result = runHook("guard-coding.sh", edit("apps/api/src/server.ts"), project);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("go-ahead");
  });

  it("blocks code when no feature has approved tasks in progress", () => {
    write("docs/progress.md", "- **Coding go-ahead:** yes\n");
    write(
      "docs/specs/INDEX.md",
      `${INDEX_HEADER}| F01 | Accounts | 1 | approved | draft | draft | draft | not started | - |\n`,
    );
    const result = runHook("guard-coding.sh", edit("apps/api/src/server.ts"), project);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain("approved tasks");
  });

  it("allows code when a feature with approved tasks is in progress", () => {
    write("docs/progress.md", "- **Coding go-ahead:** yes\n");
    write(
      "docs/specs/INDEX.md",
      `${INDEX_HEADER}| F00 | Foundation | 0 | approved | approved | approved | approved | in progress | - |\n`,
    );
    expect(runHook("guard-coding.sh", edit("apps/api/src/server.ts"), project).code).toBe(0);
  });

  it("ignores files outside the project", () => {
    expect(runHook("guard-coding.sh", { tool_input: { file_path: "/tmp/elsewhere.ts" } }, project).code).toBe(0);
  });
});

describe("guard-protected-files", () => {
  it("blocks editing an existing migration but allows a new one", () => {
    const existing = write("packages/db/migrations/0001_init.sql", "create table x();");
    expect(runHook("guard-protected-files.sh", { tool_input: { file_path: existing } }, project).code).toBe(2);
    const fresh = join(project, "packages/db/migrations/0002_next.sql");
    expect(runHook("guard-protected-files.sh", { tool_input: { file_path: fresh } }, project).code).toBe(0);
  });

  it("blocks lockfiles and generated files", () => {
    expect(
      runHook("guard-protected-files.sh", { tool_input: { file_path: join(project, "pnpm-lock.yaml") } }, project).code,
    ).toBe(2);
    const generated = write("packages/design-tokens/dist/tokens.css", "/* AUTO-GENERATED: do not edit */\n");
    expect(runHook("guard-protected-files.sh", { tool_input: { file_path: generated } }, project).code).toBe(2);
  });
});

describe("check-feature-complete", () => {
  it("asks for /spec-verify only when every task is ticked", () => {
    const tasks = write("docs/specs/F02-meetings/tasks.md", "- [x] T1\n- [ ] T2\n");
    expect(runHook("check-feature-complete.sh", { tool_input: { file_path: tasks } }, project).stdout).toBe("");
    writeFileSync(tasks, "- [x] T1\n- [x] T2\n");
    expect(runHook("check-feature-complete.sh", { tool_input: { file_path: tasks } }, project).stdout).toContain(
      "spec-verify skill for F02",
    );
  });
});

describe("session-start", () => {
  it("puts the locked tool versions on PATH and shows only recent sessions", () => {
    const sessions = Array.from({ length: 6 }, (_, i) => `### Session ${i + 1}\n- note ${i + 1}\n`).join("\n");
    write("docs/progress.md", `# Progress\n## Current state\n- ok\n## Session log\n${sessions}`);
    write("docs/specs/INDEX.md", INDEX_HEADER);
    const envFile = join(project, "claude.env");
    writeFileSync(envFile, "");
    const shims = join(project, "mise/shims");
    mkdirSync(shims, { recursive: true });
    const result = runHook("session-start.sh", "", project, { CLAUDE_ENV_FILE: envFile, MEETAPP_MISE_SHIMS: shims });
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Session 3");
    expect(result.stdout).not.toContain("Session 4");
    expect(readFileSync(envFile, "utf8")).toMatch(/mise\/shims/);
  });
});

describe("statusline", () => {
  it("shows the branch and coding state", () => {
    write("docs/progress.md", "- **Coding go-ahead:** yes\n");
    write(
      "docs/specs/INDEX.md",
      `${INDEX_HEADER}| F00 | Foundation | 0 | approved | approved | approved | approved | in progress | - |\n`,
    );
    const line = runHook("statusline.sh", "{}", project).stdout;
    expect(line).toContain("main");
    expect(line).toContain("coding unlocked");
    expect(line).toContain("F00 Foundation");
  });
});

// Uses the real repo (CLAUDE_PROJECT_DIR = ROOT): ESLint only lints files inside the project,
// so the edited files go in a throwaway folder under tests/ that is removed afterwards.
describe("TC-F00-66 [AC-F00-30] check-code-quality: lints and formats the edited file", { timeout: 30_000 }, () => {
  // Inside the repo because ESLint only lints project files. Not git-ignored on purpose:
  // Prettier skips git-ignored files, which would hide case (a). Removed after the block.
  let scratch = "";
  beforeAll(() => {
    scratch = mkdtempSync(join(ROOT, "tests", ".hook-tmp-"));
  });
  afterAll(() => rmSync(scratch, { recursive: true, force: true }));

  const edited = (name: string, text: string) => {
    const file = join(scratch, name);
    writeFileSync(file, text);
    return runHook("check-code-quality.sh", { tool_input: { file_path: file } }, ROOT);
  };

  it("TC-F00-66 [AC-F00-30] (a) a badly formatted .ts file exits 2 naming the file", () => {
    const result = edited("badly-formatted.ts", "export function double( value:number ):number{return value*2}\n");
    expect(result.code).toBe(2);
    expect(result.stderr).toContain(join(scratch, "badly-formatted.ts"));
    expect(result.stderr).toContain("Code style issues");
  });

  it("TC-F00-66 [AC-F00-30] (b) a .ts file with console.log exits 2 naming the file and no-console", () => {
    const text = "export function report(total: number): number {\n  console.log(total);\n  return total;\n}\n";
    const result = edited("logs.ts", text);
    expect(result.code).toBe(2);
    expect(result.stderr).toContain(join(scratch, "logs.ts"));
    expect(result.stderr).toContain("no-console");
  });

  it("TC-F00-66 [AC-F00-30] (c) a clean, formatted .ts file exits 0", () => {
    const result = edited("clean.ts", "export function double(value: number): number {\n  return value * 2;\n}\n");
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
  });

  it("TC-F00-66 [AC-F00-30] (d) a .md file exits 0", () => {
    expect(edited("notes.md", "# Notes\n\nSome   *unformatted*   text\n").code).toBe(0);
  });
});
