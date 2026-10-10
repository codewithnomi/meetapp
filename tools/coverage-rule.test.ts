// TC-F00-40 [AC-F00-17]: the shared coverage rule fails a project whose business logic is below 80% and
// names the folder group; at 80% it passes. Runs Vitest on two small fixture projects.
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT } from "./cli.ts";

const VITEST = join(ROOT, "node_modules/.bin/vitest");

function coverageRun(fixture: string) {
  const result = spawnSync(VITEST, ["run", "--coverage", "--root", join(ROOT, "tests/fixtures/coverage", fixture)], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, CI: "1" },
    timeout: 60_000,
  });
  return { code: result.status, output: `${result.stdout}\n${result.stderr}` };
}

describe("TC-F00-40 [AC-F00-17] coverage below 80% fails the test command", { timeout: 90_000 }, () => {
  it("TC-F00-40 [AC-F00-17] 70% fails and names the folder group below the rule", () => {
    const run = coverageRun("low");
    expect(run.code).not.toBe(0);
    expect(run.output).toContain('does not meet "src/logic/**" threshold (80%)');
  });

  it("TC-F00-40 [AC-F00-17] 80% passes", () => {
    const run = coverageRun("enough");
    expect(run.output).not.toContain("does not meet");
    expect(run.code).toBe(0);
  });
});
