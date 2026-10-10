// Tests for the settings check (F00 T7): a missing or wrong setting stops the backend with the
// setting's name and a pointer to .env.example, and never prints any setting's value.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CONFIG_KEYS, OPTIONAL_KEYS, fakeEnv } from "../test-support/fake-env.ts";
import { ConfigError, configSchema, loadConfig } from "./config.ts";

const ROOT = fileURLToPath(new URL("../../../..", import.meta.url));
const SERVER = join(ROOT, "apps/api/src/server.ts");
const REQUIRED_KEYS = CONFIG_KEYS.filter((key) => !OPTIONAL_KEYS.includes(key));

/** The environment without the given settings. */
function without(env: Record<string, string>, ...keys: string[]): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([key]) => !keys.includes(key)));
}

/** Runs loadConfig and returns the ConfigError it throws (fails the test if it does not throw one). */
function configErrorFor(env: Record<string, string | undefined>): ConfigError {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return error as ConfigError;
  }
  throw new Error("loadConfig did not throw");
}

describe("TC-F00-11 [AC-F00-05] a missing required setting stops the backend", () => {
  it("TC-F00-11 [AC-F00-05] the complete fake environment is valid", () => {
    expect(() => loadConfig(fakeEnv())).not.toThrow();
    expect(REQUIRED_KEYS.length).toBeGreaterThanOrEqual(15);
  });

  it.each(REQUIRED_KEYS)(
    "TC-F00-11 [AC-F00-05] without %s: names it, points to .env.example, prints no values",
    (key) => {
      const env = without(fakeEnv(), key);
      const error = configErrorFor(env);
      expect(error.message).toContain(`Missing setting ${key}`);
      expect(error.message).toContain("see .env.example");
      for (const [otherKey, value] of Object.entries(env)) {
        if (value === "" || otherKey === "NODE_ENV" || otherKey === "API_HOST" || otherKey === "POSTGRES_HOST")
          continue;
        expect(error.message, `value of ${otherKey} leaked`).not.toContain(value);
      }
    },
  );

  it.each(REQUIRED_KEYS)("TC-F00-11 [AC-F00-05] an empty %s counts as missing", (key) => {
    const env = { ...fakeEnv(), [key]: "" };
    expect(configErrorFor(env).message).toContain(`Missing setting ${key}`);
  });

  it("TC-F00-11 [AC-F00-05] a port that is not a number is reported as invalid, without its value", () => {
    const error = configErrorFor({ ...fakeEnv(), API_PORT: "abc" });
    expect(error.message).toContain("Invalid setting API_PORT");
    expect(error.message).toContain("see .env.example");
    expect(error.message).not.toContain("abc");
  });

  it("TC-F00-11 [AC-F00-05] a port outside 1-65535 is invalid", () => {
    expect(configErrorFor({ ...fakeEnv(), POSTGRES_PORT: "70000" }).message).toContain("Invalid setting POSTGRES_PORT");
  });

  it("TC-F00-11 [AC-F00-05] several problems are all listed, each once", () => {
    const error = configErrorFor(without(fakeEnv(), "POSTGRES_PASSWORD", "STORAGE_SECRET_KEY"));
    expect(error.problems).toHaveLength(2);
    expect(error.message).toContain("Missing setting POSTGRES_PASSWORD");
    expect(error.message).toContain("Missing setting STORAGE_SECRET_KEY");
  });

  it("TC-F00-11 [AC-F00-05] an unknown NODE_ENV is rejected", () => {
    expect(configErrorFor({ ...fakeEnv(), NODE_ENV: "staging" }).message).toContain("Invalid setting NODE_ENV");
  });

  it("TC-F00-11 [AC-F00-05] optional settings: empty SENTRY_DSN and OTel endpoint mean off, POSTGRES_HOST defaults", () => {
    const env = without(fakeEnv(), "POSTGRES_HOST");
    const config = loadConfig({ ...env, SENTRY_DSN: "", OTEL_EXPORTER_OTLP_ENDPOINT: "" });
    expect(config.SENTRY_DSN).toBeUndefined();
    expect(config.OTEL_EXPORTER_OTLP_ENDPOINT).toBeUndefined();
    expect(config.POSTGRES_HOST).toBe("127.0.0.1");
    expect(typeof config.API_PORT).toBe("number");
  });

  it("TC-F00-11 [AC-F00-05] the real server exits with code 1 and names the missing settings", () => {
    const result = spawnSync(process.execPath, [SERVER], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 10_000,
      env: { PATH: process.env["PATH"] ?? "", NODE_ENV: "production" },
    });
    expect(result.signal, "the server did not stop within 10 s").toBeNull();
    expect(result.status, result.stderr).toBe(1);
    expect(result.stderr).toContain("Missing setting POSTGRES_PASSWORD");
    expect(result.stderr).toContain("see .env.example");
  }, 15_000);
});

describe("TC-F00-12 [AC-F00-05] [AC-F00-06] every setting is documented in .env.example", () => {
  it("TC-F00-12 [AC-F00-05] every key of the Zod config schema appears in .env.example", () => {
    const lines = readFileSync(join(ROOT, ".env.example"), "utf8")
      .split("\n")
      .map((line) => line.trim());
    for (const key of Object.keys(configSchema.shape)) {
      expect(
        lines.some((line) => line.startsWith(`${key}=`)),
        `${key} is missing from .env.example`,
      ).toBe(true);
    }
  });
});
