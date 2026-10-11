// Starts the backend: check settings, update the database structure, connect to the services, then
// listen (AC-F00-04, 05). Ctrl+C or a stop signal closes everything cleanly.
import { databaseUrl, runMigrations } from "@meetapp/db";
import { pino } from "pino";
import { buildApp } from "./app.ts";
import { createFlagsRepository } from "./modules/flags/flags.repository.ts";
import { ConfigError, loadConfig, type Config } from "./config/config.ts";
import { runShutdownHooks } from "./observability/shutdown.ts";
import { loggerOptions } from "./plugins/logging.ts";
import { createCacheProvider } from "./providers/cache.ts";
import { createDatabaseProvider } from "./providers/database.ts";
import { createLiveKitProvider } from "./providers/livekit.ts";
import { createStorageProvider } from "./providers/storage.ts";

function readConfig(): Config {
  try {
    return loadConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    process.stderr.write(`✗ ${error.message}\n`);
    process.exit(1);
  }
}

const config = readConfig();
const log = pino(loggerOptions("info"));
await runMigrations(databaseUrl({ ...config, POSTGRES_PORT: String(config.POSTGRES_PORT) }));

const database = createDatabaseProvider(config, log);
const cache = createCacheProvider(config, log);
const livekit = createLiveKitProvider(config);
const storage = createStorageProvider(config);

const app = await buildApp(config, {
  healthChecks: { database: database.ping, cache: cache.ping, callServer: livekit.ping, storage: storage.ping },
  flags: createFlagsRepository(database.db),
  metrics: { databasePool: database.poolStats, cacheReady: cache.isReady },
});

/** Closes everything and always exits: a failure while closing must not leave the backend half-closed. */
async function shutDown(): Promise<void> {
  // Backstop: if closing hangs, leave anyway after 10 s so the port is freed.
  setTimeout(() => process.exit(1), 10_000).unref();
  let code = 0;
  try {
    await app.close();
    await Promise.allSettled([database.close(), cache.close(), storage.close()]);
  } catch (error) {
    log.error({ err: error }, "Closing the backend failed");
    code = 1;
  } finally {
    // Send the last traces, logs and error reports first: process.exit() would drop them.
    await runShutdownHooks();
    process.exit(code);
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => void shutDown());

await app.listen({ host: config.API_HOST, port: config.API_PORT });
