// TC-F01-49, 78 (AC-F01-19, 31; S8): the join code has 10 characters without look-alikes, the secret
// is stored only encrypted, lookups go through keyed hashes, and whatever people paste or type (the
// whole link, the code in lower case with spaces) finds the same workspace.
import { describe, expect, it } from "vitest";
import { JOIN_KEY_VERSION, createJoinSecrets } from "./join-secret.ts";

const secrets = createJoinSecrets("test-data-key", "http://127.0.0.1:3010");

describe("TC-F01-49 [AC-F01-19] join link and code", () => {
  it("TC-F01-49 [AC-F01-19] codes are 10 characters with no 0/O/1/I; links carry 24 random bytes", () => {
    for (let i = 0; i < 200; i += 1) {
      const secret = secrets.create();
      expect(secret.code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
      expect(Buffer.from(secret.token, "base64url")).toHaveLength(24);
    }
    expect(secrets.linkOf({ token: "abc", code: "X" })).toBe("http://127.0.0.1:3010/join/abc");
  });

  it("TC-F01-78 [AC-F01-31] stored encrypted: the text holds neither secret and decrypts back", () => {
    const secret = secrets.create();
    const stored = secrets.encrypt(secret);
    expect(stored).not.toContain(secret.code);
    expect(stored).not.toContain(secret.token);
    expect(secrets.encrypt(secret)).not.toBe(stored);
    expect(secrets.decrypt(stored, JOIN_KEY_VERSION)).toEqual(secret);
    expect(() => secrets.decrypt(stored, 99)).toThrow("unknown join key version");
    // A shortened authentication tag is refused, not accepted as a weaker check.
    const bytes = Buffer.from(stored, "base64");
    const shortTag = Buffer.concat([bytes.subarray(0, 12 + 4), bytes.subarray(28)]).toString("base64");
    expect(() => secrets.decrypt(shortTag, JOIN_KEY_VERSION)).toThrow();
    const other = createJoinSecrets("another-key", "http://127.0.0.1:3010");
    expect(() => other.decrypt(stored, JOIN_KEY_VERSION)).toThrow();
  });

  it("TC-F01-78 [AC-F01-31] the whole link, the token, or the code typed loosely give the stored hashes", () => {
    const secret = secrets.create();
    const { linkHmac, codeHmac } = secrets.hashes(secret);
    expect(linkHmac).toMatch(/^[0-9a-f]{64}$/);
    expect(secrets.lookupFor(secrets.linkOf(secret)).linkHmac).toBe(linkHmac);
    expect(secrets.lookupFor(` ${secret.token} `).linkHmac).toBe(linkHmac);
    const loose = `${secret.code.slice(0, 5).toLowerCase()} - ${secret.code.slice(5)}`;
    expect(secrets.lookupFor(loose).codeHmac).toBe(codeHmac);
    // A link and a code never share a hash, and another key gives other hashes.
    expect(secrets.lookupFor(secret.code).linkHmac).not.toBe(linkHmac);
    expect(createJoinSecrets("another-key", "x").hashes(secret).codeHmac).not.toBe(codeHmac);
  });
});
