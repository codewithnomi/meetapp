// Tests for GET /metrics (F00 T9, design.md section 9, AC-F00-42 via TC-F00-94): request counts labelled by route
// pattern, database pool and cache gauges, default process metrics, and hidden from the API docs.
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, type BuildOptions } from "../app.ts";
import { captureLogs, fakeConfig } from "../test-support/fake-env.ts";

let app: FastifyInstance | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function appWith(metrics?: BuildOptions["metrics"], nodeEnv: "test" | "development" = "test") {
  app = await buildApp(fakeConfig(nodeEnv), {
    logDestination: captureLogs().stream,
    ...(metrics === undefined ? {} : { metrics }),
  });
  await app.ready();
  return app;
}

async function scrape(instance: FastifyInstance): Promise<string> {
  const response = await instance.inject({ method: "GET", url: "/metrics" });
  expect(response.statusCode).toBe(200);
  return response.body;
}

/** Every sample line of a metric (no # HELP / # TYPE lines). */
function samples(text: string, name: string): string[] {
  return text.split("\n").filter((line) => line.startsWith(`${name}{`) || line.startsWith(`${name} `));
}

describe("TC-F00-94 [AC-F00-42] GET /metrics", () => {
  it("TC-F00-94 [AC-F00-42] answers 200 in the Prometheus text format", async () => {
    const instance = await appWith();
    const response = await instance.inject({ method: "GET", url: "/metrics" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/plain");
  });

  it("TC-F00-94 [AC-F00-42] counts a health request under its route pattern", async () => {
    const instance = await appWith();
    await instance.inject({ method: "GET", url: "/api/v1/health" });
    const lines = samples(await scrape(instance), "meetapp_http_requests_total");
    const health = lines.find((line) => line.includes('route="/api/v1/health"'));
    expect(health, lines.join("\n")).toBeDefined();
    expect(health).toContain('method="GET"');
    expect(health).toContain('status="200"');
    expect(health).toMatch(/ 1$/);
  });

  it("TC-F00-94 [AC-F00-42] a query string still labels the pattern, not the raw URL", async () => {
    const instance = await appWith();
    await instance.inject({ method: "GET", url: "/api/v1/health?x=1" });
    await instance.inject({ method: "GET", url: "/api/v1/health" });
    const text = await scrape(instance);
    expect(text).not.toContain("x=1");
    const health = samples(text, "meetapp_http_requests_total").find((line) => line.includes('route="/api/v1/health"'));
    expect(health).toMatch(/ 2$/);
  });

  it("TC-F00-94 [AC-F00-42] an unknown URL is never recorded with its raw path", async () => {
    const instance = await appWith();
    const notFound = await instance.inject({ method: "GET", url: "/nope/123" });
    expect(notFound.statusCode).toBe(404);
    const text = await scrape(instance);
    expect(text).not.toContain("/nope");
    expect(text).not.toContain('123"');
  });

  it("TC-F00-94 [AC-F00-42] records response times in a histogram", async () => {
    const instance = await appWith();
    await instance.inject({ method: "GET", url: "/api/v1/health" });
    const text = await scrape(instance);
    expect(samples(text, "meetapp_http_request_duration_seconds_count").join("\n")).toContain('route="/api/v1/health"');
  });

  it("TC-F00-94 [AC-F00-42] includes default process metrics (CPU, memory)", async () => {
    const text = await scrape(await appWith());
    expect(text).toContain("meetapp_process_cpu_seconds_total");
    expect(text).toContain("meetapp_process_resident_memory_bytes");
  });

  it("TC-F00-94 [AC-F00-42] without sources there are no pool or cache gauges", async () => {
    const text = await scrape(await appWith());
    expect(text).not.toContain("meetapp_db_pool_connections");
    expect(text).not.toContain("meetapp_cache_up");
  });

  it("TC-F00-94 [AC-F00-42] the pool and cache gauges reflect their sources at scrape time", async () => {
    let ready = true;
    const instance = await appWith({
      databasePool: () => ({ total: 7, idle: 4, waiting: 2 }),
      cacheReady: () => ready,
    });
    let text = await scrape(instance);
    expect(text).toContain('meetapp_db_pool_connections{state="total"} 7');
    expect(text).toContain('meetapp_db_pool_connections{state="idle"} 4');
    expect(text).toContain('meetapp_db_pool_connections{state="waiting"} 2');
    expect(samples(text, "meetapp_cache_up")).toEqual(["meetapp_cache_up 1"]);
    ready = false;
    text = await scrape(instance);
    expect(samples(text, "meetapp_cache_up")).toEqual(["meetapp_cache_up 0"]);
  });

  it("TC-F00-94 [AC-F00-42] each app has its own registry (no shared counts between apps)", async () => {
    const first = await appWith();
    await first.inject({ method: "GET", url: "/api/v1/health" });
    await first.close();
    const second = await appWith();
    const lines = samples(await scrape(second), "meetapp_http_requests_total");
    expect(lines.some((line) => line.includes('route="/api/v1/health"'))).toBe(false);
  });

  it("TC-F00-94 [AC-F00-42] /metrics is not listed in /docs/json", async () => {
    const instance = await appWith(undefined, "development");
    const document = (await instance.inject({ method: "GET", url: "/docs/json" })).json<{
      paths: Record<string, unknown>;
    }>();
    expect(Object.keys(document.paths)).not.toContain("/metrics");
  });
});
