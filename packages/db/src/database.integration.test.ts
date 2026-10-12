// Integration tests for the database package (F00 T6): migrations, seed data and flag switching against
// the running local Postgres. Each run creates its own empty database `meetapp_test_<random>` and drops
// it afterwards, so the real development data is never touched. Run with `pnpm test:integration`.
// Settings come from .env (or .env.example); the shell environment wins, e.g. POSTGRES_PORT=5433.
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "./connection.ts";
import { setFlag } from "./flags.ts";
import { migrationCount, runMigrations } from "./migrate.ts";
import { featureFlags } from "./schema.ts";
import { SEED_FLAGS, clearSeed, seedDatabase } from "./seed.ts";
import { createTestDatabase, rowsOf, type TestDatabase } from "./test-database.ts";

const SLOW = { timeout: 60_000 };
const INJECTION_KEY = "x'; drop table feature_flags;--";
const OWN_FLAG = "test.own_flag";

let db: Database;
let testDb: TestDatabase | undefined;
let testUrl: string;

async function journalRows(): Promise<number> {
  const rows = await rowsOf<{ count: number }>(
    db,
    sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
  );
  return Number(rows[0]?.count);
}

async function flagRows(key: string) {
  return db.select().from(featureFlags).where(eq(featureFlags.key, key));
}

beforeAll(async () => {
  testDb = await createTestDatabase();
  db = testDb.db;
  testUrl = testDb.url;
}, 60_000);

afterAll(async () => {
  await testDb?.drop();
}, 60_000);

describe("TC-F00-10 [AC-F00-04] empty database is migrated", () => {
  it("TC-F00-10 [AC-F00-04] the new database starts empty", SLOW, async () => {
    const tables = await rowsOf<{ name: string }>(
      db,
      sql`select table_name as name from information_schema.tables where table_schema = 'public'`,
    );
    expect(tables).toHaveLength(0);
  });

  it("TC-F00-10 [AC-F00-04] creates feature_flags with the designed columns and fills the journal", SLOW, async () => {
    await runMigrations(testUrl);

    const columns = await rowsOf<{ name: string; type: string; nullable: string }>(
      db,
      sql`
      select column_name as name, data_type as type, is_nullable as nullable
      from information_schema.columns
      where table_schema = 'public' and table_name = 'feature_flags'
      order by column_name`,
    );
    expect(columns.map((column) => [column.name, column.type, column.nullable])).toEqual([
      ["created_at", "timestamp with time zone", "NO"],
      ["description", "text", "NO"],
      ["enabled", "boolean", "NO"],
      ["id", "uuid", "NO"],
      ["key", "text", "NO"],
      ["updated_at", "timestamp with time zone", "NO"],
    ]);

    const constraints = await rowsOf<{ type: string; column: string }>(
      db,
      sql`
      select tc.constraint_type as type, kcu.column_name as column
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
      where tc.table_schema = 'public' and tc.table_name = 'feature_flags'
        and tc.constraint_type in ('PRIMARY KEY', 'UNIQUE')
      order by tc.constraint_type`,
    );
    expect(constraints.map((row) => [row.type, row.column])).toEqual([
      ["PRIMARY KEY", "id"],
      ["UNIQUE", "key"],
    ]);

    expect(await journalRows()).toBe(migrationCount());
  });

  it("TC-F00-10 [AC-F00-04] the unique key really refuses a duplicate", SLOW, async () => {
    await db.insert(featureFlags).values({ key: "test.unique_check" });
    await expect(db.insert(featureFlags).values({ key: "test.unique_check" })).rejects.toThrow();
    await db.delete(featureFlags).where(eq(featureFlags.key, "test.unique_check"));
  });

  it("TC-F00-10 [AC-F00-04] running the migrations a second time applies nothing and does not fail", SLOW, async () => {
    await expect(runMigrations(testUrl)).resolves.toBeUndefined();
    expect(await journalRows()).toBe(migrationCount());
  });

  // TC-F00-10 starting the API migrates the empty database: tested in apps/api/src/server.integration.test.ts.
});

