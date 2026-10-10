// Tests for the backend core (F00 T7): CORS only for the app's own origins, a request id on every
// answer, and the basic health endpoint. Uses app.inject(), so no network port is opened.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ALLOWED_ORIGINS, buildApp } from "./app.ts";
import { captureLogs, fakeConfig } from "./test-support/fake-env.ts";

const ENV_EXAMPLE = fileURLToPath(new URL("../../../.env.example", import.meta.url));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const HEALTH = "/api/v1/health";
const EVIL = ["https://evil.example", "http://localhost:5173", "http://127.0.0.1:5174", "null", "app://meetapp.evil"];

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildApp(fakeConfig("test"), { logDestination: captureLogs().stream });
});
afterAll(async () => {
  await app.close();
});

function preflight(origin: string) {
  return app.inject({
    method: "OPTIONS",
    url: HEALTH,
    headers: { origin, "access-control-request-method": "GET" },
  });
}

describe("TC-F00-57 [AC-F00-23] CORS allows only the app's own origins (security)", () => {
  it("TC-F00-57 [AC-F00-23] the allowed list is exactly the desktop app and the local dev page", () => {
    expect(ALLOWED_ORIGINS).toEqual(["app://meetapp", "http://127.0.0.1:5173"]);
  });

  it.each(EVIL)("TC-F00-57 [AC-F00-23] origin %s gets no Access-Control-Allow-Origin (preflight)", async (origin) => {
    const response = await preflight(origin);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it.each(EVIL)("TC-F00-57 [AC-F00-23] origin %s gets no Access-Control-Allow-Origin (simple GET)", async (origin) => {
    const response = await app.inject({ method: "GET", url: HEALTH, headers: { origin } });
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it.each(ALLOWED_ORIGINS)("TC-F00-57 [AC-F00-23] origin %s is allowed (preflight)", async (origin) => {
    const response = await preflight(origin);
    expect(response.statusCode).toBeLessThan(300);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
  });

  it.each(ALLOWED_ORIGINS)("TC-F00-57 [AC-F00-23] origin %s is allowed (simple GET)", async (origin) => {
    const response = await app.inject({ method: "GET", url: HEALTH, headers: { origin } });
    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe(origin);
  });

  it("TC-F00-57 [AC-F00-23] CORS never answers with a wildcard", async () => {
    const response = await app.inject({ method: "GET", url: HEALTH, headers: { origin: "https://evil.example" } });
    expect(response.headers["access-control-allow-origin"]).not.toBe("*");
  });
});

describe("TC-F00-49 [AC-F00-20] every answer carries a request id", () => {
  it("TC-F00-49 [AC-F00-20] each response has a UUID x-request-id, different per request", async () => {
    const first = await app.inject({ method: "GET", url: HEALTH });
    const second = await app.inject({ method: "GET", url: "/nope" });
    expect(first.headers["x-request-id"]).toMatch(UUID);
    expect(second.headers["x-request-id"]).toMatch(UUID);
    expect(first.headers["x-request-id"]).not.toBe(second.headers["x-request-id"]);
  });

  it("TC-F00-49 [AC-F00-20] a request id sent by the caller is not trusted", async () => {
    const response = await app.inject({ method: "GET", url: HEALTH, headers: { "x-request-id": "attacker-chosen" } });
    expect(response.headers["x-request-id"]).toMatch(UUID);
  });
});

describe("TC-F00-07 [AC-F00-02] health answers when the backend is up (T7 part: api only; T8 adds the services)", () => {
  it("TC-F00-07 [AC-F00-02] GET /api/v1/health returns 200 with status ok and api up", async () => {
    const response = await app.inject({ method: "GET", url: HEALTH });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toStrictEqual({ status: "ok", checks: { api: "up" } });
  });
});

describe("TC-F00-55 [AC-F00-23] the API listens only on this computer by default", () => {
  it("TC-F00-55 [AC-F00-23] .env.example sets API_HOST=127.0.0.1", () => {
    const lines = readFileSync(ENV_EXAMPLE, "utf8")
      .split("\n")
      .map((line) => line.trim());
    expect(lines).toContain("API_HOST=127.0.0.1");
    expect(lines.filter((line) => line.startsWith("API_HOST="))).toHaveLength(1);
  });
});
