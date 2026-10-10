// Tests for the API documentation (F00 T7): /docs and /docs/json exist only in development.
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp } from "../app.ts";
import { loadConfig } from "../config/config.ts";
import { captureLogs, fakeConfig, fakeEnv } from "../test-support/fake-env.ts";

const DOCS_PATHS = ["/docs", "/docs/", "/docs/json", "/docs/static/index.html"];

interface OpenApiDocument {
  openapi: string;
  info: { title: string };
  paths: Record<string, Record<string, unknown>>;
}

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function appFor(nodeEnv: "development" | "test" | "production") {
  app = await buildApp(fakeConfig(nodeEnv), { logDestination: captureLogs().stream });
  await app.ready();
  return app;
}

/**
 * Every (method, path) the app answers, read from Fastify's route tree printout. Each tree line looks
 * like `│   └── json (GET, HEAD)`; its depth comes from where `── ` starts (4 characters per level).
 */
function registeredRoutes(instance: FastifyInstance): { method: string; path: string }[] {
  const stack: string[] = [];
  const routes: { method: string; path: string }[] = [];
  for (const line of instance.printRoutes({ commonPrefix: false }).split("\n")) {
    const match = /── (.*?) \(([A-Z, ]+)\)$/.exec(line);
    if (match === null) continue;
    const depth = line.indexOf("── ") / 4;
    const path = `${depth === 0 ? "" : (stack[depth - 1] ?? "")}${match[1] ?? ""}`.replace("//", "/");
    stack[depth] = path;
    for (const method of (match[2] ?? "").split(",").map((name) => name.trim())) routes.push({ method, path });
  }
  return routes;
}

describe("TC-F00-51 [AC-F00-21] docs are available in development", () => {
  it("TC-F00-51 [AC-F00-21] /docs returns the docs page", async () => {
    const instance = await appFor("development");
    let response = await instance.inject({ method: "GET", url: "/docs" });
    if (response.statusCode >= 300 && response.statusCode < 400) {
      response = await instance.inject({ method: "GET", url: String(response.headers.location) });
    }
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });

  it("TC-F00-51 [AC-F00-21] /docs/json is OpenAPI 3 and lists GET /api/v1/health", async () => {
    const instance = await appFor("development");
    const response = await instance.inject({ method: "GET", url: "/docs/json" });
    expect(response.statusCode).toBe(200);
    const document = response.json<OpenApiDocument>();
    expect(document.openapi).toMatch(/^3\./);
    expect(document.info.title).toBe("MeetApp API");
    expect(document.paths["/api/v1/health"]?.["get"]).toBeDefined();
  });

  it("TC-F00-51 [AC-F00-21] every registered route appears in /docs/json", async () => {
    const instance = await appFor("development");
    const document = (await instance.inject({ method: "GET", url: "/docs/json" })).json<OpenApiDocument>();
    const routes = registeredRoutes(instance).filter(
      ({ method, path }) =>
        !path.startsWith("/docs") && !path.includes("*") && method !== "HEAD" && method !== "OPTIONS",
    );
    expect(routes.length).toBeGreaterThan(0);
    for (const { method, path } of routes) {
      const openApiPath = path.replace(/:(\w+)/g, "{$1}");
      expect(
        document.paths[openApiPath]?.[method.toLowerCase()],
        `${method} ${path} missing from the docs`,
      ).toBeDefined();
    }
  });
});

describe("TC-F00-52 [AC-F00-21] docs are hidden outside development (security)", () => {
  it.each(["production", "test"] as const)(
    "TC-F00-52 [AC-F00-21] with NODE_ENV=%s every docs path is 404",
    async (nodeEnv) => {
      const instance = await appFor(nodeEnv);
      for (const url of DOCS_PATHS) {
        const response = await instance.inject({ method: "GET", url });
        expect(response.statusCode, url).toBe(404);
        expect(response.body, url).not.toContain("swagger");
      }
    },
  );

  it("TC-F00-52 [AC-F00-21] with NODE_ENV unset the backend refuses to start, so no docs are served", () => {
    const env: Record<string, string | undefined> = { ...fakeEnv(), NODE_ENV: undefined };
    expect(() => loadConfig(env)).toThrow(/Missing setting NODE_ENV/);
  });
});
