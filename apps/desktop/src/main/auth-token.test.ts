// TC-F01-85 (AC-F01-34): the token is saved only encrypted, or kept in memory only; a damaged file
// signs out; signing out removes both copies.
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createTokenStore, type SafeStorageLike } from "./auth-token.ts";

const TOKEN = "session-token.signature";

/** A stand-in for Electron's safeStorage: reverses and tags the text, so "encrypted" differs from plain. */
function fakeSafeStorage(options: { available?: boolean; backend?: string; key?: string } = {}): SafeStorageLike {
  const key = options.key ?? "key-1";
  return {
    isEncryptionAvailable: () => options.available ?? true,
    getSelectedStorageBackend: () => options.backend ?? "keychain",
    encryptString: (plain) => Buffer.from(`${key}:${[...plain].reverse().join("")}`),
    decryptString: (encrypted) => {
      const text = encrypted.toString();
      if (!text.startsWith(`${key}:`)) throw new Error("wrong key");
      return [...text.slice(key.length + 1)].reverse().join("");
    },
  };
}

const tokenFile = () => join(mkdtempSync(join(tmpdir(), "meetapp-token-")), "auth-token");

describe("TC-F01-85 [AC-F01-34] token storage", () => {
  it("TC-F01-85 [AC-F01-34] (a) saved encrypted, never in plain text, and read back after a restart", () => {
    const file = tokenFile();
    createTokenStore(fakeSafeStorage(), file).set(TOKEN);
    expect(readFileSync(file, "utf8")).not.toContain(TOKEN);
    expect(createTokenStore(fakeSafeStorage(), file).get()).toBe(TOKEN);
  });

  it.each([
    ["encryption unavailable", { available: false }],
    ["Linux without a keyring (basic_text)", { backend: "basic_text" }],
  ])("TC-F01-85 [AC-F01-34] (b) %s: memory only, so a restart signs out", (_, options) => {
    const file = tokenFile();
    const store = createTokenStore(fakeSafeStorage(options), file);
    store.set(TOKEN);
    expect(store.get()).toBe(TOKEN);
    expect(existsSync(file)).toBe(false);
    expect(createTokenStore(fakeSafeStorage(options), file).get()).toBeUndefined();
  });

  it("TC-F01-85 [AC-F01-34] (c) a damaged file or one from another key is deleted and signs out", () => {
    for (const write of [
      (file: string) => writeFileSync(file, "not encrypted at all"),
      (file: string) => createTokenStore(fakeSafeStorage({ key: "other" }), file).set(TOKEN),
    ]) {
      const file = tokenFile();
      write(file);
      expect(createTokenStore(fakeSafeStorage(), file).get()).toBeUndefined();
      expect(existsSync(file)).toBe(false);
    }
  });

  it("TC-F01-85 [AC-F01-34] sign-out removes the file and the memory copy", () => {
    const file = tokenFile();
    const store = createTokenStore(fakeSafeStorage(), file);
    store.set(TOKEN);
    store.clear();
    expect(store.get()).toBeUndefined();
    expect(existsSync(file)).toBe(false);
  });

  it("TC-F01-85 [AC-F01-34] a file left from an encrypted run is removed when encryption is gone", () => {
    const file = tokenFile();
    createTokenStore(fakeSafeStorage(), file).set(TOKEN);
    expect(createTokenStore(fakeSafeStorage({ available: false }), file).get()).toBeUndefined();
    expect(existsSync(file)).toBe(false);
  });
});
