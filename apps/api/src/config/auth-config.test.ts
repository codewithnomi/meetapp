// The sign-in settings added in F01 (T1, design.md "Security and privacy" S7): the secrets that sign
// sessions and encrypt data must be long enough, Google/Microsoft are on only when both their keys
// are set, and the support address and public address are checked. Values are never printed.
import { describe, expect, it } from "vitest";
import { fakeEnv } from "../test-support/fake-env.ts";
import { ConfigError, loadConfig, signInProviders } from "./config.ts";

function problemsFor(env: Record<string, string>): string[] {
  try {
    loadConfig(env);
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    return (error as ConfigError).problems;
  }
  return [];
}

describe("TC-F01-83 [AC-F01-33] start-up refuses weak or missing sign-in secrets", () => {
  it("TC-F01-83 [AC-F01-33] BETTER_AUTH_SECRET shorter than 32 characters stops the backend, without its value", () => {
    const problems = problemsFor({ ...fakeEnv(), BETTER_AUTH_SECRET: "short-secret-1234" });
    expect(problems.join("\n")).toContain("BETTER_AUTH_SECRET");
    expect(problems.join("\n")).not.toContain("short-secret-1234");
  });

  it("TC-F01-83 [AC-F01-33] a missing DATA_ENCRYPTION_KEY stops the backend, naming it", () => {
    const env = fakeEnv();
    delete env["DATA_ENCRYPTION_KEY"];
    expect(problemsFor(env)).toContainEqual(expect.stringContaining("Missing setting DATA_ENCRYPTION_KEY"));
  });

  it("TC-F01-83 [AC-F01-33] a DATA_ENCRYPTION_KEY shorter than 32 characters is invalid", () => {
    expect(problemsFor({ ...fakeEnv(), DATA_ENCRYPTION_KEY: "too-short" })).toContainEqual(
      expect.stringContaining("Invalid setting DATA_ENCRYPTION_KEY"),
    );
  });

  it("TC-F01-83 [AC-F01-33] SUPPORT_EMAIL must be an email address and APP_PUBLIC_URL a web address", () => {
    const problems = problemsFor({ ...fakeEnv(), SUPPORT_EMAIL: "not-an-email", APP_PUBLIC_URL: "nowhere" });
    expect(problems).toContainEqual(expect.stringContaining("SUPPORT_EMAIL"));
    expect(problems).toContainEqual(expect.stringContaining("APP_PUBLIC_URL"));
  });
});

describe("TC-F01-20 [AC-F01-07] Google and Microsoft are on only when both their keys are set", () => {
  it("TC-F01-20 [AC-F01-07] with no keys both providers are off and the backend starts", () => {
    expect(signInProviders(loadConfig(fakeEnv()))).toEqual({ google: false, microsoft: false });
  });

  it("TC-F01-20 [AC-F01-07] both Google keys turn Google on; Microsoft stays off", () => {
    const config = loadConfig({ ...fakeEnv(), GOOGLE_CLIENT_ID: "google-id", GOOGLE_CLIENT_SECRET: "google-secret" });
    expect(signInProviders(config)).toEqual({ google: true, microsoft: false });
  });

  it("TC-F01-20 [AC-F01-07] only one of a provider's two keys is a mistake and stops the backend", () => {
    const problems = problemsFor({ ...fakeEnv(), MICROSOFT_CLIENT_ID: "ms-id" });
    expect(problems).toContainEqual(expect.stringContaining("MICROSOFT_CLIENT_SECRET"));
    expect(problems.join("\n")).not.toContain("ms-id");
  });
});
