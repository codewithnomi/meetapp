// Tests that the commands written in the docs are real (F00 T21): every `pnpm ...` in the root
// CLAUDE.md "Commands" section, docs/getting-started.md and each app/package README must exist as a
// script, and each README must have "What", "Run" and "Test" sections.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = new URL("..", import.meta.url).pathname;
const BUILT_INS = new Set([
  "install",
  "exec",
  "add",
  "dlx",
  "i",
  "--version",
  "-v",
  "why",
  "outdated",
  "audit",
  "store",
  "approve-builds",
]);

type Pkg = { name?: string; scripts?: Record<string, string> };
const readJson = (path: string): Pkg => JSON.parse(readFileSync(join(ROOT, path), "utf8")) as Pkg;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Folders like apps/web and packages/ui that hold a README. */
const workspaces = ["apps", "packages"].flatMap((group) =>
  readdirSync(join(ROOT, group), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(ROOT, group, entry.name, "package.json")))
    .map((entry) => `${group}/${entry.name}`),
);
const readmes = workspaces.map((dir) => `${dir}/README.md`);

const byName = new Map(
  workspaces.map((dir) => [readJson(`${dir}/package.json`).name, readJson(`${dir}/package.json`)]),
);
const rootScripts = readJson("package.json").scripts ?? {};

function commandsOf(text: string): string[][] {
  const spans = [...text.matchAll(/`([^`\n]*pnpm [^`\n]*)`/g)].map((m) => m[1] ?? "");
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)].flatMap((m) => (m[1] ?? "").split("\n"));
  return [...spans, ...blocks].flatMap((line) =>
    [...line.matchAll(/pnpm((?:\s+[^\s&|;`)]+)+)/g)].map((m) => (m[1] ?? "").trim().split(/\s+/)),
  );
}

function problemWith(words: string[], ownScripts: Record<string, string> | undefined): string | undefined {
  let rest = words;
  if (rest[0] === "--filter") {
    const pkg = byName.get(rest[1]);
    if (!pkg) return `no workspace package named "${rest[1]}"`;
    const script = rest[2] === "run" ? rest[3] : rest[2];
    return script && !BUILT_INS.has(script) && !pkg.scripts?.[script]
      ? `${rest[1]} has no script "${script}"`
      : undefined;
  }
  if (BUILT_INS.has(rest[0] ?? "")) return undefined;
  if (rest[0] === "run") rest = rest.slice(1);
  const script = rest[0];
  if (!script || script.startsWith("-") || script.startsWith("<") || rootScripts[script] || ownScripts?.[script])
    return undefined;
  return `no script "${script}"`;
}

function badCommands(file: string, text: string, ownScripts?: Record<string, string>): string[] {
  return commandsOf(text).flatMap((words) => {
    const problem = problemWith(words, ownScripts);
    return problem ? [`${file}: "pnpm ${words.join(" ")}" -> ${problem}`] : [];
  });
}

describe("docs commands", () => {
  it("TC-F00-93 [AC-F00-26] the root CLAUDE.md has a Commands section with the main commands", () => {
    const section = /^## Commands\b[^\n]*\n([\s\S]*?)(?=^## |$(?![\s\S]))/m.exec(read("CLAUDE.md"))?.[1];
    expect(section, "CLAUDE.md needs a '## Commands' section").toBeDefined();
    for (const command of ["pnpm dev", "pnpm test", "pnpm check"]) expect(section).toContain(command);
    expect(badCommands("CLAUDE.md", section ?? "")).toEqual([]);
  });

  it("TC-F00-93 [AC-F00-26] docs/getting-started.md exists and only mentions real pnpm commands", () => {
    expect(existsSync(join(ROOT, "docs/getting-started.md")), "docs/getting-started.md is missing").toBe(true);
    expect(badCommands("docs/getting-started.md", read("docs/getting-started.md"))).toEqual([]);
  });

  it("TC-F00-93 [AC-F00-26] every pnpm command in the app and package READMEs exists", () => {
    const problems = workspaces.flatMap((dir) =>
      badCommands(`${dir}/README.md`, read(`${dir}/README.md`), readJson(`${dir}/package.json`).scripts),
    );
    expect(problems).toEqual([]);
  });

  it.each(readmes)("TC-F00-93 [AC-F00-26] %s has What, Run and Test sections", (file) => {
    const headings = [...read(file).matchAll(/^## (.+)$/gm)].map((m) => (m[1] ?? "").trim().toLowerCase());
    const missing = ["what", "run", "test"].filter((word) => !headings.some((h) => h.startsWith(word)));
    expect(missing, `${file} lacks level-2 headings starting with: ${missing.join(", ")}`).toEqual([]);
  });
});
