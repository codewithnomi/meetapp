// `pnpm check:container` (AC-F00-39, TC-F00-81; also run by CI): builds the backend image, starts it
// against the running local services and checks that it is healthy, runs as a non-root user, holds no
// .env file, and that a secret scan over its files finds nothing. Needs Docker and the local services.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GITLEAKS_IMAGE } from "./check-secrets.mjs";
import { ROOT, fail } from "./cli.ts";
import { CONTAINER, IMAGE, buildArgs, runArgs, secretScanArgs } from "./container-commands.ts";
import { DOCKER_MESSAGES, checkDocker } from "./dev-checks.ts";

const HEALTHY_WITHIN_MS = 90_000;

function docker(args: string[], quiet = false): { ok: boolean; out: string } {
  const result = spawnSync("docker", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: quiet ? "pipe" : ["ignore", "pipe", "inherit"],
  });
  return { ok: result.status === 0, out: (result.stdout ?? "").trim() };
}

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const server = createServer().listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address ? address.port : 0));
    });
  });
}

async function waitHealthy(port: number): Promise<boolean> {
  const deadline = Date.now() + HEALTHY_WITHIN_MS;
  while (Date.now() < deadline) {
    const status = docker(["inspect", "-f", "{{.State.Health.Status}}", CONTAINER], true).out;
    const answer = await fetch(`http://127.0.0.1:${String(port)}/api/v1/health`).catch(() => undefined);
    if (status === "healthy" && answer?.status === 200) return true;
    await new Promise((done) => setTimeout(done, 2000));
  }
  return false;
}

function scanForSecrets(): boolean {
  const dir = mkdtempSync(join(tmpdir(), "meetapp-image-"));
  try {
    const exported = spawnSync("sh", ["-c", `docker export ${CONTAINER} | tar -x -C "${dir}" app`], {
      stdio: "inherit",
    });
    if (exported.status !== 0) return false;
    return docker(secretScanArgs(GITLEAKS_IMAGE, join(dir, "app"), join(ROOT, ".gitleaks.toml"))).ok;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function checks(): Promise<string[]> {
  const problems: string[] = [];
  const port = await freePort();
  if (!docker(runArgs(join(ROOT, ".env"), port)).ok) return ["The container did not start."];
  if (!(await waitHealthy(port))) problems.push("Not healthy: /api/v1/health did not answer 200 within 90 s.");
  if (docker(["exec", CONTAINER, "id", "-u"], true).out === "0") problems.push("The container runs as root.");
  const envFiles = docker(["exec", CONTAINER, "find", "/app", "-name", ".env*"], true).out;
  if (envFiles !== "") problems.push(`The image contains settings files: ${envFiles.replace(/\n/g, ", ")}`);
  if (!scanForSecrets()) problems.push("The secret scan found something in the image (see above).");
  return problems;
}

const state = checkDocker();
if (state !== "ok") fail(DOCKER_MESSAGES[state]);
process.stdout.write("Building the backend image…\n");
if (!docker(buildArgs(ROOT)).ok) fail("The image did not build.");
docker(["rm", "-f", CONTAINER], true);
const problems = await checks();
if (problems.length > 0) process.stderr.write(docker(["logs", "--tail", "40", CONTAINER], true).out + "\n");
docker(["rm", "-f", CONTAINER], true);
if (problems.length > 0) fail(`Container check failed:\n  - ${problems.join("\n  - ")}`);
process.stdout.write(`✓ ${IMAGE}: healthy, runs as a non-root user, no .env, no secrets found.\n`);
