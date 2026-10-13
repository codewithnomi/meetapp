// Applies every migration that has not run yet (AC-F00-04). Safe to run on every start:
// already-applied migrations are skipped, using the journal table drizzle.__drizzle_migrations.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDatabase } from "./connection.ts";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

/** How many migrations exist (drizzle-kit's journal): after a run, the database lists exactly this many. */
export function migrationCount(): number {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_FOLDER, "meta/_journal.json"), "utf8")) as {
    entries: unknown[];
  };
  return journal.entries.length;
}

export async function runMigrations(url: string): Promise<void> {
  const { db, close } = createDatabase(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await close();
  }
}
