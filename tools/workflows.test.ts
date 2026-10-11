// TC-F00-45, TC-F00-46 [AC-F00-19]: the GitHub workflows contain every required check, and every
// action they use is pinned to an exact commit.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { ROOT } from "./cli.ts";

interface Step {
  run?: string;
  uses?: string;
}
interface Job {
  "runs-on"?: string;
  steps?: Step[];
  needs?: string[];
  if?: string;
}
interface Workflow {
  on: Record<string, unknown>;
  concurrency?: { "cancel-in-progress"?: boolean };
  jobs: Record<string, Job>;
}

const read = (file: string) => parse(readFileSync(join(ROOT, ".github", file), "utf8")) as Workflow;
const ci = read("workflows/ci.yml");
const nightly = read("workflows/nightly-windows.yml");
const commands = (workflow: Workflow) =>
  Object.values(workflow.jobs)
    .flatMap((job) => job.steps ?? [])
    .map((step) => step.run ?? step.uses ?? "")
    .join("\n");

describe("TC-F00-45 [AC-F00-19] CI workflow contains every required check", () => {
  it("TC-F00-45 [AC-F00-19] runs on every Pull Request and on pushes to main, newest run wins", () => {
    expect(Object.keys(ci.on)).toEqual(["pull_request", "push"]);
    expect(ci.on["push"]).toEqual({ branches: ["main"] });
    expect(ci.concurrency?.["cancel-in-progress"]).toBe(true);
  });

  it.each([
    ["install + build", /pnpm build/],
    ["lint, typecheck, dependency-cruiser, knip, jscpd, structure, licenses (pnpm check)", /pnpm check\b/],
    ["unit + integration with the real database and cache, coverage", /tools\/test\.ts --only vitest/],
    ["desktop end-to-end", /tools\/test\.ts --only desktop/],
    ["library audit", /pnpm audit --prod --audit-level high/],
    ["gitleaks", /GITLEAKS_IMAGE.*\n?.*git \/repo/],
    ["Semgrep", /semgrep scan/],
    ["Storybook build + screenshots + accessibility", /pnpm test:visual/],
    ["container check", /pnpm check:container/],
  ])("TC-F00-45 [AC-F00-19] has a step for %s", (_name, pattern) => {
    expect(commands(ci)).toMatch(pattern);
  });

  it("TC-F00-45 [AC-F00-19] a failing check posts the 'Do not merge' comment on the Pull Request", () => {
    const report = ci.jobs["report"];
    expect(report?.needs).toEqual(["check", "test", "e2e", "ui", "security", "container"]);
    expect(report?.if).toContain("failure()");
    expect(commands({ ...ci, jobs: { report: report ?? {} } })).toContain("github-script");
  });
});

describe("TC-F00-46 [AC-F00-19] Windows nightly workflow", () => {
  it("TC-F00-46 [AC-F00-19] runs daily on Windows and skips when main didn't change in 24 hours", () => {
    expect(nightly.on["schedule"]).toEqual([{ cron: expect.any(String) }]);
    expect(nightly.jobs["windows"]?.["runs-on"]).toBe("windows-latest");
    expect(commands(nightly)).toContain("--since='24 hours ago'");
  });

  it("TC-F00-46 [AC-F00-19] installs, type-checks, runs the app's tests and builds the desktop app", () => {
    const steps = commands(nightly);
    for (const part of ["./.github/actions/setup", "pnpm typecheck", "vitest run", "@meetapp/desktop build"])
      expect(steps).toContain(part);
  });
});

describe("GitHub actions are pinned (supply-chain safety)", () => {
  const files = [
    ...readdirSync(join(ROOT, ".github/workflows")).map((name) => `workflows/${name}`),
    "actions/setup/action.yml",
  ];
  it.each(files)("every outside action in %s is pinned to a full commit", (file) => {
    const text = readFileSync(join(ROOT, ".github", file), "utf8");
    const uses = [...text.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1] ?? "");
    for (const action of uses.filter((name) => !name.startsWith("./"))) expect(action).toMatch(/@[0-9a-f]{40}$/);
  });
});
