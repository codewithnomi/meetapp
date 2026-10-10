// Opens a database connection. Settings come from .env (POSTGRES_*), validated by the caller.
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export interface DatabaseSettings {
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  POSTGRES_PORT: string;
  POSTGRES_HOST?: string;
}

/** Builds the connection address; user name and password are URL-encoded so special characters are safe. */
export function databaseUrl(settings: DatabaseSettings): string {
  const user = encodeURIComponent(settings.POSTGRES_USER);
  const password = encodeURIComponent(settings.POSTGRES_PASSWORD);
  const host = settings.POSTGRES_HOST ?? "127.0.0.1";
  return `postgres://${user}:${password}@${host}:${settings.POSTGRES_PORT}/${encodeURIComponent(settings.POSTGRES_DB)}`;
}

export function createDatabase(url: string, options: { max?: number } = {}) {
  const client = postgres(url, { max: options.max ?? 10, onnotice: () => undefined });
  const db = drizzle({ client, schema });
  return { db, close: () => client.end({ timeout: 5 }) };
}

export type Database = ReturnType<typeof createDatabase>["db"];
