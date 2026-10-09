// Integration tests for the local services (F00 T4). They need Docker running and start the services
// with `docker compose up -d --wait` (already-running services are reused). Run with
// `pnpm test:integration`. Port overrides from the shell (e.g. POSTGRES_PORT=5433) are respected,
// exactly as docker compose itself respects them.
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createConnection } from "node:net";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const COMPOSE_FILE = join(ROOT, "infra/docker-compose.yml");
const ENV_FILE = existsSync(join(ROOT, ".env")) ? join(ROOT, ".env") : join(ROOT, ".env.example");
const SLOW = { timeout: 300_000 };

function run(command: string, args: string[], timeout = 280_000) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", timeout, env: process.env });
  return { code: result.status, stdout: result.stdout ?? "", output: `${result.stdout}\n${result.stderr}` };
}

function compose(args: string[], timeout?: number) {
  return run("docker", ["compose", "-f", COMPOSE_FILE, "--env-file", ENV_FILE, ...args], timeout);
}

function composeOk(args: string[], timeout?: number) {
  const result = compose(args, timeout);
  expect(result.code, `docker compose ${args.join(" ")}\n${result.output}`).toBe(0);
  return result.stdout.trim();
}

/** A setting as docker compose sees it: the shell environment wins over the env file. */
function setting(name: string) {
  const fromShell = process.env[name];
  if (fromShell !== undefined && fromShell !== "") return fromShell;
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match?.[1] === name) return match[2] ?? "";
  }
  throw new Error(`${name} is not set in ${ENV_FILE}`);
}

interface PublishedPort {
  service: string;
  target: number;
  hostPort: number;
}

/** Every published TCP port of the running services, with the host port Docker actually used. */
function publishedTcpPorts(): PublishedPort[] {
  const config = JSON.parse(composeOk(["config", "--format", "json"])) as {
    services: Record<string, { ports?: { target: number; protocol?: string }[] }>;
  };
  const ports: PublishedPort[] = [];
  for (const [service, definition] of Object.entries(config.services)) {
    for (const port of definition.ports ?? []) {
      if ((port.protocol ?? "tcp") !== "tcp") continue; // UDP has no connect step to test.
      const address = composeOk(["port", service, String(port.target)]);
      const hostPort = Number(/:(\d+)$/.exec(address)?.[1]);
      expect(hostPort, `${service}:${port.target} -> "${address}"`).toBeGreaterThan(0);
      ports.push({ service, target: port.target, hostPort });
    }
  }
  return ports;
}

/** True when a TCP connection to host:port is accepted within 2 seconds. */
function canConnect(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (ok: boolean) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(2_000, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

/** The Mac's address on the local network (first non-internal IPv4), if it has one. */
function lanAddress() {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) return address.address;
    }
  }
  return undefined;
}

const LAN = lanAddress();

beforeAll(() => {
  composeOk(["up", "-d", "--wait"]);
}, 300_000);

describe("TC-F00-56 [AC-F00-23] other devices cannot connect", () => {
  it.skipIf(LAN === undefined)(
    "TC-F00-56 [AC-F00-23] every published TCP port refuses the LAN address and accepts 127.0.0.1 (skipped if no LAN IPv4)",
    async () => {
      const ports = publishedTcpPorts();
      expect(ports.length).toBeGreaterThan(0);
      for (const { service, target, hostPort } of ports) {
        const label = `${service} ${target} -> host port ${hostPort}`;
        expect(await canConnect("127.0.0.1", hostPort), `${label} on 127.0.0.1`).toBe(true);
        expect(await canConnect(LAN ?? "", hostPort), `${label} on LAN ${LAN}`).toBe(false);
      }
    },
    SLOW.timeout,
  );

  it.todo("TC-F00-56 [AC-F00-23] the API port refuses the LAN address (needs the API, T7)");
  it.todo("TC-F00-56 [AC-F00-23] monitoring-profile ports refuse the LAN address (needs monitoring, T20)");
});

// ---------- TC-F00-82: data survives a restart ----------

const TABLE = "f00_persistence_check";
const REDIS_KEY = "f00:persistence";
const OBJECT = "f00-persistence.txt";
const MARKER = randomUUID();

/** Runs SQL inside the postgres container, using the container's own user and database settings. */
function psql(sql: string) {
  const script = 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -tA -c "$1"';
  return composeOk(["exec", "-T", "postgres", "sh", "-c", script, "sh", sql]);
}

function redis(...args: string[]) {
  return composeOk(["exec", "-T", "redis", "redis-cli", ...args]);
}

/** Calls the S3-compatible storage from this computer with a signed request (curl --aws-sigv4). */
function storage(method: string, extra: string[] = []) {
  const port = Number(/:(\d+)$/.exec(composeOk(["port", "storage", "9000"]))?.[1]);
  const url = `http://127.0.0.1:${port}/${setting("STORAGE_BUCKET")}/${OBJECT}`;
  const auth = ["--aws-sigv4", `aws:amz:${setting("STORAGE_REGION")}:s3`];
  const user = ["--user", `${setting("STORAGE_ACCESS_KEY")}:${setting("STORAGE_SECRET_KEY")}`];
  return run("curl", ["-fsS", "-X", method, ...auth, ...user, ...extra, url], 30_000);
}

function readBack() {
  return {
    postgres: psql(`SELECT id FROM ${TABLE} WHERE id = '${MARKER}'`),
    redis: redis("GET", REDIS_KEY),
    storage: storage("GET").stdout,
  };
}

describe("TC-F00-82 [AC-F00-40] local data survives a restart", () => {
  let wrote = false;

  afterAll(() => {
    if (!wrote) return;
    compose(["up", "-d", "--wait"]);
    psql(`DROP TABLE IF EXISTS ${TABLE}`);
    redis("DEL", REDIS_KEY);
    storage("DELETE");
  }, 300_000);

  it(
    "TC-F00-82 [AC-F00-40] a Postgres row, a Redis key and a stored file survive down (without -v) and up",
    () => {
      wrote = true;
      psql(`CREATE TABLE IF NOT EXISTS ${TABLE} (id text PRIMARY KEY)`);
      psql(`INSERT INTO ${TABLE} (id) VALUES ('${MARKER}') ON CONFLICT (id) DO NOTHING`);
      expect(redis("SET", REDIS_KEY, MARKER)).toBe("OK");
      const put = storage("PUT", ["--data-binary", MARKER]);
      expect(put.code, put.output).toBe(0);
      expect(readBack()).toEqual({ postgres: MARKER, redis: MARKER, storage: MARKER });

      composeOk(["down"]);
      expect(compose(["ps", "-q"]).stdout.trim(), "services still running after down").toBe("");
      composeOk(["up", "-d", "--wait"]);

      expect(readBack()).toEqual({ postgres: MARKER, redis: MARKER, storage: MARKER });
    },
    SLOW.timeout,
  );
});
