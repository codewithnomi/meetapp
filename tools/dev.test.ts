// Tests for the start command `pnpm dev` (F00 T5): the Docker check, .env creation, the port checks
// and the address table (AC-F00-01, AC-F00-05). Docker is faked with small shell scripts on PATH, so
// these tests never start a real service and never read or write the real .env.
import { spawnSync } from "node:child_process";
import { createSocket, type Socket } from "node:dgram";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type AddressInfo, type Server } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  DOCKER_MESSAGES,
  DOCKER_TIMEOUT_MS,
  type NeededPort,
  addressTable,
  checkDocker,
  ensureEnvFile,
  findPortProblems,
  neededPorts,
  parseEnvFile,
  parseOwnPorts,
  portKey,
} from "./dev-checks.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DEV = join(ROOT, "tools/dev.ts");
const ENV_EXAMPLE = readFileSync(join(ROOT, ".env.example"), "utf8");
const MISSING = "Docker isn't installed. See docs/getting-started.md.";
const NOT_RUNNING = "Docker isn't running. Open Docker Desktop and try again.";
/** A unique sleep length so a leftover hanging fake docker can be found with pgrep. */
const HANG_MARK = "61.4321";

const tempDirs: string[] = [];
afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** A folder holding a fake `docker` shell script with the given body. */
function fakeDocker(body: string) {
  const dir = tempDir("meetapp-fake-docker-");
  const path = join(dir, "docker");
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
  return { dir, path };
}

/** Runs tools/dev.ts with only `pathDir` on PATH (node itself is started by its full path). */
function runDev(pathDir: string) {
  const envBefore = existsSync(join(ROOT, ".env"));
  const started = Date.now();
  const result = spawnSync(process.execPath, [DEV], {
    cwd: ROOT,
    env: { HOME: process.env["HOME"] ?? "", PATH: pathDir },
    encoding: "utf8",
    timeout: 20_000,
  });
  return { ...result, elapsed: Date.now() - started, envBefore };
}

function expectNoEnvCreated(run: { envBefore: boolean }) {
  // Only meaningful when the developer has no .env yet; the file's contents are never read.
  if (!run.envBefore) expect(existsSync(join(ROOT, ".env"))).toBe(false);
}

describe("Docker check", () => {
  it("TC-F00-02 [AC-F00-01] exits within 10 s with 'Docker isn't installed' when docker is not found", () => {
    const run = runDev(tempDir("meetapp-no-docker-"));
    expect(run.status).toBe(1);
    expect(run.elapsed).toBeLessThan(10_000);
    expect(run.stderr).toContain(MISSING);
    expect(run.stdout).not.toContain("Starting local services");
    expectNoEnvCreated(run);
  });

  it("TC-F00-02 [AC-F00-01] checkDocker reports 'missing' for a docker command that does not exist", () => {
    expect(checkDocker("/nonexistent/docker")).toBe("missing");
    expect(DOCKER_MESSAGES.missing).toBe(MISSING);
  });

  it("TC-F00-03 [AC-F00-01] exits within 10 s with 'Docker isn't running' when docker info fails", () => {
    const run = runDev(fakeDocker("exit 1").dir);
    expect(run.status).toBe(1);
    expect(run.elapsed).toBeLessThan(10_000);
    expect(run.stderr).toContain(NOT_RUNNING);
    expect(run.stdout).not.toContain("Starting local services");
    expectNoEnvCreated(run);
  });

  it("TC-F00-03 [AC-F00-01] cuts a hanging docker info at 3 s and says 'Docker isn't running'", () => {
    const run = runDev(fakeDocker(`exec /bin/sleep ${HANG_MARK}`).dir);
    expect(run.status).toBe(1);
    expect(run.elapsed).toBeGreaterThanOrEqual(DOCKER_TIMEOUT_MS - 200);
    expect(run.elapsed).toBeLessThan(10_000);
    expect(run.stderr).toContain(NOT_RUNNING);
    expectNoEnvCreated(run);
    // `exec` makes sleep the docker process itself, so the SIGKILL must have ended it.
    const leftover = spawnSync("/usr/bin/pgrep", ["-f", `sleep ${HANG_MARK}`], { encoding: "utf8" });
    expect(leftover.stdout.trim()).toBe("");
  });

  it("TC-F00-03 [AC-F00-01] checkDocker reports 'not-running' for a failing and a hanging docker", () => {
    expect(checkDocker(fakeDocker("exit 1").path)).toBe("not-running");
    const started = Date.now();
    expect(checkDocker(fakeDocker(`exec /bin/sleep ${HANG_MARK}`).path)).toBe("not-running");
    expect(Date.now() - started).toBeLessThan(DOCKER_TIMEOUT_MS + 2000);
    expect(checkDocker(fakeDocker("exit 0").path)).toBe("ok");
    expect(DOCKER_MESSAGES["not-running"]).toBe(NOT_RUNNING);
  });
});

