// `pnpm test:visual` and `pnpm test:visual:update` (AC-F00-13, 14, 33; design.md section 8).
// Builds Storybook, then runs the gallery screenshots + accessibility checks inside the pinned Playwright
// image on linux/amd64, the same machine type as CI, so baselines made here match CI pixel for pixel.
// In CI the job already runs inside that image, so the tests run directly.
import { spawnSync } from "node:child_process";
import { fail, ROOT } from "./cli.ts";
import { DOCKER_MESSAGES, checkDocker } from "./dev-checks.ts";
import { dockerArgs, playwrightArgs, playwrightImage } from "./visual-commands.ts";

const update = process.argv.includes("--update");

function run(command: string, args: string[]): number {
  return spawnSync(command, args, { cwd: ROOT, stdio: "inherit" }).status ?? 1;
}

function runInImage(): number {
  const docker = checkDocker();
  if (docker !== "ok") fail(DOCKER_MESSAGES[docker]);
  return run("docker", dockerArgs(playwrightImage(ROOT), ROOT.replace(/\/$/, ""), update));
}

if (run("pnpm", ["--filter", "@meetapp/ui", "build-storybook", "--quiet"]) !== 0) fail("Storybook did not build.");

const status = process.env["CI"] ? run("node", playwrightArgs(update)) : runInImage();
if (status !== 0) {
  fail(
    "Visual or accessibility check failed. See the report: pnpm exec playwright show-report tests/e2e/gallery/playwright-report",
  );
}
process.stdout.write(
  update ? "✓ Baselines updated. Review the new pictures before committing.\n" : "✓ Gallery matches.\n",
);
