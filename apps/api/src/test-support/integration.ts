// Helpers for integration tests that run the real backend or talk to the local services (Docker).
// Settings come from .env (or .env.example); the shell wins, e.g. POSTGRES_PORT=5433. Values are never printed.
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { loadConfig, type Config } from "../config/config.ts";
import { fakeEnv } from "./fake-env.ts";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const SERVER = join(ROOT, "apps/api/src/server.ts");
const ENV_FILE = existsSync(join(ROOT, ".env")) ? join(ROOT, ".env") : join(ROOT, ".env.example");
const COMPOSE_FILE = join(ROOT, "infra/docker-compose.yml");
const HEALTH_PATH = "/api/v1/health";
const SERVICE_HOSTS = ["POSTGRES_HOST", "REDIS_HOST", "LIVEKIT_HOST", "STORAGE_HOST", "MAILPIT_HOST"];

function envFileEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match?.[1] !== undefined) entries[match[1]] = match[2] ?? "";
  }
  return entries;
}

/** Every setting of the env file, with non-empty shell values winning. */
export function localSettings(): Record<string, string> {
  const entries = envFileEntries();
  for (const key of Object.keys(entries)) {
    const fromShell = process.env[key];
    if (fromShell !== undefined && fromShell !== "") entries[key] = fromShell;
  }
  return entries;
}

/** One setting (see localSettings); throws if the env file does not have it. */
export function setting(name: string): string {
  const value = localSettings()[name];
  if (value === undefined) throw new Error(`${name} is not set in ${ENV_FILE}`);
  return value;
}

/** The backend's validated settings for the local services, in test mode. */
export function localConfig(): Config {
  return loadConfig({ ...localSettings(), NODE_ENV: "test" });
}

/** A port nobody is using right now. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(typeof address === "object" && address !== null ? address.port : 0));
    });
  });
}

export interface RunningApi {
  child: ChildProcess;
  port: number;
  output: () => string;
}

/** Spawns the real backend (server.ts) on 127.0.0.1:port; `env` overrides the fake test settings. */
export function startApi(port: number, env: Record<string, string>): RunningApi {
  const fullEnv = {
    ...fakeEnv("test"),
    // An older .env may lack the *_HOST settings; then the services are on this computer.
    ...Object.fromEntries(SERVICE_HOSTS.map((key) => [key, "127.0.0.1"])),
    ...env,
    NODE_ENV: "test",
    API_HOST: "127.0.0.1",
    API_PORT: String(port),
    PATH: process.env["PATH"] ?? "",
  };
  const child = spawn(process.execPath, [SERVER], { cwd: ROOT, env: fullEnv, stdio: ["ignore", "pipe", "pipe"] });
  const chunks: string[] = [];
  child.stdout?.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
  child.stderr?.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
  return { child, port, output: () => chunks.join("") };
}

export interface HealthAnswer {
  status: number;
  body: { status: string; checks: Record<string, string> };
  ms: number;
}

/** GET /api/v1/health with a hard 5 s limit; reports how long it took. */
export async function getHealth(port: number): Promise<HealthAnswer> {
  const started = performance.now();
  const response = await fetch(`http://127.0.0.1:${String(port)}${HEALTH_PATH}`, {
    signal: AbortSignal.timeout(5_000),
  });
  const body = (await response.json()) as HealthAnswer["body"];
  return { status: response.status, body, ms: performance.now() - started };
}

/** Waits until health answers with the expected HTTP status (default 200, max 20 s). */
export async function waitForHealth(running: RunningApi, expected = 200, maxMs = 20_000): Promise<HealthAnswer> {
  const deadline = Date.now() + maxMs;
  let last: HealthAnswer | undefined;
  while (Date.now() < deadline) {
    if (running.child.exitCode !== null) throw new Error(`the API exited early:\n${running.output()}`);
    try {
      last = await getHealth(running.port);
      if (last.status === expected) return last;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(
    `health did not answer ${String(expected)} within ${String(maxMs)} ms (last: ${JSON.stringify(last?.body)}):\n${running.output()}`,
  );
}

/** Sends SIGTERM and resolves with the exit code (max 10 s). */
export function stopApi(running: RunningApi): Promise<number | null> {
  return new Promise((resolve, reject) => {
    if (running.child.exitCode !== null) {
      resolve(running.child.exitCode);
      return;
    }
    const timer = setTimeout(() => reject(new Error("the API did not stop within 10 s")), 10_000);
    running.child.once("exit", (code) => {
      clearTimeout(timer);
      resolve(code);
    });
    running.child.kill("SIGTERM");
  });
}

/** Runs `docker compose <args>` for the local services, with the shell's port overrides. */
export async function compose(...args: string[]): Promise<void> {
  await promisify(execFile)("docker", ["compose", "-f", COMPOSE_FILE, "--env-file", ENV_FILE, ...args], {
    cwd: ROOT,
    env: process.env,
    timeout: 90_000,
  });
}

/** Runs one of the `tools/*.ts` check commands (like `pnpm email:test`) and collects its output. */
export function runTool(script: string): Promise<{ code: number | null; output: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(ROOT, "tools", script)], { cwd: ROOT, env: process.env });
    const chunks: string[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    child.once("exit", (code) => resolve({ code, output: chunks.join("") }));
  });
}
