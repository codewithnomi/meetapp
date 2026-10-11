// Integration tests for file storage against the local RustFS (F00 T8, AC-F00-38): a file written with
// random content reads back byte for byte, and a missing file gives a clear not-found error.
// Needs `pnpm dev` services running; run with `pnpm test:integration`. Test files go under "test/"
// (the provider has no delete yet, so they stay in the local bucket).
import { randomBytes } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { localConfig, runTool } from "../test-support/integration.ts";
import { createStorageProvider, StorageNotFoundError } from "./storage.ts";

const config = localConfig();
const storage = createStorageProvider(config);
const randomKey = () => `test/tc-f00-80-${randomBytes(8).toString("hex")}.bin`;

afterAll(async () => {
  await storage.close();
});

describe("TC-F00-80 [AC-F00-38] backend stores and reads back a file", () => {
  it("TC-F00-80 [AC-F00-38] the bucket is meetapp-dev and answers", async () => {
    expect(config.STORAGE_BUCKET).toBe("meetapp-dev");
    await expect(storage.ping()).resolves.toBeUndefined();
  });

  it("TC-F00-80 [AC-F00-38] random bytes written under a random key read back identical", async () => {
    const key = randomKey();
    const bytes = new Uint8Array(randomBytes(64 * 1024));
    await storage.put(key, bytes);
    const readBack = await storage.get(key);
    expect(readBack.byteLength).toBe(bytes.byteLength);
    expect(Buffer.from(readBack).equals(Buffer.from(bytes))).toBe(true);
  });

  it("TC-F00-80 [AC-F00-38] text content reads back identical", async () => {
    const key = randomKey();
    const text = `Grüße from MeetApp ${randomBytes(4).toString("hex")}`;
    await storage.put(key, text, "text/plain");
    expect(new TextDecoder().decode(await storage.get(key))).toBe(text);
  });

  it("TC-F00-80 [AC-F00-38] reading a missing key rejects with StorageNotFoundError, not a crash", async () => {
    const key = randomKey();
    const error: unknown = await storage.get(key).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(StorageNotFoundError);
    expect((error as Error).message).toContain(key);
  });

  it("TC-F00-80 [AC-F00-38] `pnpm storage:test` exits 0 and names the bucket", async () => {
    const result = await runTool("storage-test.ts");
    expect(result.code, result.output).toBe(0);
    expect(result.output).toContain(`bucket "${config.STORAGE_BUCKET}"`);
  }, 30_000);
});
