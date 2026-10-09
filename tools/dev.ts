// `pnpm dev` (after tools/preflight.mjs): checks Docker and ports, creates .env if missing, starts the
// local services and then the apps, and prints where everything runs (AC-F00-01, design.md section 4).
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOCKER_MESSAGES,
  addressTable,
  checkDocker,
  ensureEnvFile,
  findPortProblems,
  neededPorts,
  parseOwnPorts,
  readEnv,
} from "./dev-checks.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const COMPOSE = ["compose", "-f", join(ROOT, "infra/docker-compose.yml"), "--env-file", join(ROOT, ".env")];

function say(message: string): void {
  process.stdout.write(`${message}\n`);
}

function stop(message: string): never {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
}

function ownPorts(): Set<string> {
  const result = spawnSync("docker", [...COMPOSE, "ps", "--format", "json"], { encoding: "utf8", timeout: 10_000 });
  return result.status === 0 ? parseOwnPorts(result.stdout) : new Set();
}

/** Apps and packages that have a `dev` script; none exist until F00 steps T7, T14 and T15. */
function appsWithDevScript(): string[] {
  const appsDir = join(ROOT, "apps");
  if (!existsSync(appsDir)) return [];
  return readdirSync(appsDir).filter((name) => {
    const manifest = join(appsDir, name, "package.json");
    if (!existsSync(manifest)) return false;
    const scripts = (JSON.parse(readFileSync(manifest, "utf8")) as { scripts?: Record<string, string> }).scripts;
    return typeof scripts?.["dev"] === "string";
  });
}

async function main(): Promise<void> {
  const docker = checkDocker();
  if (docker !== "ok") stop(DOCKER_MESSAGES[docker]);

  if (ensureEnvFile(ROOT)) say("Created .env from .env.example (local development settings).");
  const env = readEnv(ROOT);

  const problems = await findPortProblems(neededPorts(env), ownPorts());
  if (problems.length > 0) stop(problems.join("\n✗ "));

  say("Starting local services (the first time downloads them, which can take a few minutes)…");
  const up = spawnSync("docker", [...COMPOSE, "up", "-d", "--wait"], { stdio: "inherit" });
  if (up.status !== 0) stop("The local services did not start. Run `docker compose -f infra/docker-compose.yml logs`.");

  const apps = appsWithDevScript();
  say(`\nMeetApp is running on this computer:\n${addressTable(env, apps.includes("api"))}\n`);
  say("Stop the services with `pnpm dev:stop` (your data is kept).");
  if (apps.length === 0) {
    say("No apps to start yet: the backend and desktop app arrive in F00 steps T7, T14 and T15.");
    return;
  }
  const turbo = spawn("pnpm", ["run", "dev:apps"], { cwd: ROOT, stdio: "inherit" });
  turbo.on("exit", (code) => process.exit(code ?? 0));
}

await main();
