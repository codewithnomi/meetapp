// Builds the backend (without starting it), so tests can call it directly with app.inject().
import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import type { DestinationStream } from "pino";
import type { Config } from "./config/config.ts";
import { flagsRoutes } from "./modules/flags/flags.routes.ts";
import { createFlagsService, type FlagsSource } from "./modules/flags/flags.service.ts";
import { healthRoutes } from "./modules/health/health.routes.ts";
import { createHealthService, type HealthCheck } from "./modules/health/health.service.ts";
import { testErrorRoutes } from "./modules/test-support/test-error.routes.ts";
import { registerDocs } from "./plugins/docs.ts";
import { registerErrorHandling } from "./plugins/errors.ts";
import { loggerOptions } from "./plugins/logging.ts";
import { registerMetrics, type MetricsSources } from "./plugins/metrics.ts";

/** Only the app's own pages may call the backend from a browser (AC-F00-23, design.md section 9). */
export const ALLOWED_ORIGINS = ["app://meetapp", "http://127.0.0.1:5173"];

export interface BuildOptions {
  /** Where log lines go (tests capture them); defaults to standard output. */
  logDestination?: DestinationStream;
  logLevel?: string;
  /** One check per service the backend needs (database, cache, …); see server.ts. */
  healthChecks?: Record<string, HealthCheck>;
  /** Where feature flags come from (the database in server.ts). Without it every flag list is empty (= all off). */
  flags?: FlagsSource;
  metrics?: MetricsSources;
}

const NO_FLAGS: FlagsSource = { list: async () => [] };

export async function buildApp(config: Config, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { ...loggerOptions(options.logLevel ?? "info"), stream: options.logDestination ?? process.stdout },
    genReqId: () => randomUUID(),
    logController: new LogController({ requestIdLogLabel: "requestId" }),
    requestIdHeader: false,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  registerErrorHandling(app);
  registerMetrics(app, options.metrics);
  await app.register(cors, { origin: ALLOWED_ORIGINS });
  if (config.NODE_ENV === "development") await registerDocs(app);

  await app.register(healthRoutes, { health: createHealthService(options.healthChecks ?? {}) });
  await app.register(flagsRoutes, { flags: createFlagsService(options.flags ?? NO_FLAGS) });
  if (config.NODE_ENV === "test") await app.register(testErrorRoutes);
  return app;
}
