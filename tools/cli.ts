// Small helpers shared by the command-line tools in tools/.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));

export function fail(message: string): never {
  process.stderr.write(`✗ ${message}\n`);
  process.exit(1);
}

/** Commands that need the local settings stop with a clear hint when .env doesn't exist yet. */
export function requireEnvFile(): void {
  if (!existsSync(join(ROOT, ".env"))) fail("No .env yet. Run `pnpm dev` once first.");
}
