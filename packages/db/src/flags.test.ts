// Unit tests for the flag-name check and the connection address (F00 T6). No database needed.
import { describe, expect, it } from "vitest";
import { databaseUrl } from "./connection.ts";
import { FLAG_KEY_MAX_LENGTH, isValidFlagKey } from "./flags.ts";

const KEY_64 = `a${"b".repeat(FLAG_KEY_MAX_LENGTH - 1)}`;
const KEY_65 = `${KEY_64}c`;

describe("TC-F00-75 [AC-F00-34] isValidFlagKey", () => {
  it.each(["home.welcome_banner", "a", "labs.preview-features", "x1.y_2-z3", KEY_64])("accepts %s", (key) => {
    expect(isValidFlagKey(key)).toBe(true);
  });

  it("the longest accepted key is exactly 64 characters", () => {
    expect(KEY_64).toHaveLength(64);
    expect(FLAG_KEY_MAX_LENGTH).toBe(64);
  });

  it.each([
    ["empty", ""],
    ["upper case", "Home"],
    ["starts with a digit", "1abc"],
    ["double separator", "a..b"],
    ["ends with a separator", "a."],
    ["starts with a separator", ".a"],
    ["SQL injection", "x'; drop table feature_flags;--"],
    ["65 characters", KEY_65],
    ["space inside", "home welcome"],
    ["leading space", " home"],
    ["trailing newline", "home\n"],
    ["unicode letter", "café"],
    ["unicode look-alike", "hоme"], // Cyrillic "о"
    ["emoji", "home.\u{1F600}"],
    ["percent", "home%20x"],
    ["quote", 'home"x'],
  ])("rejects %s", (_name, key) => {
    expect(isValidFlagKey(key)).toBe(false);
  });
});

describe("databaseUrl", () => {
  it("builds a postgres address and defaults the host to 127.0.0.1", () => {
    expect(
      databaseUrl({ POSTGRES_USER: "meetapp", POSTGRES_PASSWORD: "pw", POSTGRES_DB: "meetapp", POSTGRES_PORT: "5433" }),
    ).toBe("postgres://meetapp:pw@127.0.0.1:5433/meetapp");
  });

  it("uses the given host when one is set", () => {
    const url = databaseUrl({
      POSTGRES_USER: "u",
      POSTGRES_PASSWORD: "p",
      POSTGRES_DB: "d",
      POSTGRES_PORT: "5432",
      POSTGRES_HOST: "db.local",
    });
    expect(new URL(url).hostname).toBe("db.local");
  });

  it("URL-encodes special characters in user, password and database name", () => {
    const settings = {
      POSTGRES_USER: "us@er:1",
      POSTGRES_PASSWORD: "p@ss:w/rd#?%",
      POSTGRES_DB: "my/db#1",
      POSTGRES_PORT: "5432",
    };
    const url = databaseUrl(settings);
    const parsed = new URL(url);
    expect(parsed.protocol).toBe("postgres:");
    expect(parsed.hostname).toBe("127.0.0.1");
    expect(parsed.port).toBe("5432");
    expect(parsed.hash).toBe("");
    expect(parsed.search).toBe("");
    expect(decodeURIComponent(parsed.username)).toBe(settings.POSTGRES_USER);
    expect(decodeURIComponent(parsed.password)).toBe(settings.POSTGRES_PASSWORD);
    expect(decodeURIComponent(parsed.pathname.slice(1))).toBe(settings.POSTGRES_DB);
  });
});
