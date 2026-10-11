// Loads the backend's validated settings from .env for the check commands (pnpm storage:test, email:test).
import { ConfigError, loadConfig, type Config } from "../apps/api/src/config/config.ts";
import { ROOT, fail, requireEnvFile } from "./cli.ts";
import { readEnv } from "./dev-checks.ts";

export { fail };

export function backendConfig(): Config {
  requireEnvFile();
  try {
    return loadConfig({ ...readEnv(ROOT), NODE_ENV: "development" });
  } catch (error) {
    if (error instanceof ConfigError) fail(error.message);
    throw error;
  }
}
