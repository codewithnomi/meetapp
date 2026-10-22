// `pnpm test:load` (F02 T18, design.md section 10): the 100-person and 25-person load tests. Starts the
// normal services, a call server of its own on port 7890 (infra/load, no reports to the backend), the
// backend pointed at that call server, and builds the app; runs tests/load; then stops what it started.
// Extra arguments go to Playwright (`pnpm test:load -- -g TC-F14-42` runs one test).
// Takes about 15 minutes and much of the Mac's power; close `pnpm dev` first and leave the Mac idle.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { ROOT, fail, requireEnvFile } from "./cli.ts";
import { DOCKER_MESSAGES, checkDocker, isPortFree, readEnv } from "./dev-checks.ts";

const LOAD_CALL_PORT = "7890";
const ENV_FILE = ["--env-file", join(ROOT, ".env")];
const SERVICES = ["compose", "-f", join(ROOT, "infra/docker-compose.yml"), ...ENV_FILE];
const LOAD = ["compose", "-f", join(ROOT, "infra/load/docker-compose.load.yml"), ...ENV_FILE];

function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): number {
  return spawnSync(command, args, { cwd: ROOT, stdio: "inherit", env }).status ?? 1;
}

async function waitForBackend(url: string): Promise<boolean> {
  for (let i = 0; i < 60; i += 1) {
    const ok = await fetch(`${url}/api/v1/health`).then(
      (response) => response.ok,
      () => false,
    );
    if (ok) return true;
    await new Promise((done) => setTimeout(done, 1_000));
  }
  return false;
}

function startBackend(): ChildProcess {
  return spawn("pnpm", ["--filter", "@meetapp/api", "dev"], {
    cwd: ROOT,
    stdio: "ignore",
    detached: true,
    // The clean-up would remove the simulated people: the backend never let them in.
    env: { ...process.env, LIVEKIT_PORT: LOAD_CALL_PORT, CALLS_KEEP_SIMULATED_PEOPLE: "true" },
  });
}

async function main(): Promise<number> {
  requireEnvFile();
  const docker = checkDocker();
  if (docker !== "ok") fail(DOCKER_MESSAGES[docker]);
  const env = readEnv(ROOT);
  const apiUrl = `http://127.0.0.1:${env["API_PORT"] ?? ""}`;
  if (!(await isPortFree(Number(env["API_PORT"]), "tcp")))
    fail("The backend is already running: close `pnpm dev` first.");
  if (run("docker", [...SERVICES, "up", "-d", "--wait"]) !== 0) fail("The services did not start.");
  if (run("docker", [...LOAD, "up", "-d", "--wait", "livekit-load"]) !== 0) fail("The test call server did not start.");
  const built =
    run("pnpm", ["--filter", "@meetapp/web", "build"], { ...process.env, VITE_API_URL: apiUrl }) === 0 &&
    run("pnpm", ["--filter", "@meetapp/desktop", "build"]) === 0;
  if (!built) fail("The app did not build.");
  const backend = startBackend();
  try {
    if (!(await waitForBackend(apiUrl))) fail("The backend did not start.");
    return run(
      "caffeinate",
      [
        "-dims",
        "pnpm",
        "exec",
        "playwright",
        "test",
        "-c",
        "tests/load/playwright.config.ts",
        ...process.argv.slice(2).filter((arg) => arg !== "--"),
      ],
      {
        ...process.env,
        VITE_API_URL: apiUrl,
        MEETAPP_E2E_API_URL: apiUrl,
        MEETAPP_E2E_MAILPIT_URL: `http://${env["MAILPIT_HOST"] ?? "127.0.0.1"}:${env["MAILPIT_WEB_PORT"] ?? ""}`,
        MEETAPP_E2E_LIVEKIT_PORT: LOAD_CALL_PORT,
      },
    );
  } finally {
    if (backend.pid) process.kill(-backend.pid);
    run("docker", [...LOAD, "--profile", "tool", "down", "--remove-orphans"]);
  }
}

const status = await main();
process.stdout.write(
  status === 0
    ? "✓ Load targets met. Numbers: tests/load/test-results/load-results.json\n"
    : "✗ A load target was missed or a step failed. Numbers: tests/load/test-results/load-results.json\n",
);
process.exit(status);