describe("TC-F00-91 [AC-F00-45] seed and clear", () => {
  it("TC-F00-91 [AC-F00-45] seeding twice adds every sample record exactly once", SLOW, async () => {
    expect(await seedDatabase(db)).toBe(SEED_FLAGS.length);
    expect(await seedDatabase(db)).toBe(0);
    for (const flag of SEED_FLAGS) {
      const rows = await flagRows(flag.key);
      expect(rows, flag.key).toHaveLength(1);
      expect(rows[0]?.enabled).toBe(flag.enabled);
    }
  });

  it("TC-F00-91 [AC-F00-45] clearing removes only the sample records", SLOW, async () => {
    await db.insert(featureFlags).values({ key: OWN_FLAG, enabled: true, description: "Created by the test." });
    expect(await clearSeed(db)).toBe(SEED_FLAGS.length);
    for (const flag of SEED_FLAGS) expect(await flagRows(flag.key), flag.key).toHaveLength(0);
    expect(await flagRows(OWN_FLAG)).toHaveLength(1);
    expect(await clearSeed(db)).toBe(0);
    expect(await flagRows(OWN_FLAG)).toHaveLength(1);
  });

  it("TC-F00-91 [AC-F00-45] the seed data contains no personal data", () => {
    const text = JSON.stringify(SEED_FLAGS);
    expect(text).not.toContain("@");
    expect(text).not.toMatch(/[\w.+-]+\s*(@|\(at\))\s*[\w-]+\.[\w.]+/i); // email-like
    expect(text).not.toMatch(/\+?\d[\d\s().-]{6,}\d/); // phone-like
  });
});

describe("TC-F00-75 [AC-F00-34] switching flags is safe against injection", () => {
  beforeAll(async () => {
    await seedDatabase(db);
  });

  it("TC-F00-75 [AC-F00-34] a key containing '; drop table changes nothing", SLOW, async () => {
    const before = await db.select().from(featureFlags);
    expect(before.length).toBeGreaterThan(0);

    expect(await setFlag(db, INJECTION_KEY, true)).toBe(false);

    const tables = await rowsOf<{ name: string }>(
      db,
      sql`select table_name as name from information_schema.tables where table_schema = 'public' and table_name = 'feature_flags'`,
    );
    expect(tables).toHaveLength(1);
    const after = await db.select().from(featureFlags);
    const byKey = (rows: typeof after) => [...rows].sort((a, b) => a.key.localeCompare(b.key));
    expect(byKey(after)).toEqual(byKey(before));
  });

  it("TC-F00-75 [AC-F00-34] switching an existing flag flips it and bumps updated_at", SLOW, async () => {
    const key = SEED_FLAGS[0].key;
    const [before] = await flagRows(key);
    if (before === undefined) throw new Error(`${key} was not seeded`);

    expect(await setFlag(db, key, !before.enabled)).toBe(true);

    const [after] = await flagRows(key);
    expect(after?.enabled).toBe(!before.enabled);
    expect(after?.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    expect(after?.createdAt.getTime()).toBe(before.createdAt.getTime());
  });

  it("TC-F00-75 [AC-F00-34] switching an unknown flag creates nothing", SLOW, async () => {
    expect(await setFlag(db, "test.does_not_exist", true)).toBe(false);
    expect(await flagRows("test.does_not_exist")).toHaveLength(0);
  });
});

describe("TC-F01-78 [AC-F01-19] join link lookup column", () => {
  it("TC-F01-78 [AC-F01-19] workspaces.join_link_hmac exists and is unique", SLOW, async () => {
    const column = await rowsOf<{ name: string }>(
      db,
      sql`select column_name as name from information_schema.columns where table_name = 'workspaces' and column_name = 'join_link_hmac'`,
    );
    expect(column).toHaveLength(1);
    const owner = await rowsOf<{ id: string }>(
      db,
      sql`insert into "user" (id, name, email) values (gen_random_uuid(), 'T', ${`hmac-${Date.now()}@example.test`}) returning id`,
    );
    const ownerId = owner[0]?.id;
    const add = (hmac: string) =>
      db.execute(
        sql`insert into workspaces (name, kind, created_by, join_link_hmac) values ('W', 'company', ${ownerId}, ${hmac})`,
      );
    await add("a".repeat(64));
    await expect(add("a".repeat(64))).rejects.toThrow();
    await expect(add("b".repeat(64))).resolves.toBeDefined();
  });
});
