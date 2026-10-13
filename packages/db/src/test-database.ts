// Test helper for the database integration tests: each test file gets its own empty database
// `meetapp_test_<random>` on the running local Postgres and drops it afterwards, so the real
// development data is never touched. Settings come from .env (or .env.example); the shell
// environment wins, e.g. POSTGRES_PORT=5433. Values are never printed.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sql, type SQL } from "drizzle-orm";
import { createDatabase, databaseUrl, type Database, type DatabaseSettings } from "./connection.ts";

const ROOT = fileURLToPath(new URL("../../..", import.meta.url));
const ENV_FILE = existsSync(join(ROOT, ".env")) ? join(ROOT, ".env") : join(ROOT, ".env.example");

/** A setting: the shell environment wins over the env file. */
function setting(name: keyof DatabaseSettings): string {
  const fromShell = process.env[name];
  if (fromShell !== undefined && fromShell !== "") return fromShell;
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match?.[1] === name) return match[2] ?? "";
  }
  throw new Error(`${name} is not set in ${ENV_FILE}`);
}

/** Runs a raw query and returns its rows (node-postgres puts them under `.rows`). */
export async function rowsOf<T extends Record<string, unknown>>(db: Database, query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

export interface TestDatabase {
  db: Database;
  /** Connection address of the test database (for runMigrations). */
  url: string;
  /** Closes the connection and drops the test database. */
  drop: () => Promise<void>;
}

/** Creates an empty database for one test file. Call `drop()` in afterAll. */
export async function createTestDatabase(): Promise<TestDatabase> {
  const settings: DatabaseSettings = {
    POSTGRES_USER: setting("POSTGRES_USER"),
    POSTGRES_PASSWORD: setting("POSTGRES_PASSWORD"),
    POSTGRES_DB: setting("POSTGRES_DB"),
    POSTGRES_PORT: setting("POSTGRES_PORT"),
  };
  const name = `meetapp_test_${randomBytes(6).toString("hex")}`;
  const adminUrl = databaseUrl(settings);
  const url = databaseUrl({ ...settings, POSTGRES_DB: name });
  const asAdmin = async (statement: string) => {
    const admin = createDatabase(adminUrl, { max: 1 });
    try {
      await admin.db.execute(sql.raw(statement));
    } finally {
      await admin.close();
    }
  };
  // The name is built from hex characters only, so building the statement from text is safe.
  await asAdmin(`create database "${name}"`);
  const connection = createDatabase(url, { max: 1 });
  return {
    db: connection.db,
    url,
    drop: async () => {
      await connection.close();
      await asAdmin(`drop database if exists "${name}" with (force)`);
    },
  };
}
