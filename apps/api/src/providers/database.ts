// Database connection pool (design.md section 9 "Reconnect"). A broken idle connection is logged,
// never thrown, so stopping Postgres can't crash the backend; new queries reconnect by themselves.
import { createDatabase, databaseUrl } from "@meetapp/db";
import type { FastifyBaseLogger } from "fastify";
import type { Config } from "../config/config.ts";

export function createDatabaseProvider(config: Config, log: FastifyBaseLogger) {
  const url = databaseUrl({ ...config, POSTGRES_PORT: String(config.POSTGRES_PORT) });
  const { db, pool, close } = createDatabase(url, {
    onPoolError: (error) => log.warn({ err: error }, "database connection lost; it reconnects on the next query"),
  });
  return {
    db,
    ping: async () => {
      await pool.query("select 1");
    },
    close,
  };
}
