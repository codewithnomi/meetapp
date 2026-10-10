// Starts the backend: check settings, update the database structure, then listen (AC-F00-04, 05).
import { databaseUrl, runMigrations } from "@meetapp/db";
import { buildApp } from "./app.ts";
import { ConfigError, loadConfig, type Config } from "./config/config.ts";

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
await runMigrations(databaseUrl({ ...config, POSTGRES_PORT: String(config.POSTGRES_PORT) }));
const app = await buildApp(config);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
}

await app.listen({ host: config.API_HOST, port: config.API_PORT });
