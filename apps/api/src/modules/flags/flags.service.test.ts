// Tests for the feature flags service and GET /api/v1/flags (F00 T9, AC-F00-34): the 10 s cache,
// what a failing source turns into, and the route's answer with and without a flag source.
import type { Flag } from "@meetapp/contracts";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../../app.ts";
import { captureLogs, fakeConfig } from "../../test-support/fake-env.ts";
import { FLAGS_CACHE_MS, createFlagsService, type FlagsSource } from "./flags.service.ts";

const FLAGS_URL = "/api/v1/flags";

/** A flag source whose answer the test can change; counts how often it is asked. */
function fakeSource(initial: Flag[]) {
  let current = initial;
  const list = vi.fn(async () => current);
  return {
    source: { list } satisfies FlagsSource,
    list,
    set: (flags: Flag[]) => {
      current = flags;
    },
  };
}

/** A clock the test moves by hand. */
function fakeClock(start = 1_000_000) {
  let time = start;
  return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe("TC-F00-73 [AC-F00-34] flags service cache (unit)", () => {
  it("TC-F00-73 [AC-F00-34] the cache window is 10 s", () => {
    expect(FLAGS_CACHE_MS).toBe(10_000);
  });

  it("TC-F00-73 [AC-F00-34] the first call reads the source", async () => {
    const fake = fakeSource([{ key: "a", enabled: true }]);
    const service = createFlagsService(fake.source, FLAGS_CACHE_MS, fakeClock().now);
    await expect(service.list()).resolves.toEqual([{ key: "a", enabled: true }]);
    expect(fake.list).toHaveBeenCalledTimes(1);
  });

  it("TC-F00-73 [AC-F00-34] calls within 10 s use the cache (source asked once)", async () => {
    const fake = fakeSource([{ key: "a", enabled: false }]);
    const clock = fakeClock();
    const service = createFlagsService(fake.source, FLAGS_CACHE_MS, clock.now);
    await service.list();
    fake.set([{ key: "a", enabled: true }]);
    clock.advance(5_000);
    await expect(service.list()).resolves.toEqual([{ key: "a", enabled: false }]);
    clock.advance(4_999);
    await expect(service.list()).resolves.toEqual([{ key: "a", enabled: false }]);
    expect(fake.list).toHaveBeenCalledTimes(1);
  });

  it("TC-F00-73 [AC-F00-34] after 10 s it reads again and returns the new value", async () => {
    const fake = fakeSource([{ key: "a", enabled: false }]);
    const clock = fakeClock();
    const service = createFlagsService(fake.source, FLAGS_CACHE_MS, clock.now);
    await service.list();
    fake.set([{ key: "a", enabled: true }]);
    clock.advance(10_000);
    await expect(service.list()).resolves.toEqual([{ key: "a", enabled: true }]);
    expect(fake.list).toHaveBeenCalledTimes(2);
  });

  it("TC-F00-73 [AC-F00-34] a failing source rejects and is not cached", async () => {
    const list = vi
      .fn<() => Promise<Flag[]>>()
      .mockRejectedValueOnce(new Error("database down"))
      .mockResolvedValueOnce([{ key: "a", enabled: true }]);
    const service = createFlagsService({ list }, FLAGS_CACHE_MS, fakeClock().now);
    await expect(service.list()).rejects.toThrow("database down");
    await expect(service.list()).resolves.toEqual([{ key: "a", enabled: true }]);
    expect(list).toHaveBeenCalledTimes(2);
  });
});

describe("TC-F00-73 [AC-F00-34] GET /api/v1/flags route", () => {
  let app: FastifyInstance | undefined;
  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  async function appWith(flags?: FlagsSource, nodeEnv: "test" | "development" = "test") {
    app = await buildApp(fakeConfig(nodeEnv), {
      logDestination: captureLogs().stream,
      ...(flags === undefined ? {} : { flags }),
    });
    await app.ready();
    return app;
  }

  it("TC-F00-73 [AC-F00-34] returns 200 with every flag from the source", async () => {
    const flags = [
      { key: "a.one", enabled: true },
      { key: "b.two", enabled: false },
    ];
    const instance = await appWith(fakeSource(flags).source);
    const response = await instance.inject({ method: "GET", url: FLAGS_URL });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("application/json");
    expect(response.json()).toEqual(flags);
  });

  it("TC-F00-73 [AC-F00-34] without a flags source the list is empty (everything off)", async () => {
    const instance = await appWith();
    const response = await instance.inject({ method: "GET", url: FLAGS_URL });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("TC-F00-73 [AC-F00-34] a failing source becomes the standard 500 without details", async () => {
    const instance = await appWith({ list: () => Promise.reject(new Error("db password=hunter2")) });
    const response = await instance.inject({ method: "GET", url: FLAGS_URL });
    expect(response.statusCode).toBe(500);
    const body = response.json<{ error: { code: string; message: string; requestId: string } }>();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.requestId).toBe(response.headers["x-request-id"]);
    expect(response.body).not.toContain("hunter2");
  });

  it("TC-F00-73 [AC-F00-34] /docs/json in development lists GET /api/v1/flags", async () => {
    const instance = await appWith(undefined, "development");
    const response = await instance.inject({ method: "GET", url: "/docs/json" });
    expect(response.statusCode).toBe(200);
    const document = response.json<{ paths: Record<string, Record<string, unknown>> }>();
    expect(document.paths[FLAGS_URL]?.["get"]).toBeDefined();
  });
});
