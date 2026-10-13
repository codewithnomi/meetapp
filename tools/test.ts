// `pnpm test` (AC-F00-17, design.md section 4): every test in one command. Starts the test services
// (or stops at once with the Docker message), runs all unit and integration tests with one merged
// coverage report (business logic at least 80%), then the real desktop-window tests against a running
// backend. Prints a short summary and fails if any part failed. CI runs the two parts as separate jobs:
// `--only vitest` and `--only desktop`.
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, type AddressInfo } from "node:net";
import { join } from "node:path";
import { ROOT, fail } from "./cli.ts";
import { DOCKER_MESSAGES, addMissingSettings, checkDocker, ensureEnvFile, readEnv } from "./dev-checks.ts";

const COMPOSE = ["compose", "-f", join(ROOT, "infra/docker-compose.yml"), "--env-file", join(ROOT, ".env")];
const API_WAIT_MS = 60_000;

function say(message: string): void {
  process.stdout.write(`${message}\n`);
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv = {}): boolean {
  return spawnSync(command, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } }).status === 0;
}

/** The real backend with the local settings, as `pnpm dev` runs it (without reloading). */
function startApi(extraEnv: Record<string, string>): ChildProcess {
  return spawn(
    process.execPath,
    ["--env-file-if-exists=../../.env", "--import", "./src/instrumentation.ts", "src/server.ts"],
    { cwd: join(ROOT, "apps/api"), stdio: "ignore", env: { ...process.env, ...extraEnv, NODE_ENV: "test" } },
  );
}

/** A port nothing listens on right now (for the desktop tests' fake Microsoft sign-in). */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      server.close(() => resolve(port));
    });
  });
}

/**
 * Microsoft sign-in pointed at a local fake provider, which the desktop tests start on this port
 * (F01 T10). Settings given here win over .env, so the owner's own keys are never used in tests.
 */
function fakeMicrosoft(apiUrl: string, port: number): Record<string, string> {
  return {
    MICROSOFT_CLIENT_ID: "test-microsoft-client",
    MICROSOFT_CLIENT_SECRET: "test-microsoft-secret",
    MICROSOFT_AUTHORITY: `http://127.0.0.1:${String(port)}`,
    GOOGLE_CLIENT_ID: "",
    GOOGLE_CLIENT_SECRET: "",
    APP_PUBLIC_URL: apiUrl,
  };
}

async function waitForApi(url: string): Promise<boolean> {
  const deadline = Date.now() + API_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${url}/api/v1/health`)).ok) return true;
    } catch {
      // Not up yet.
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  return false;
}

/** Stops the backend and waits until it has ended (force-stops it after 15 s), so its port is free again. */
async function stopApi(api: ChildProcess): Promise<void> {
  if (api.exitCode !== null || api.signalCode !== null) return;
  const exited = new Promise<void>((done) => api.once("exit", () => done()));
  api.kill();
  const timer = setTimeout(() => api.kill("SIGKILL"), 15_000);
  await exited;
  clearTimeout(timer);
}

async function desktopTests(env: Record<string, string>): Promise<boolean> {
  if (!run("node", ["tools/seed.ts", "add"])) return false;
  const apiUrl = `http://127.0.0.1:${env["API_PORT"] ?? "3000"}`;
  const providerPort = await freePort();
  // A key of its own for this run: the attempt counters (e.g. 50 sign-ups an hour from this computer)
  // are kept under it, so counts left by earlier runs in the same hour can't block this one. The same
  // trick as the backend's own tests (test-support/auth-app.ts).
  const api = startApi({ ...fakeMicrosoft(apiUrl, providerPort), DATA_ENCRYPTION_KEY: `e2e-${randomUUID()}` });
  try {
    if (!(await waitForApi(apiUrl))) {
      process.stderr.write(`✗ The backend did not answer at ${apiUrl} within 60 s.\n`);
      return false;
    }
    return run("pnpm", ["test:e2e"], {
      VITE_API_URL: apiUrl,
      MEETAPP_E2E_API_URL: apiUrl,
      MEETAPP_E2E_API_PID: String(api.pid),
      MEETAPP_E2E_FAKE_PROVIDER_PORT: String(providerPort),
      MEETAPP_E2E_MAILPIT_URL: `http://127.0.0.1:${env["MAILPIT_WEB_PORT"] ?? "8025"}`,
    });
  } finally {
    await stopApi(api);
  }
}

const docker = checkDocker();
if (docker !== "ok") fail(DOCKER_MESSAGES[docker]);
if (ensureEnvFile(ROOT)) say("Created .env from .env.example (local development settings).");
const added = addMissingSettings(ROOT);
if (added.length > 0) say(`Added new settings to .env from .env.example: ${added.join(", ")}.`);
const env = readEnv(ROOT);

say("Starting the test services (database, cache, call server, file storage, fake inbox)…");
if (!run("docker", [...COMPOSE, "up", "-d", "--wait"])) {
  fail("The test services did not start. Run `docker compose -f infra/docker-compose.yml logs`.");
}

const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : undefined;
const results: [string, boolean][] = [];
if (only !== "desktop") {
  say("\nUnit and integration tests, with coverage:");
  const vitest = run("pnpm", ["exec", "vitest", "run", "--coverage"], { VITEST_INTEGRATION: "1" });
  results.push(["Unit + integration tests, coverage ≥ 80%", vitest]);
}
if (only !== "vitest") {
  say("\nDesktop app tests (real windows):");
  results.push(["Desktop app tests", await desktopTests(env)]);
}

say("\nSummary:");
for (const [name, passed] of results) say(`  ${passed ? "✓" : "✗"} ${name}`);
if (results.some(([, passed]) => !passed)) fail("Some tests failed (see above).");
say("All tests passed.");