const held: (Server | Socket)[] = [];
afterEach(async () => {
  await Promise.all(held.splice(0).map((handle) => new Promise<void>((done) => handle.close(() => done()))));
});

function holdTcp(host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    held.push(server);
    server.once("error", reject);
    server.listen(0, host, () => resolve((server.address() as AddressInfo).port));
  });
}

function holdUdp(): Promise<number> {
  return new Promise((resolve, reject) => {
    const socket = createSocket("udp4");
    held.push(socket);
    socket.once("error", reject);
    socket.bind(0, "127.0.0.1", () => resolve(socket.address().port));
  });
}

/** A port that was free a moment ago (taken and released again). */
async function freeTcpPort(): Promise<number> {
  const port = await holdTcp("127.0.0.1");
  const server = held.pop() as Server;
  await new Promise<void>((done) => server.close(() => done()));
  return port;
}

function database(port: number): NeededPort {
  return { port, protocol: "tcp", service: "database", likely: "a local PostgreSQL", setting: "POSTGRES_PORT" };
}

function media(port: number): NeededPort {
  return { port, protocol: "udp", service: "call server media", likely: "another LiveKit" };
}

describe("Port checks", () => {
  it("TC-F00-04 [AC-F00-01] names a taken TCP port, the likely program and the .env fix", async () => {
    const port = await holdTcp("127.0.0.1");
    expect(await findPortProblems([database(port)], new Set())).toEqual([
      `Port ${String(port)} is in use by another program (probably a local PostgreSQL). Stop it or change POSTGRES_PORT in .env.`,
    ]);
  });

  it("TC-F00-04 [AC-F00-01] names a taken UDP port with '/udp' and a fix without a setting", async () => {
    const port = await holdUdp();
    expect(await findPortProblems([media(port)], new Set())).toEqual([
      `Port ${String(port)}/udp is in use by another program (probably another LiveKit). Stop it and try again.`,
    ]);
  });

  it("TC-F00-04 [AC-F00-01] detects a program listening on all addresses", async () => {
    const anyV4 = await holdTcp("0.0.0.0");
    expect(await findPortProblems([database(anyV4)], new Set())).toHaveLength(1);
    const anyV6 = await holdTcp("::");
    expect(await findPortProblems([database(anyV6)], new Set())).toHaveLength(1);
  });

  it("TC-F00-04 [AC-F00-01] reports nothing for a free port", async () => {
    expect(await findPortProblems([database(await freeTcpPort())], new Set())).toEqual([]);
  });

  it("TC-F00-04 [AC-F00-01] needed ports come from .env.example and follow a changed setting", () => {
    const env = parseEnvFile(ENV_EXAMPLE);
    const ports = neededPorts(env);
    expect(ports).toContainEqual(expect.objectContaining({ port: 5432, protocol: "tcp", setting: "POSTGRES_PORT" }));
    expect(ports).toContainEqual(expect.objectContaining({ port: 7882, protocol: "udp" }));
    const moved = neededPorts({ ...env, POSTGRES_PORT: "55432" });
    expect(moved.find((needed) => needed.setting === "POSTGRES_PORT")?.port).toBe(55432);
    expect(moved.some((needed) => needed.port === 5432)).toBe(false);
  });

  it("TC-F00-04 [AC-F00-01] checks every needed port well within 10 s", async () => {
    // Same list as `pnpm dev`, moved to free random ports so the result doesn't depend on this computer.
    const ports: NeededPort[] = [];
    for (const needed of neededPorts(parseEnvFile(ENV_EXAMPLE))) ports.push({ ...needed, port: await freeTcpPort() });
    const taken = await holdTcp("127.0.0.1");
    ports.push(database(taken));
    const started = Date.now();
    const problems = await findPortProblems(ports, new Set());
    expect(Date.now() - started).toBeLessThan(5000);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain(`Port ${String(taken)} `);
  });

  it("TC-F00-05 [AC-F00-01] ports held by this project's own containers are not reported", async () => {
    const tcp = await holdTcp("127.0.0.1");
    const udp = await holdUdp();
    const own = new Set([portKey(tcp, "tcp"), portKey(udp, "udp")]);
    expect(await findPortProblems([database(tcp), media(udp)], own)).toEqual([]);
  });

  it("TC-F00-05 [AC-F00-01] parseOwnPorts reads `docker compose ps --format json` output", () => {
    const line = (publishers: object[]) => JSON.stringify({ Name: "meetapp-x-1", Publishers: publishers });
    const output = [
      line([{ URL: "127.0.0.1", TargetPort: 5432, PublishedPort: 5432, Protocol: "tcp" }]),
      line([
        { URL: "127.0.0.1", TargetPort: 7880, PublishedPort: 7880, Protocol: "tcp" },
        { URL: "127.0.0.1", TargetPort: 7882, PublishedPort: 7882, Protocol: "udp" },
        { URL: "", TargetPort: 9999, PublishedPort: 0, Protocol: "tcp" },
      ]),
      JSON.stringify({ Name: "meetapp-no-ports-1" }),
      "",
    ].join("\n");
    expect(parseOwnPorts(output)).toEqual(new Set(["5432/tcp", "7880/tcp", "7882/udp"]));
    expect(parseOwnPorts("")).toEqual(new Set());
  });
});

