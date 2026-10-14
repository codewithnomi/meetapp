// Tests for the call server's address (F02 T1, design section 5): the app connects with wss:// online,
// and with plain ws:// only on this computer during development (TC-F02-110, settings part). The
// DTLS-SRTP part of TC-F02-110 needs a real call and is tested in T14.
import { describe, expect, it } from "vitest";
import { fakeEnv } from "../test-support/fake-env.ts";
import { ConfigError, callServerUrl, isAllowedCallServerUrl, loadConfig } from "./config.ts";

function problemsFor(env: Record<string, string>): string[] {
  try {
    loadConfig(env);
    return [];
  } catch (error) {
    if (error instanceof ConfigError) return error.problems;
    throw error;
  }
}

describe("TC-F02-110 [AC-F02-53] the call server's address", () => {
  it("TC-F02-110 [AC-F02-53] development: empty means this computer's call server", () => {
    const config = loadConfig({ ...fakeEnv("development"), LIVEKIT_PORT: "7880" });
    expect(callServerUrl(config)).toBe("ws://127.0.0.1:7880");
  });

  it("TC-F02-110 [AC-F02-53] wss:// is accepted everywhere", () => {
    for (const nodeEnv of ["development", "production"] as const) {
      const env = { ...fakeEnv(nodeEnv), LIVEKIT_PUBLIC_URL: "wss://call.example.test" };
      expect(problemsFor(env)).toEqual([]);
      expect(callServerUrl(loadConfig(env))).toBe("wss://call.example.test");
    }
  });

  it("TC-F02-110 [AC-F02-53] production refuses ws:// and a missing address", () => {
    const production = fakeEnv("production");
    expect(problemsFor({ ...production, LIVEKIT_PUBLIC_URL: "ws://127.0.0.1:7880" })).toContainEqual(
      expect.stringContaining("LIVEKIT_PUBLIC_URL"),
    );
    expect(problemsFor({ ...production, LIVEKIT_PUBLIC_URL: "" })).toContainEqual(
      expect.stringContaining("LIVEKIT_PUBLIC_URL"),
    );
  });

  it("TC-F02-110 [AC-F02-53] development allows ws:// only on this computer", () => {
    expect(isAllowedCallServerUrl("ws://127.0.0.1:7880", "development")).toBe(true);
    expect(isAllowedCallServerUrl("ws://localhost:7880", "test")).toBe(true);
    expect(isAllowedCallServerUrl("ws://call.example.test", "development")).toBe(false);
    expect(isAllowedCallServerUrl("http://127.0.0.1:7880", "development")).toBe(false);
    expect(isAllowedCallServerUrl("not a url", "development")).toBe(false);
  });

  it("TC-F02-110 [AC-F02-53] production refuses the example call-server secret", () => {
    const example = "local_dev_livekit_secret_change_me_online";
    const problems = problemsFor({ ...fakeEnv("production"), LIVEKIT_API_SECRET: example });
    expect(problems).toContainEqual(expect.stringContaining("LIVEKIT_API_SECRET"));
    expect(problems.join("\n")).not.toContain(example);
  });
});
