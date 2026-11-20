// Opens a database connection pool. Settings come from .env (POSTGRES_*), validated by the caller.
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
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

export interface DatabaseOptions {
  max?: number;
  /** Called when a connection breaks (e.g. Postgres restarts), idle or in use. Without it such errors are ignored. */
  onPoolError?: (error: Error) => void;
}

/** A pool that survives the database going away: connection errors are reported, never thrown. */
export function createDatabase(url: string, options: DatabaseOptions = {}) {
  const pool = new Pool({ connectionString: url, max: options.max ?? 10, connectionTimeoutMillis: 5000 });
  pool.on("error", (error) => options.onPoolError?.(error));
  // A connection in use (e.g. inside a transaction) is no longer the pool's idle one, so its own error
  // would otherwise go unhandled and stop the server.
  pool.on("connect", (client) => client.on("error", (error) => options.onPoolError?.(error)));
  const db = drizzle({ client: pool, schema });
  return { db, pool, close: () => pool.end() };
}

export type Database = ReturnType<typeof createDatabase>["db"];
/** The database or an open transaction: repositories accept either, so callers can group writes. */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];
