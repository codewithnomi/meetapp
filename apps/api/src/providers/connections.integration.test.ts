// Integration tests for the backend's connections (design.md section 9 "Reconnect", AC-F00-02, AC-F00-07):
// with the local services up, the database, cache and call server answer and the flags can be read; a
// connection to a closed port fails quickly and is logged once, without crashing anything.
// Needs the local services; runs in `pnpm test` (and `pnpm test:integration`).
import type { FastifyBaseLogger } from "fastify";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createFlagsRepository } from "../modules/flags/flags.repository.ts";
import { freePort, localConfig } from "../test-support/integration.ts";
import { createCacheProvider } from "./cache.ts";
import { createDatabaseProvider } from "./database.ts";
import { createLiveKitProvider } from "./livekit.ts";
import { StorageNotFoundError, createStorageProvider } from "./storage.ts";

const config = localConfig();

function fakeLog() {
  return { warn: vi.fn() } as unknown as FastifyBaseLogger & { warn: ReturnType<typeof vi.fn> };
}

describe("database connection", () => {
  const log = fakeLog();
  const database = createDatabaseProvider(config, log);
  afterAll(() => database.close());

  it("TC-F00-07 [AC-F00-02] answers a query and reports its pool", async () => {
    await expect(database.ping()).resolves.toBeUndefined();
    expect(database.poolStats()).toEqual({ total: expect.any(Number), idle: expect.any(Number), waiting: 0 });
    expect(log.warn).not.toHaveBeenCalled();
  });

  it("TC-F00-72 [AC-F00-34] the flags repository reads the feature flags", async () => {
    const flags = await createFlagsRepository(database.db).list();
    expect(Array.isArray(flags)).toBe(true);
    for (const flag of flags) expect(flag).toEqual({ key: expect.any(String), enabled: expect.any(Boolean) });
  });
});

describe("cache connection", () => {
  it("TC-F00-07 [AC-F00-02] is ready and answers a ping", async () => {
    const cache = createCacheProvider(config, fakeLog());
    await vi.waitFor(() => expect(cache.isReady()).toBe(true), { timeout: 5000 });
    await expect(cache.ping()).resolves.toBeUndefined();
    await cache.close();
  });

  it("TC-F00-08 [AC-F00-02] a cache that is away fails fast and is logged only once", async () => {
    const log = fakeLog();
    const cache = createCacheProvider({ ...config, REDIS_PORT: await freePort() }, log);
    const started = Date.now();
    await expect(cache.ping()).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(2000);
    await vi.waitFor(() => expect(log.warn).toHaveBeenCalled(), { timeout: 5000 });
    await new Promise((done) => setTimeout(done, 1000));
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(cache.isReady()).toBe(false);
    await cache.close();
  });
});

describe("call server connection", () => {
  it("TC-F00-07 [AC-F00-02] the call server answers", async () => {
    await expect(createLiveKitProvider(config).ping()).resolves.toBeUndefined();
  });

  it("TC-F00-08 [AC-F00-02] a call server that is away makes the check fail", async () => {
    const livekit = createLiveKitProvider({ ...config, LIVEKIT_PORT: await freePort() });
    await expect(livekit.ping()).rejects.toThrow();
  });
});

describe("file storage connection", () => {
  it("TC-F00-80 [AC-F00-38] storage that is away gives the real error, not 'file not found'", async () => {
    const storage = createStorageProvider({ ...config, STORAGE_PORT: await freePort() });
    const failure = await storage.get("test/anything.bin").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(StorageNotFoundError);
    await storage.close();
  });
});
