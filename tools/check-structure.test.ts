// Tests for the folder-structure check (F00 T21): the real repo is clean, and broken fixture trees
// (built in a temp folder at test time) are reported with a message that names the problem.
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { findStructureProblems } from "./check-structure.ts";

const ROOT = new URL("..", import.meta.url).pathname;
const temps: string[] = [];

/** Builds a temp repo: each entry is a file path (a trailing "/" makes an empty folder). */
function tree(entries: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "structure-"));
  temps.push(root);
  for (const entry of entries) {
    if (entry.endsWith("/")) mkdirSync(join(root, entry), { recursive: true });
    else {
      mkdirSync(dirname(join(root, entry)), { recursive: true });
      writeFileSync(join(root, entry), "x");
    }
  }
  return root;
}

const documented = (folder: string) => [`${folder}/README.md`, `${folder}/CLAUDE.md`];
const planned = (name: string, feature: string) =>
  `apps/${name} belongs to ${feature}; create it when that feature starts (then add it to ALLOWED_APPS in tools/check-structure.ts).`;

afterAll(() => temps.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("check-structure", () => {
  it("TC-F00-77 [AC-F00-36] the real repository has no structure problems", () => {
    expect(findStructureProblems(ROOT)).toEqual([]);
  });

  it("TC-F00-77 [AC-F00-36] running the check on the real repository exits 0", () => {
    const result = spawnSync("node", ["tools/check-structure.ts"], { cwd: ROOT, encoding: "utf8" });
    expect(result.status, result.stderr).toBe(0);
  });

  it("TC-F00-77 [AC-F00-36] a package without CLAUDE.md is reported by name", () => {
    const root = tree(["packages/x/README.md"]);
    expect(findStructureProblems(root)).toEqual(["packages/x is missing CLAUDE.md."]);
  });

  it("TC-F00-77 [AC-F00-36] an app without README.md is reported by name", () => {
    const root = tree(["apps/api/CLAUDE.md"]);
    expect(findStructureProblems(root)).toEqual(["apps/api is missing README.md."]);
  });

  it("TC-F00-77 [AC-F00-36] an extra top-level folder is reported", () => {
    const root = tree(["scripts/", ...documented("apps/web"), "node_modules/", "coverage/", ".github/"]);
    expect(findStructureProblems(root)).toEqual([
      'Unexpected top-level folder "scripts". Add it to docs/engineering/project-structure.md first.',
    ]);
  });

  it.each([
    ["ai-worker", "F05"],
    ["mobile", "F11"],
  ])("TC-F00-77 [AC-F00-36] apps/%s gets the planned-later message (%s)", (name, feature) => {
    const root = tree(documented(`apps/${name}`));
    expect(findStructureProblems(root)).toEqual([planned(name, feature)]);
  });

  it("TC-F00-77 [AC-F00-36] an unknown app is reported, a known app is accepted", () => {
    const root = tree([...documented("apps/other"), ...documented("apps/api"), ...documented("apps/desktop")]);
    expect(findStructureProblems(root)).toEqual([
      'Unexpected app "apps/other". Add it to docs/engineering/project-structure.md first.',
    ]);
  });

  it("TC-F00-77 [AC-F00-26] a fully documented allowed layout passes", () => {
    const root = tree([...documented("apps/web"), ...documented("packages/ui"), "infra/", "tools/", "tests/", "docs/"]);
    expect(findStructureProblems(root)).toEqual([]);
  });
});
