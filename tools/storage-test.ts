// `pnpm storage:test`: stores a small test file, reads it back and compares (AC-F00-38).
import { randomBytes } from "node:crypto";
import { createStorageProvider } from "../apps/api/src/providers/storage.ts";
import { backendConfig, fail } from "./backend-config.ts";

const config = backendConfig();
const storage = createStorageProvider(config);
const key = `checks/storage-test-${randomBytes(4).toString("hex")}.txt`;
const content = `MeetApp storage check ${new Date().toISOString()}`;
try {
  await storage.put(key, content, "text/plain");
  const readBack = new TextDecoder().decode(await storage.get(key));
  if (readBack !== content) fail("The file read back differs from the file stored.");
  process.stdout.write(
    `File storage works: stored and read back "${key}" in bucket "${config.STORAGE_BUCKET}".\n` +
      `See it in the file browser: http://127.0.0.1:9001\n`,
  );
} catch (error) {
  fail(`File storage check failed (${(error as Error).name}). Is \`pnpm dev\` running?`);
} finally {
  await storage.close();
}
