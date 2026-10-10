// Shared by the database commands (pnpm seed, pnpm flag): connect using the settings in .env.
import { createDatabase, databaseUrl, runMigrations } from "@meetapp/db";
import { ROOT, fail, requireEnvFile } from "./cli.ts";
import { readEnv } from "./dev-checks.ts";

export { fail };

/** Migrates (a no-op when up to date), then runs `work` with an open connection and always closes it. */
export async function withDatabase<T>(work: (db: ReturnType<typeof createDatabase>["db"]) => Promise<T>): Promise<T> {
  requireEnvFile();
  const env = readEnv(ROOT);
  const url = databaseUrl({
    POSTGRES_USER: env["POSTGRES_USER"] ?? "",
    POSTGRES_PASSWORD: env["POSTGRES_PASSWORD"] ?? "",
    POSTGRES_DB: env["POSTGRES_DB"] ?? "",
    POSTGRES_PORT: env["POSTGRES_PORT"] ?? "5432",
  });
  try {
    await runMigrations(url);
  } catch {
    fail(`Can't reach the database on port ${env["POSTGRES_PORT"] ?? "5432"}. Is \`pnpm dev\` running?`);
  }
  const { db, close } = createDatabase(url, { max: 1 });
  try {
    return await work(db);
  } finally {
    await close();
  }
}
