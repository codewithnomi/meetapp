// TC-F00-67, TC-F00-68: the check-licenses command, on fixture lists and on the real repository.
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const ROOT = new URL("..", import.meta.url).pathname;
const FIX = `${ROOT}tests/fixtures/licenses/`;

function run(args: string[]) {
  const r = spawnSync(process.execPath, [`${ROOT}tools/check-licenses.ts`, ...args], { cwd: ROOT, encoding: "utf8" });
  return { code: r.status, stdout: r.stdout, stderr: r.stderr };
}

describe("check-licenses command", () => {
  it("TC-F00-67 [AC-F00-31] fails and names a GPL package", () => {
    const r = run(["--input", `${FIX}failing.json`, "--allowlist", `${FIX}empty-allowlist.json`]);
    expect(r.code).toBe(1);
    expect(r.stderr).toContain("copyleft-lib");
    expect(r.stderr).not.toContain("fine-lib");
  });

  it("TC-F00-67 [AC-F00-31] passes a clean list", () => {
    const r = run(["--input", `${FIX}passing.json`, "--allowlist", `${FIX}empty-allowlist.json`]);
    expect(r.code).toBe(0);
  });

  it("TC-F00-68 [AC-F00-31] an allowlist with a reason lets the package through", () => {
    const r = run(["--input", `${FIX}failing.json`, "--allowlist", `${FIX}allowlist.json`]);
    expect(r.code).toBe(0);
  });

  it("TC-F00-67 [AC-F00-31] the real repository passes", { timeout: 60_000 }, () => {
    expect(run([]).code).toBe(0);
  });
});
