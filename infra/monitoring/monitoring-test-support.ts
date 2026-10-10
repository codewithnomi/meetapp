// Small helpers shared by the monitoring tests (settings test and the slow monitoring checks).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";

export const ROOT = fileURLToPath(new URL("../..", import.meta.url));
export const COMPOSE_FILE = join(ROOT, "infra/docker-compose.yml");
export const ENV_EXAMPLE = join(ROOT, ".env.example");
const ENV_FILE = existsSync(join(ROOT, ".env")) ? join(ROOT, ".env") : ENV_EXAMPLE;

/** Reads and parses a YAML or JSON file below the repository root. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test files read loosely shaped settings
export type Json = any;

export function readYaml(relativePath: string): Json {
  return parse(readFileSync(join(ROOT, relativePath), "utf8"));
}

/** The docker compose command line for the monitoring files. */
function composeArgs(args: string[]) {
  return ["compose", "-f", COMPOSE_FILE, "--env-file", ENV_FILE, ...args];
}

/** Runs `docker compose` and returns its result. */
export function compose(args: string[], timeout = 280_000) {
  const result = spawnSync("docker", composeArgs(args), { cwd: ROOT, encoding: "utf8", timeout, env: process.env });
  return { code: result.status, stdout: result.stdout ?? "", output: `${result.stdout}\n${result.stderr}` };
}

/** A setting as docker compose sees it: the shell environment wins over the env file. */
export function setting(name: string) {
  const fromShell = process.env[name];
  if (fromShell !== undefined && fromShell !== "") return fromShell;
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match?.[1] === name) return match[2] ?? "";
  }
  throw new Error(`${name} is not set in ${ENV_FILE}`);
}
