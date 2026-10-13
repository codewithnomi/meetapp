// TC-F01-06 (AC-F01-03): one password rule for sign-up, password change and reset.
import { describe, expect, it } from "vitest";
import { COMMON_PASSWORD_COUNT, checkPassword } from "./password-rule.ts";

describe("TC-F01-06 [AC-F01-03] password rules", () => {
  it("TC-F01-06 [AC-F01-03] 10 and 128 characters are accepted", () => {
    expect(checkPassword("k".repeat(9) + "Z")).toBeUndefined();
    expect(checkPassword("q".repeat(127) + "!")).toBeUndefined();
  });

  it("TC-F01-06 [AC-F01-03] 9 characters are refused as too short, 129 as too long", () => {
    expect(checkPassword("abcdefgh9")).toBe("TOO_SHORT");
    expect(checkPassword("x".repeat(129))).toBe("TOO_LONG");
  });

  it("TC-F01-06 [AC-F01-03] a password from the common list is refused, whatever its letter case", () => {
    expect(checkPassword("password123")).toBe("TOO_COMMON");
    expect(checkPassword("PASSWORD123")).toBe("TOO_COMMON");
    expect(checkPassword("1234567890")).toBe("TOO_COMMON");
  });

  it("TC-F01-06 [AC-F01-03] the list holds the 10,000 most common passwords", () => {
    expect(COMMON_PASSWORD_COUNT).toBe(10_000);
  });
});
