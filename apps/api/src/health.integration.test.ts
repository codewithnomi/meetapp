// Integration tests for GET /api/v1/health against the real local services (F00 T8, AC-F00-02, AC-F00-07).
// Spawns the real backend on a free port, then stops Postgres or Redis with Docker and checks that the
// health answer names exactly that part, stays fast, and recovers without restarting the backend.
// Needs `pnpm dev` services running; run with `pnpm test:integration` (shell wins, e.g. POSTGRES_PORT=5433).
// A stopped service is always started again, even when an assertion fails.
import { createServer, type Server, type Socket } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  compose,
  freePort,
  getHealth,
  localSettings,
  startApi,
  stopApi,
  waitForHealth,
  type HealthAnswer,
  type RunningApi,
} from "./test-support/integration.ts";

const SLOW = { timeout: 120_000 };
const PARTS = ["database", "cache", "callServer", "storage"] as const;
type Part = (typeof PARTS)[number];

const allOk = Object.fromEntries(PARTS.map((part) => [part, "ok"]));
const onlyDown = (down: Part) => Object.fromEntries(PARTS.map((part) => [part, part === down ? "down" : "ok"]));

let api: RunningApi | undefined;

beforeAll(async () => {
  api = startApi(await freePort(), localSettings());
  await waitForHealth(api);
}, 60_000);

afterAll(async () => {
  if (api !== undefined) await stopApi(api).catch(() => api?.child.kill("SIGKILL"));
}, 30_000);

function running(): RunningApi {
  if (api === undefined) throw new Error("the API was not started");
  return api;
}

/**
 * Polls health every 250 ms until `accept` is true or `maxMs` passes. Every answer must arrive in < 2 s
 * (proves no request hangs, e.g. on an offline queue). Returns the accepted answer and when it came.
 */
async function pollHealth(accept: (answer: HealthAnswer) => boolean, maxMs: number) {
  const started = Date.now();
  const durations: number[] = [];
  while (Date.now() - started < maxMs) {
    const answer = await getHealth(running().port);
    durations.push(answer.ms);
    expect(answer.ms, `a health request took ${String(Math.round(answer.ms))} ms`).toBeLessThan(2_000);
    if (accept(answer)) return { answer, afterMs: Date.now() - started, durations };
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`health did not reach the expected state within ${String(maxMs)} ms`);
}

/** Stops a Docker service, waits for health to name it down, starts it again and waits for recovery. */
async function dropAndRecover(service: "postgres" | "redis", part: Part) {
  const pidBefore = running().child.pid;
  let down: Awaited<ReturnType<typeof pollHealth>>;
  try {
    await compose("stop", service);
    down = await pollHealth((answer) => answer.body.checks[part] === "down", 5_000);
  } finally {
    await compose("up", "-d", "--wait", service);
  }
  const up = await pollHealth((answer) => answer.status === 200, 10_000);
  const child = running().child;
  let alive = true;
  try {
    process.kill(pidBefore ?? 0, 0);
  } catch {
    alive = false;
  }
  return { down, up, pidBefore, pidAfter: child.pid, exitCode: child.exitCode, signal: child.signalCode, alive };
}

function expectDroppedAndRecovered(outcome: Awaited<ReturnType<typeof dropAndRecover>>, part: Part) {
  expect(outcome.down.answer.status).toBe(503);
  expect(outcome.down.answer.body).toEqual({ status: "degraded", checks: onlyDown(part) });
  expect(outcome.up.answer.body).toEqual({ status: "ok", checks: allOk });
  expect(outcome.exitCode, running().output()).toBeNull();
  expect(outcome.signal).toBeNull();
  expect(outcome.pidBefore).toBeTypeOf("number");
  expect(outcome.pidAfter).toBe(outcome.pidBefore);
  expect(outcome.alive, "the API process is gone").toBe(true);
}

describe("TC-F00-07 [AC-F00-02] health returns 200 when everything is up", () => {
  it(
    "TC-F00-07 [AC-F00-02] answers 200 within 2 s with ok for database, cache, call server and storage",
    SLOW,
    async () => {
      const answer = await getHealth(running().port);
      expect(answer.ms).toBeLessThan(2_000);
      expect(answer.status).toBe(200);
      expect(answer.body).toEqual({ status: "ok", checks: allOk });
    },
  );
});

describe("TC-F00-08 [AC-F00-02] health returns 503 naming each part that is down", () => {
  let silent: Server | undefined;
  let second: RunningApi | undefined;
  const sockets = new Set<Socket>();

  afterAll(async () => {
    if (second !== undefined) await stopApi(second).catch(() => second?.child.kill("SIGKILL"));
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => (silent ? silent.close(resolve) : resolve(undefined)));
  }, 30_000);

  it(
    "TC-F00-08 [AC-F00-02] (c) a call server that accepts connections but never answers: 503 within 2 s, only callServer down",
    SLOW,
    async () => {
      silent = createServer((socket) => sockets.add(socket));
      const silentPort = await new Promise<number>((resolve) => {
        silent?.listen(0, "127.0.0.1", () => {
          const address = silent?.address();
          resolve(typeof address === "object" && address !== null ? address.port : 0);
        });
      });
      second = startApi(await freePort(), { ...localSettings(), LIVEKIT_PORT: String(silentPort) });
      const first = await waitForHealth(second, 503);
      expect(first.body.checks["callServer"]).toBe("down");

      const answer = await getHealth(second.port);
      expect(answer.ms).toBeLessThan(2_000);
      expect(answer.status).toBe(503);
      expect(answer.body).toEqual({ status: "degraded", checks: onlyDown("callServer") });
      expect(sockets.size, "the backend never connected to the silent call server").toBeGreaterThan(0);
    },
  );
});

describe("TC-F00-14 [AC-F00-07] [AC-F00-02] Postgres drop and recovery without restart", () => {
  it(
    "TC-F00-14 [AC-F00-07] [AC-F00-02] (TC-F00-08 b) database down within 5 s, only database down, ok again within 10 s, same PID",
    SLOW,
    async () => {
      const outcome = await dropAndRecover("postgres", "database");
      expect(outcome.down.afterMs).toBeLessThan(5_000);
      expectDroppedAndRecovered(outcome, "database");
    },
  );
});

describe("TC-F00-15 [AC-F00-07] [AC-F00-02] Redis drop and recovery without restart", () => {
  it(
    "TC-F00-15 [AC-F00-07] [AC-F00-02] (TC-F00-08 a) cache down within 5 s, every answer < 2 s, ok again within 10 s, same PID",
    SLOW,
    async () => {
      const outcome = await dropAndRecover("redis", "cache");
      expect(outcome.down.afterMs).toBeLessThan(5_000);
      for (const ms of [...outcome.down.durations, ...outcome.up.durations]) expect(ms).toBeLessThan(2_000);
      expectDroppedAndRecovered(outcome, "cache");
    },
  );
});
