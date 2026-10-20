// The device key behind TC-F02-114 (AC-F02-35, AC-F02-54): random, 32 bytes, made once and kept.
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadDeviceKey } from "./device-key.ts";

const folder = () => mkdtempSync(join(tmpdir(), "meetapp-device-key-"));

describe("TC-F02-114 [AC-F02-54] device key", () => {
  it("TC-F02-114 [AC-F02-35] a random 32-byte key is made once, saved privately and reused", () => {
    const file = join(folder(), "settings", "device-key");
    const key = loadDeviceKey(file);
    expect(Buffer.from(key, "base64url")).toHaveLength(32);
    expect(loadDeviceKey(file)).toBe(key);
    expect(readFileSync(file, "utf8")).toBe(key);
    // Only the person's own account may read it (Windows has no such file modes).
    expect(process.platform === "win32" || (statSync(file).mode & 0o077) === 0).toBe(true);
    expect(loadDeviceKey(join(folder(), "device-key"))).not.toBe(key);
  });

  it("TC-F02-114 [AC-F02-35] a damaged file gets a new key", () => {
    const file = join(folder(), "device-key");
    writeFileSync(file, "not a key");
    const key = loadDeviceKey(file);
    expect(key).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(readFileSync(file, "utf8")).toBe(key);
  });
});