describe(".env file", () => {
  it("TC-F00-06 [AC-F00-01, AC-F00-05] creates .env from .env.example with the same content", () => {
    const dir = tempDir("meetapp-env-");
    writeFileSync(join(dir, ".env.example"), ENV_EXAMPLE);
    expect(ensureEnvFile(dir)).toBe(true);
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe(ENV_EXAMPLE);
    expect(ensureEnvFile(dir)).toBe(false);
  });

  it("TC-F00-06 [AC-F00-01, AC-F00-05] never overwrites an existing .env", () => {
    const dir = tempDir("meetapp-env-");
    writeFileSync(join(dir, ".env.example"), ENV_EXAMPLE);
    writeFileSync(join(dir, ".env"), "POSTGRES_PORT=55432\n");
    expect(ensureEnvFile(dir)).toBe(false);
    expect(readFileSync(join(dir, ".env"), "utf8")).toBe("POSTGRES_PORT=55432\n");
  });

  it("TC-F00-06 [AC-F00-01, AC-F00-05] the start command says when it created .env", () => {
    // Static check: running tools/dev.ts end to end would start the Docker services.
    const source = readFileSync(DEV, "utf8");
    expect(source).toMatch(/if \(ensureEnvFile\(ROOT\)\) say\("Created \.env from \.env\.example/);
  });

  it("TC-F00-06 [AC-F00-01] parseEnvFile skips comments and blanks, keeps empty values, later lines win", () => {
    const text = "# comment\n\nA=1\n  B = two words  \nEMPTY=\nA=3\nlower=x\n# C=4\n";
    expect(parseEnvFile(text)).toEqual({ A: "3", B: "two words", EMPTY: "" });
  });
});

describe("Address table", () => {
  const env = parseEnvFile(ENV_EXAMPLE);

  it("TC-F00-06 [AC-F00-01] lists every local address and marks the backend as not built yet", () => {
    const table = addressTable(env, false);
    for (const address of [
      "ws://127.0.0.1:7880",
      "127.0.0.1:5432",
      "127.0.0.1:6379",
      "http://127.0.0.1:9000",
      "http://127.0.0.1:9001",
      "http://127.0.0.1:8025",
    ])
      expect(table).toContain(address);
    expect(table).toMatch(/Backend\s+not built yet/);
  });

  it("TC-F00-06 [AC-F00-01] shows the backend address from API_PORT once the API exists", () => {
    expect(addressTable({ ...env, API_PORT: "3456" }, true)).toMatch(/Backend\s+http:\/\/127\.0\.0\.1:3456/);
  });

  it("TC-F00-06 [AC-F00-01] shows the app screens' address once apps/web exists", () => {
    expect(addressTable(env, true, false)).toMatch(/App screens \(in a browser\)\s+not built yet/);
    expect(addressTable(env, true, true)).toMatch(/App screens \(in a browser\)\s+http:\/\/127\.0\.0\.1:5173/);
  });
});
