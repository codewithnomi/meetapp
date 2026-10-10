// Tests for the error format and log redaction (F00 T7): an unexpected error answers with only a
// reference id, and nothing secret or personal reaches the logs.
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { captureLogs, fakeConfig, type CapturedLogs } from "../test-support/fake-env.ts";
import { maskSensitiveText } from "./logging.ts";

// Built from parts so secret scanners don't mistake the fake values for real ones.
const PASSWORD = "hunter" + "2";
const EMAIL = "alice" + "@example.com";
const TOKEN = ["abc", "def", "ghi"].join(".");
const COOKIE_VALUE = "s3cr3t" + "cookie";
const BODY = { password: PASSWORD, email: EMAIL };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function failingRequest(logs: CapturedLogs) {
  app = await buildApp(fakeConfig("test"), { logDestination: logs.stream });
  return app.inject({
    method: "POST",
    url: "/__test__/error",
    payload: BODY,
    headers: { authorization: `Bearer ${TOKEN}`, cookie: `session=${COOKIE_VALUE}` },
  });
}

describe("TC-F00-49 [AC-F00-20] an unexpected error returns the safe 500 body", () => {
  it("TC-F00-49 [AC-F00-20] answers 500 with only the code, a reference message and the requestId", async () => {
    const response = await failingRequest(captureLogs());
    const id = response.headers["x-request-id"];
    expect(response.statusCode).toBe(500);
    expect(id).toMatch(UUID);
    expect(response.json()).toStrictEqual({
      error: { code: "INTERNAL_ERROR", message: `Something went wrong. Reference: ${String(id)}`, requestId: id },
    });
  });

  it("TC-F00-49 [AC-F00-20] echoes no stack, error message or input", async () => {
    const response = await failingRequest(captureLogs());
    for (const forbidden of [PASSWORD, "alice", "stack", "Error", "password", " at "]) {
      expect(response.body, forbidden).not.toContain(forbidden);
    }
  });

  it("TC-F00-49 [AC-F00-20] an unknown route answers 404 in the same format", async () => {
    app = await buildApp(fakeConfig("test"), { logDestination: captureLogs().stream });
    const response = await app.inject({ method: "GET", url: "/api/v1/does-not-exist" });
    const id = response.headers["x-request-id"];
    expect(response.statusCode).toBe(404);
    expect(response.json()).toStrictEqual({ error: { code: "NOT_FOUND", message: "Not found.", requestId: id } });
  });

  it("TC-F00-49 [AC-F00-20] a body that is not valid JSON answers 400 in the same format", async () => {
    app = await buildApp(fakeConfig("test"), { logDestination: captureLogs().stream });
    const response = await app.inject({
      method: "POST",
      url: "/__test__/error",
      payload: "{not json",
      headers: { "content-type": "application/json" },
    });
    const id = response.headers["x-request-id"];
    expect(response.statusCode).toBe(400);
    expect(response.json()).toStrictEqual({
      error: { code: "BAD_REQUEST", message: "The request is not valid.", requestId: id },
    });
  });

  it.todo(
    "TC-F00-49 [AC-F00-20] invalid input to a validated route answers 400 BAD_REQUEST with details (needs a validated route, T9)",
  );

  it.each(["development", "production"] as const)(
    "TC-F00-49 [AC-F00-20] the failing test route does not exist when NODE_ENV is %s",
    async (nodeEnv) => {
      app = await buildApp(fakeConfig(nodeEnv), { logDestination: captureLogs().stream });
      const response = await app.inject({ method: "POST", url: "/__test__/error", payload: BODY });
      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
    },
  );
});

describe("TC-F00-50 [AC-F00-20] error logs are redacted (security)", () => {
  it("TC-F00-50 [AC-F00-20] logs the error at level error with the same requestId", async () => {
    const logs = captureLogs();
    const response = await failingRequest(logs);
    const id = response.headers["x-request-id"];
    const forRequest = logs.lines().filter((line) => line["requestId"] === id);
    expect(forRequest.length).toBeGreaterThan(0);
    expect(forRequest.some((line) => line["level"] === 50)).toBe(true);
  });

  it("TC-F00-50 [AC-F00-20] the logs contain no password, email, authorization, cookie or request body", async () => {
    const logs = captureLogs();
    await failingRequest(logs);
    const text = logs.text();
    expect(text.length).toBeGreaterThan(0);
    for (const forbidden of [PASSWORD, EMAIL, TOKEN, COOKIE_VALUE, JSON.stringify(BODY)]) {
      expect(text, "a secret or personal value reached the logs").not.toContain(forbidden);
    }
    for (const line of logs.lines()) {
      const body = (line["req"] as Record<string, unknown> | undefined)?.["body"] ?? line["body"];
      expect(body === undefined || body === "[redacted]", "a request body was logged").toBe(true);
    }
  });
});

describe("TC-F00-50 [AC-F00-20] maskSensitiveText hides secrets inside free text", () => {
  it("TC-F00-50 [AC-F00-20] hides email addresses", () => {
    const masked = maskSensitiveText(`user ${EMAIL} and bob.smith+x@mail.example.org failed`);
    expect(masked).toBe("user [email] and [email] failed");
  });

  it.each([
    ["password=", `db password=${PASSWORD} failed`, "db password=[redacted] failed", PASSWORD],
    ['token: "..."', `token: "${TOKEN}" rejected`, "token: [redacted] rejected", TOKEN],
    ["api_key=", "api_key=" + "k-9f8e7d", "api_key=[redacted]", "k-9f8e7d"],
    ["Secret : '...'", "Secret : 'xyz pq'", "Secret : [redacted]", "xyz pq"],
  ])("TC-F00-50 [AC-F00-20] hides the value of %s", (_label, input, expected, secret) => {
    const masked = maskSensitiveText(input);
    expect(masked).toBe(expected);
    expect(masked).not.toContain(secret);
  });

  it("TC-F00-50 [AC-F00-20] leaves ordinary text alone", () => {
    expect(maskSensitiveText("connection refused on port 5432")).toBe("connection refused on port 5432");
  });
});
