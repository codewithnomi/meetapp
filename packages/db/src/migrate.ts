// Applies every migration that has not run yet (AC-F00-04). Safe to run on every start:
// already-applied migrations are skipped, using the journal table drizzle.__drizzle_migrations.
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "./connection.ts";

export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

export async function runMigrations(url: string): Promise<void> {
  const { db, close } = createDatabase(url, { max: 1 });
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await close();
  }
}
