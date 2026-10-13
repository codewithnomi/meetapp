// TC-F01-75 (AC-F01-30), security: sample data with a published password is refused anywhere but a
// development or test database on this computer.
import { describe, expect, it } from "vitest";
import { seedRefusal } from "./seed-guard.ts";

describe("seed guard", () => {
  it("TC-F01-75 [AC-F01-30] production, an unset NODE_ENV and a database elsewhere are refused with a reason", () => {
    expect(seedRefusal({ NODE_ENV: "production", POSTGRES_HOST: "127.0.0.1" })).toMatch(/NODE_ENV is "production"/);
    expect(seedRefusal({ POSTGRES_HOST: "127.0.0.1" })).toMatch(/NODE_ENV is "not set"/);
    expect(seedRefusal({ NODE_ENV: "development", POSTGRES_HOST: "db.example.com" })).toMatch(
      /"db\.example\.com" is not on this computer/,
    );
  });

  it("TC-F01-75 [AC-F01-30] development or test on this computer may seed", () => {
    expect(seedRefusal({ NODE_ENV: "development" })).toBeUndefined();
    expect(seedRefusal({ NODE_ENV: "test", POSTGRES_HOST: "localhost" })).toBeUndefined();
    expect(seedRefusal({ NODE_ENV: "development", POSTGRES_HOST: "::1" })).toBeUndefined();
  });
});
