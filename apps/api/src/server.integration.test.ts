// Integration tests for starting the real backend (F00 T7): it migrates an empty database on start,
// starts again without changing anything, and listens only on this computer. Each run creates its own
// empty database `meetapp_test_<random>` and drops it afterwards. Needs the local Postgres running;
// run with `pnpm test:integration`. Settings come from .env (or .env.example); the shell wins,
// e.g. POSTGRES_PORT=5433. Values are never printed.
import { randomBytes } from "node:crypto";
import { createConnection } from "node:net";
import { networkInterfaces } from "node:os";
import { createDatabase, databaseUrl, type DatabaseSettings } from "@meetapp/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  freePort,
  localSettings,
  setting,
  startApi as spawnApi,
  stopApi,
  waitForHealth,
  type RunningApi,
} from "./test-support/integration.ts";

const SLOW = { timeout: 60_000 };

const settings: DatabaseSettings = {
  POSTGRES_USER: setting("POSTGRES_USER"),
  POSTGRES_PASSWORD: setting("POSTGRES_PASSWORD"),
  POSTGRES_DB: setting("POSTGRES_DB"),
  POSTGRES_PORT: setting("POSTGRES_PORT"),
};
const TEST_DB = `meetapp_test_${randomBytes(6).toString("hex")}`;

async function sqlRows<T>(url: string, statement: string): Promise<T[]> {
  const connection = createDatabase(url, { max: 1 });
  try {
    return (await connection.pool.query(statement)).rows as T[];
  } finally {
    await connection.close();
  }
}

const asAdmin = (statement: string) => sqlRows(databaseUrl(settings), statement);
const inTestDb = <T>(statement: string) => sqlRows<T>(databaseUrl({ ...settings, POSTGRES_DB: TEST_DB }), statement);

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

let apiPort = 0;
let api: RunningApi | undefined;

/** The real backend against the fresh test database; other services use the local settings. */
function startApi(): RunningApi {
  return spawnApi(apiPort, { ...localSettings(), ...settings, POSTGRES_DB: TEST_DB, POSTGRES_HOST: "127.0.0.1" });
}

/** Waits until GET /api/v1/health answers 200 (max 20 s). */
async function waitUntilHealthy(running: RunningApi): Promise<void> {
  await waitForHealth(running);
}

async function journalRows(): Promise<number> {
  const rows = await inTestDb<{ count: number }>("select count(*)::int as count from drizzle.__drizzle_migrations");
  return Number(rows[0]?.count);
}

beforeAll(async () => {
  apiPort = await freePort();
  // TEST_DB is generated above from hex characters only, so building the statement from text is safe.
  await asAdmin(`create database "${TEST_DB}"`);
}, 60_000);

afterAll(async () => {
  if (api !== undefined) await stopApi(api).catch(() => api?.child.kill("SIGKILL"));
  await asAdmin(`drop database if exists "${TEST_DB}" with (force)`);
}, 60_000);

describe("TC-F00-10 [AC-F00-04] starting the API migrates an empty database", () => {
  it("TC-F00-10 [AC-F00-04] the new database starts empty", SLOW, async () => {
    const tables = await inTestDb("select table_name from information_schema.tables where table_schema = 'public'");
    expect(tables).toHaveLength(0);
  });

  it(
    "TC-F00-10 [AC-F00-04] the first start creates feature_flags, fills the journal and becomes healthy",
    SLOW,
    async () => {
      api = startApi();
      await waitUntilHealthy(api);
      const tables = await inTestDb<{ name: string }>(
        "select table_name as name from information_schema.tables where table_schema = 'public' and table_name = 'feature_flags'",
      );
      expect(tables).toHaveLength(1);
      expect(await journalRows()).toBe(1);
    },
  );

  it("TC-F00-10 [AC-F00-04] stopping with SIGTERM exits cleanly with code 0", SLOW, async () => {
    if (api === undefined) throw new Error("the API was not started");
    expect(await stopApi(api)).toBe(0);
    api = undefined;
  });

  it("TC-F00-10 [AC-F00-04] the second start applies nothing, does not fail and is healthy", SLOW, async () => {
    api = startApi();
    await waitUntilHealthy(api);
    expect(await journalRows()).toBe(1);
  });
});

const LAN = lanAddress();

describe("TC-F00-56 [AC-F00-23] other devices cannot connect to the API (security)", () => {
  it.skipIf(LAN === undefined)(
    "TC-F00-56 [AC-F00-23] the API port refuses the LAN address and accepts 127.0.0.1 (skipped if no LAN IPv4)",
    SLOW,
    async () => {
      if (api === undefined) {
        api = startApi();
        await waitUntilHealthy(api);
      }
      expect(await canConnect("127.0.0.1", apiPort), "API on 127.0.0.1").toBe(true);
      expect(await canConnect(LAN ?? "", apiPort), `API on LAN ${LAN ?? ""}`).toBe(false);
    },
  );

  it("TC-F00-56 [AC-F00-23] the API stops cleanly at the end", SLOW, async () => {
    if (api === undefined) return;
    expect(await stopApi(api)).toBe(0);
    api = undefined;
  });
});
