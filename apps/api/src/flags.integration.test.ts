// TC-F00-73 (AC-F00-34): GET /api/v1/flags reflects a database change within the 10 s cache window, and a
// row inserted without `enabled` is off. Spawns the real backend against the local database and uses a
// flag key `test.tc73_<random>` that is deleted afterwards. Run with `pnpm test:integration`.
import { randomBytes } from "node:crypto";
import { createDatabase, databaseUrl } from "@meetapp/db";
import type { Flag } from "@meetapp/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  freePort,
  localSettings,
  setting,
  startApi,
  stopApi,
  waitForHealth,
  type RunningApi,
} from "./test-support/integration.ts";

const KEY = `test.tc73_${randomBytes(4).toString("hex")}`;
const POLL_MS = 250;
const CACHE_WINDOW_MS = 10_000;
/** Cache window plus polling granularity and request time. */
const VISIBLE_WITHIN_MS = 10_500;

const database = createDatabase(
  databaseUrl({
    POSTGRES_USER: setting("POSTGRES_USER"),
    POSTGRES_PASSWORD: setting("POSTGRES_PASSWORD"),
    POSTGRES_DB: setting("POSTGRES_DB"),
    POSTGRES_PORT: setting("POSTGRES_PORT"),
    POSTGRES_HOST: localSettings()["POSTGRES_HOST"] || "127.0.0.1",
  }),
  { max: 2 },
);

let api: RunningApi | undefined;

beforeAll(async () => {
  api = startApi(await freePort(), localSettings());
  await waitForHealth(api);
}, 60_000);

afterAll(async () => {
  await database.pool.query("DELETE FROM feature_flags WHERE key = $1", [KEY]).catch(() => undefined);
  await database.close();
  if (api !== undefined) await stopApi(api).catch(() => api?.child.kill("SIGKILL"));
}, 30_000);

async function getFlags(): Promise<Flag[]> {
  if (api === undefined) throw new Error("the API was not started");
  const response = await fetch(`http://127.0.0.1:${String(api.port)}/api/v1/flags`, {
    signal: AbortSignal.timeout(5_000),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as Flag[];
}

/** Polls the flags every 250 ms until our flag matches `accept`; returns it and how long it took. */
async function pollFlag(accept: (flag: Flag | undefined) => boolean, maxMs: number) {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const flag = (await getFlags()).find((item) => item.key === KEY);
    if (accept(flag)) return { flag, afterMs: Date.now() - started };
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  }
  throw new Error(`flag ${KEY} did not reach the expected state within ${String(maxMs)} ms`);
}

describe("TC-F00-73 [AC-F00-34] flags API reflects changes within the cache window", () => {
  it(
    "TC-F00-73 [AC-F00-34] a new row without `enabled` appears as off, and switching it on shows within 10 s",
    { timeout: 60_000 },
    async () => {
      await database.pool.query("INSERT INTO feature_flags (key) VALUES ($1)", [KEY]);
      const inserted = await pollFlag((flag) => flag !== undefined, CACHE_WINDOW_MS + 1_000);
      expect(inserted.flag).toEqual({ key: KEY, enabled: false });

      const updatedAt = Date.now();
      await database.pool.query("UPDATE feature_flags SET enabled = true, updated_at = now() WHERE key = $1", [KEY]);
      const switched = await pollFlag((flag) => flag?.enabled === true, CACHE_WINDOW_MS + 5_000);
      const visibleAfter = Date.now() - updatedAt;
      expect(switched.flag).toEqual({ key: KEY, enabled: true });
      expect(visibleAfter, `visible after ${String(visibleAfter)} ms`).toBeLessThanOrEqual(VISIBLE_WITHIN_MS);
    },
  );
});
