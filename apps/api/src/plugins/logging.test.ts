// TC-F00-50 (AC-F00-20, security rule S10): one-time secrets in web addresses (?token=, ?code=, …) never
// reach the logs or the traces. Found in the F00 security review: the request log kept the full address,
// and tracing only hid cloud-storage signatures. Password-reset and sign-in links arrive with F01.
import { pino } from "pino";
import { describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { httpInstrumentationConfig } from "../observability/telemetry.ts";
import { captureLogs, fakeConfig } from "../test-support/fake-env.ts";
import {
  SENSITIVE_QUERY_PARAMS,
  loggerOptions,
  maskSensitiveText,
  redactPath,
  redactQuery,
  redactUrl,
} from "./logging.ts";

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

// TC-F02-109 (AC-F02-52): meeting links, tickets, passcodes and call-server passes are hidden too.
const LINK_PART = "Zq3xK9wLm2Pa7Rt5Yb1Cd8";
const PASS = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.c2lnbmF0dXJlLXBhcnQ";

describe("TC-F02-109 [AC-F02-52] meeting secrets are hidden", () => {
  it("TC-F02-109 [AC-F02-52] the meeting link's secret part is hidden, with or without the site; other paths stay", () => {
    expect(redactPath(`/m/${LINK_PART}`)).toBe("/m/REDACTED");
    expect(redactUrl(`/m/${LINK_PART}?lang=en`)).toBe("/m/REDACTED?lang=en");
    expect(redactPath(`https://meetapp.example/m/${LINK_PART}`)).toBe("https://meetapp.example/m/REDACTED");
    expect(redactPath("/api/v1/meetings/abc")).toBe("/api/v1/meetings/abc");
    // A chat file link is its own permission for 5 minutes (F03 verification).
    expect(redactPath("/api/v1/chat-files/abc.f.123.sig?x=1")).toBe("/api/v1/chat-files/REDACTED?x=1");
    expect(redactPath("/media/photo.png")).toBe("/media/photo.png");
  });

  it("TC-F02-109 [AC-F02-52] passes and link parts inside free text are hidden; other text is unchanged", () => {
    expect(maskSensitiveText(`connect failed with ${PASS} now`)).toBe("connect failed with [pass] now");
    expect(maskSensitiveText(`no meeting at https://x.example/m/${LINK_PART}`)).toBe(
      "no meeting at https://x.example/m/REDACTED",
    );
    expect(maskSensitiveText("Meeting full (100 people)")).toBe("Meeting full (100 people)");
  });

  it("TC-F02-109 [AC-F02-52] the ticket header and secret fields are removed from log lines", () => {
    const logs = captureLogs();
    const log = pino(loggerOptions("info"), logs.stream);
    log.info(
      {
        req: { method: "GET", url: `/m/${LINK_PART}`, headers: { "x-meeting-ticket": "ticket-secret-1" } },
        client: "MeetApp",
        passcode: "pc9x2Q",
        answer: { ticket: "ticket-secret-2", lookupToken: "lookup-secret-3", call: { pass: PASS } },
        meeting: { link: `https://x.example/m/${LINK_PART}`, title: "Weekly" },
        deviceKey: "device-secret-4",
      },
      "joined",
    );
    const text = logs.text();
    for (const secret of [
      "ticket-secret-1",
      "pc9x2Q",
      "ticket-secret-2",
      "lookup-secret-3",
      PASS,
      LINK_PART,
      "device-secret-4",
    ])
      expect(text, secret).not.toContain(secret);
    expect(text).toContain("MeetApp");
    expect(text).toContain("Weekly");
  });

  it("TC-F02-109 [AC-F02-52] traces hide the meeting link and record no headers or bodies", () => {
    const config = httpInstrumentationConfig();
    expect(config.headersToSpanAttributes).toBeUndefined();
    const attributes: Record<string, unknown> = {};
    const span = { setAttribute: (name: string, value: unknown) => (attributes[name] = value) };
    config.requestHook?.(span as never, { url: `/m/${LINK_PART}?lang=en` } as never);
    expect(attributes["url.path"]).toBe("/m/REDACTED");
    expect(JSON.stringify(attributes)).not.toContain(LINK_PART);
  });
});
