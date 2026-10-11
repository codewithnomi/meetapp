// TC-F00-24 (AC-F00-12): tokens.json is the approved design-system file, byte for byte.
// The approved SHA-256 is recorded in the package README; changing a token means changing both.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TOKENS_FILE } from "./tokens.ts";

const README = fileURLToPath(new URL("../README.md", import.meta.url));

function approvedHash(): string | undefined {
  return /Approved SHA-256:\*{0,2}\s*`([0-9a-f]{64})`/.exec(readFileSync(README, "utf8"))?.[1];
}

describe("TC-F00-24 [AC-F00-12] tokens are the approved design system, unchanged", () => {
  it("TC-F00-24 [AC-F00-12] the README records an approved SHA-256", () => {
    expect(approvedHash()).toMatch(/^[0-9a-f]{64}$/);
  });

  it("TC-F00-24 [AC-F00-12] the SHA-256 of tokens.json equals the approved hash", () => {
    const actual = createHash("sha256").update(readFileSync(TOKENS_FILE)).digest("hex");
    expect(actual).toBe(approvedHash());
  });
});
