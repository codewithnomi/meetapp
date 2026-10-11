// TC-F00-41 [AC-F00-17]: `pnpm test` without Docker stops at once with a clear message instead of
// waiting for the integration tests to time out. Docker is faked by a small script on PATH.
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { ROOT } from "./cli.ts";
import { DOCKER_MESSAGES } from "./dev-checks.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

/** A folder for PATH holding only a `docker` script with the given body (or nothing at all). */
function pathWithDocker(body: string | undefined): string {
  const dir = mkdtempSync(join(tmpdir(), "meetapp-test-docker-"));
  dirs.push(dir);
  if (body !== undefined) {
    writeFileSync(join(dir, "docker"), `#!/bin/sh\n${body}\n`);
    chmodSync(join(dir, "docker"), 0o755);
  }
  return dir;
}

function runTestCommand(pathDir: string) {
  const started = Date.now();
  const result = spawnSync(process.execPath, [join(ROOT, "tools/test.ts")], {
    cwd: ROOT,
    env: { HOME: process.env["HOME"] ?? "", PATH: pathDir },
    encoding: "utf8",
    timeout: 20_000,
  });
  return { ...result, elapsed: Date.now() - started };
}

describe("TC-F00-41 [AC-F00-17] pnpm test without Docker fails clearly", () => {
  it("TC-F00-41 [AC-F00-17] Docker not running: the Docker message within 10 s, no tests started", () => {
    const run = runTestCommand(pathWithDocker("exit 1"));
    expect(run.status).toBe(1);
    expect(run.elapsed).toBeLessThan(10_000);
    expect(run.stderr).toContain(DOCKER_MESSAGES["not-running"]);
    expect(run.stdout).not.toContain("Starting the test services");
  });

  it("TC-F00-41 [AC-F00-17] Docker not installed: the install message", () => {
    const run = runTestCommand(pathWithDocker(undefined));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(DOCKER_MESSAGES.missing);
  });
});
