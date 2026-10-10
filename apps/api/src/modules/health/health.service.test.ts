// Unit tests for the health check (F00 T8, AC-F00-02): every part is checked in parallel, each with
// its own time limit; one failing or hanging part is "down" without slowing or breaking the others.
// The route tests use app.inject() with fake checks, so no service or network port is needed.
import { healthResponseSchema } from "@meetapp/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.ts";
import { captureLogs, fakeConfig } from "../../test-support/fake-env.ts";
import { CHECK_TIMEOUT_MS, createHealthService, type HealthCheck } from "./health.service.ts";

const ok: HealthCheck = async () => "pong";
const fails: HealthCheck = async () => Promise.reject(new Error("connection refused"));
/** A check that never answers (like a server that accepts the connection and then says nothing). */
const hangs: HealthCheck = () => new Promise(() => undefined);

async function timed<T>(work: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const started = performance.now();
  const result = await work();
  return { result, ms: performance.now() - started };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("TC-F00-07 [AC-F00-02] health service: every part ok", () => {
  it("TC-F00-07 [AC-F00-02] all checks ok gives status ok and ok for each part", async () => {
    const health = createHealthService({ database: ok, cache: ok, callServer: ok, storage: ok });
    expect(await health.check()).toEqual({
      status: "ok",
      checks: { database: "ok", cache: "ok", callServer: "ok", storage: "ok" },
    });
  });

  it("TC-F00-07 [AC-F00-02] the default time limit per part is 1.5 s", () => {
    expect(CHECK_TIMEOUT_MS).toBe(1500);
  });

  it("TC-F00-07 [AC-F00-02] no timer is left running after a fast answer", async () => {
    vi.useFakeTimers();
    const health = createHealthService({ database: ok, cache: ok });
    await health.check();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("TC-F00-08 [AC-F00-02] health service: parts that are down", () => {
  it.each(["database", "cache", "callServer", "storage"])(
    "TC-F00-08 [AC-F00-02] only %s failing gives degraded with exactly that part down",
    async (broken) => {
      const names = ["database", "cache", "callServer", "storage"];
      const checks = Object.fromEntries(names.map((name) => [name, name === broken ? fails : ok]));
      const result = await createHealthService(checks).check();
      expect(result.status).toBe("degraded");
      for (const name of names) expect(result.checks[name], name).toBe(name === broken ? "down" : "ok");
    },
  );

  it("TC-F00-08 [AC-F00-02] a check that throws inside an async function counts as down", async () => {
    const throws: HealthCheck = async () => {
      throw new TypeError("boom");
    };
    const result = await createHealthService({ database: throws, cache: ok }).check();
    expect(result).toEqual({ status: "degraded", checks: { database: "down", cache: "ok" } });
  });

  it("TC-F00-08 [AC-F00-02] a check that never answers is cut at the time limit and counts as down", async () => {
    const health = createHealthService({ callServer: hangs, database: ok }, 100);
    const { result, ms } = await timed(() => health.check());
    expect(result).toEqual({ status: "degraded", checks: { callServer: "down", database: "ok" } });
    expect(ms).toBeGreaterThanOrEqual(90);
    expect(ms).toBeLessThan(400);
  });

  it("TC-F00-08 [AC-F00-02] several hanging parts run in parallel: total stays under 2 s with the default limit", async () => {
    const health = createHealthService({ database: hangs, cache: hangs, callServer: hangs, storage: ok });
    const { result, ms } = await timed(() => health.check());
    expect(result).toEqual({
      status: "degraded",
      checks: { database: "down", cache: "down", callServer: "down", storage: "ok" },
    });
    expect(ms).toBeGreaterThanOrEqual(CHECK_TIMEOUT_MS - 50);
    expect(ms).toBeLessThan(2000);
  }, 5_000);

  it("TC-F00-08 [AC-F00-02] the time-limit timer is cleared once the hanging check is cut", async () => {
    vi.useFakeTimers();
    const pending = createHealthService({ callServer: hangs }, 100).check();
    expect(vi.getTimerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(await pending).toEqual({ status: "degraded", checks: { callServer: "down" } });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("TC-F00-08 [AC-F00-02] a slow answer that arrives after the limit does not change the result", async () => {
    vi.useFakeTimers();
    const late: HealthCheck = () => new Promise((resolve) => setTimeout(resolve, 500));
    const pending = createHealthService({ storage: late }, 100).check();
    await vi.advanceTimersByTimeAsync(600);
    expect(await pending).toEqual({ status: "degraded", checks: { storage: "down" } });
  });
});

describe("TC-F00-07 / TC-F00-08 [AC-F00-02] GET /api/v1/health route", () => {
  async function callHealth(checks: Record<string, HealthCheck>) {
    const app = await buildApp(fakeConfig("test"), { logDestination: captureLogs().stream, healthChecks: checks });
    try {
      return await app.inject({ method: "GET", url: "/api/v1/health" });
    } finally {
      await app.close();
    }
  }

  it("TC-F00-07 [AC-F00-02] answers 200 with every part ok when all checks pass", async () => {
    const response = await callHealth({ database: ok, cache: ok, callServer: ok, storage: ok });
    expect(response.statusCode).toBe(200);
    const body: unknown = response.json();
    expect(healthResponseSchema.parse(body)).toEqual({
      status: "ok",
      checks: { database: "ok", cache: "ok", callServer: "ok", storage: "ok" },
    });
  });

  it("TC-F00-08 [AC-F00-02] answers 503 naming the part that is down, and the body still matches the schema", async () => {
    const response = await callHealth({ database: ok, cache: fails, callServer: ok, storage: ok });
    expect(response.statusCode).toBe(503);
    const body: unknown = response.json();
    expect(healthResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toEqual({
      status: "degraded",
      checks: { database: "ok", cache: "down", callServer: "ok", storage: "ok" },
    });
  });

  it("TC-F00-08 [AC-F00-02] a hanging part gives 503 within 2 s through the route", async () => {
    const { result: response, ms } = await timed(() =>
      callHealth({ database: ok, cache: ok, callServer: hangs, storage: ok }),
    );
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      status: "degraded",
      checks: { database: "ok", cache: "ok", callServer: "down", storage: "ok" },
    });
    expect(ms).toBeLessThan(2000);
  }, 5_000);

  it("TC-F00-08 [AC-F00-02] the 503 answer contains no error details", async () => {
    const leaky: HealthCheck = async () => Promise.reject(new Error("password=local_dev_password at 10.0.0.5"));
    const response = await callHealth({ database: leaky });
    expect(response.statusCode).toBe(503);
    expect(response.body).not.toContain("password");
    expect(response.body).not.toContain("10.0.0.5");
  });
});
