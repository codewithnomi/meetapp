// TC-F00-54 (security rule S10, AC-F00-22): Sentry reports never carry personal data. Sentry 11 replaced
// `sendDefaultPii` with `dataCollection`; "sendDefaultPii: false" in tests.md means every category is off.
import type { ErrorEvent } from "@sentry/node";
import { describe, expect, it } from "vitest";
import { NO_PERSONAL_DATA, sentryOptions, stripPersonalData } from "./sentry.ts";

const DSN = "https://public@127.0.0.1:9/1";

function eventWithPersonalData(): ErrorEvent {
  return {
    type: undefined,
    message: "boom",
    tags: { requestId: "req-1" },
    exception: { values: [{ type: "Error", value: "boom" }] },
    request: {
      url: "http://127.0.0.1:3000/api/v1/x",
      method: "POST",
      data: { password: "hunter2" },
      cookies: { session: "secret-cookie" },
      headers: { authorization: "Bearer secret-token" },
      query_string: "email=alice@example.com",
    },
    user: { id: "u1", email: "alice@example.com", ip_address: "10.0.0.5" },
  };
}

describe("TC-F00-54 [AC-F00-22] Sentry receives no personal data (security)", () => {
  it("TC-F00-54 [AC-F00-22] beforeSend removes body, cookies, headers, query string and user", () => {
    const result = stripPersonalData(eventWithPersonalData());
    expect(result.request).toBeDefined();
    expect(result.request).not.toHaveProperty("data");
    expect(result.request).not.toHaveProperty("cookies");
    expect(result.request).not.toHaveProperty("headers");
    expect(result.request).not.toHaveProperty("query_string");
    expect(result).not.toHaveProperty("user");
    const serialized = JSON.stringify(result);
    for (const secret of ["hunter2", "secret-cookie", "secret-token", "alice@example.com", "10.0.0.5"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("TC-F00-54 [AC-F00-22] beforeSend keeps the exception, message and tags", () => {
    const result = stripPersonalData(eventWithPersonalData());
    expect(result.message).toBe("boom");
    expect(result.tags).toEqual({ requestId: "req-1" });
    expect(result.exception?.values?.[0]?.value).toBe("boom");
  });

  it("TC-F00-54 [AC-F00-22] beforeSend works on an event without a request", () => {
    const event: ErrorEvent = { type: undefined, message: "x", user: { id: "u1" } };
    const result = stripPersonalData(event);
    expect(result).not.toHaveProperty("user");
    expect(result.message).toBe("x");
  });

  it("TC-F00-54 [AC-F00-22] API init options switch every data collection category off", () => {
    const options = sentryOptions(DSN);
    expect(options.dsn).toBe(DSN);
    expect(options.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    });
    expect(options.dataCollection).toBe(NO_PERSONAL_DATA);
  });

  it("TC-F00-54 [AC-F00-22] no data collection category is left on", () => {
    const leaves: unknown[] = [];
    const walk = (value: unknown): void => {
      if (Array.isArray(value)) leaves.push(value.length === 0 ? false : value);
      else if (typeof value === "object" && value !== null) Object.values(value).forEach(walk);
      else leaves.push(value);
    };
    walk(sentryOptions(DSN).dataCollection);
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves.every((leaf) => leaf === false)).toBe(true);
  });

  it("TC-F00-54 [AC-F00-22] API init options use stripPersonalData as beforeSend", () => {
    expect(sentryOptions(DSN).beforeSend).toBe(stripPersonalData);
  });

  it.todo("TC-F00-54 [AC-F00-22] desktop (Electron main) Sentry init options collect no personal data (T15)");
});
