// TC-F00-50 (AC-F00-20, security rule S10): one-time secrets in web addresses (?token=, ?code=, …) never
// reach the logs or the traces. Found in the F00 security review: the request log kept the full address,
// and tracing only hid cloud-storage signatures. Password-reset and sign-in links arrive with F01.
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { httpInstrumentationConfig } from "../observability/telemetry.ts";
import { captureLogs, fakeConfig } from "../test-support/fake-env.ts";
import { SENSITIVE_QUERY_PARAMS, redactQuery } from "./logging.ts";

describe("TC-F00-50 [AC-F00-20] secrets in web addresses are hidden", () => {
  it("TC-F00-50 [AC-F00-20] redactQuery hides the value of every sensitive name and keeps the rest", () => {
    expect(redactQuery("/reset?token=abc123&lang=en")).toBe("/reset?token=REDACTED&lang=en");
    expect(redactQuery("/cb?code=xyz&state=s1")).toBe("/cb?code=REDACTED&state=REDACTED");
    expect(redactQuery("/a?Access_Token=t")).toBe("/a?Access_Token=REDACTED");
    expect(redactQuery("/api/v1/health")).toBe("/api/v1/health");
    expect(redactQuery("/x?page=2")).toBe("/x?page=2");
  });

  it("TC-F00-50 [AC-F00-20] a broken address (stray %) is logged as it is, without failing the request", async () => {
    expect(redactQuery("/x?%E0%A4%A=1&token=t")).toBe("/x?%E0%A4%A=1&token=REDACTED");
    expect(redactQuery("/x?%")).toBe("/x?%");
    const logs = captureLogs();
    const app = await buildApp(fakeConfig("test"), { logDestination: logs.stream });
    try {
      const response = await app.inject({ method: "GET", url: "/api/v1/health?%&token=secret-789" });
      expect(response.statusCode).not.toBe(500);
      expect(logs.text()).not.toContain("secret-789");
    } finally {
      await app.close();
    }
  });

  it("TC-F00-50 [AC-F00-20] the request log line never contains a token from the address", async () => {
    const logs = captureLogs();
    const app = await buildApp(fakeConfig("test"), { logDestination: logs.stream });
    try {
      await app.inject({ method: "GET", url: "/api/v1/health?token=secret-reset-123&code=oauth-456" });
      expect(logs.text()).not.toContain("secret-reset-123");
      expect(logs.text()).not.toContain("oauth-456");
      expect(logs.text()).toContain("token=REDACTED");
    } finally {
      await app.close();
    }
  });

  it("TC-F00-50 [AC-F00-20] tracing hides the same names, in both directions, plus the cloud-storage signatures", () => {
    const config = httpInstrumentationConfig();
    for (const list of [config.redactedQueryParams, config.redactedQueryParamsServer]) {
      for (const name of [...SENSITIVE_QUERY_PARAMS, "sig", "X-Amz-Signature"]) expect(list).toContain(name);
    }
  });

  it("TC-F00-50 [AC-F00-20] the sensitive names cover sign-in and reset links", () => {
    for (const name of ["token", "code", "state", "access_token", "refresh_token", "password", "key"]) {
      expect(SENSITIVE_QUERY_PARAMS).toContain(name);
    }
  });
});
