// GET /metrics for Prometheus (design.md section 9): requests, response times, errors, process CPU and
// memory, database pool and cache status. Not listed in the API docs.
import type { FastifyInstance } from "fastify";
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export interface MetricsSources {
  /** Database pool sizes; read when Prometheus scrapes. */
  databasePool?: () => { total: number; idle: number; waiting: number };
  /** True when the cache connection is ready. */
  cacheReady?: () => boolean;
}

function addSourceGauges(registry: Registry, sources: MetricsSources): void {
  const { databasePool, cacheReady } = sources;
  if (databasePool) {
    new Gauge({
      name: "meetapp_db_pool_connections",
      help: "Database connections by state",
      labelNames: ["state"],
      registers: [registry],
      collect() {
        const pool = databasePool();
        this.set({ state: "total" }, pool.total);
        this.set({ state: "idle" }, pool.idle);
        this.set({ state: "waiting" }, pool.waiting);
      },
    });
  }
  if (cacheReady) {
    new Gauge({
      name: "meetapp_cache_up",
      help: "1 when the cache (Redis) connection is ready",
      registers: [registry],
      collect() {
        this.set(cacheReady() ? 1 : 0);
      },
    });
  }
}

export function registerMetrics(app: FastifyInstance, sources: MetricsSources = {}): void {
  const registry = new Registry();
  collectDefaultMetrics({ register: registry, prefix: "meetapp_" });
  addSourceGauges(registry, sources);
  const labelNames = ["method", "route", "status"];
  const requests = new Counter({
    name: "meetapp_http_requests_total",
    help: "HTTP requests",
    labelNames,
    registers: [registry],
  });
  const duration = new Histogram({
    name: "meetapp_http_request_duration_seconds",
    help: "HTTP response time",
    labelNames,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  app.addHook("onResponse", async (request, reply) => {
    // The route pattern (e.g. /api/v1/flags), never the raw URL, so ids in paths can't create endless series.
    const labels = {
      method: request.method,
      route: request.routeOptions.url ?? "unknown",
      status: String(reply.statusCode),
    };
    requests.inc(labels);
    duration.observe(labels, reply.elapsedTime / 1000);
  });
  app.get("/metrics", { schema: { hide: true } }, async (_request, reply) =>
    reply.type(registry.contentType).send(await registry.metrics()),
  );
}
