// Builds the backend (without starting it), so tests can call it directly with app.inject().
import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import type { DestinationStream } from "pino";
import type { Config } from "./config/config.ts";
import { healthRoutes } from "./modules/health/health.routes.ts";
import { createHealthService, type HealthCheck } from "./modules/health/health.service.ts";
import { testErrorRoutes } from "./modules/test-support/test-error.routes.ts";
import { registerDocs } from "./plugins/docs.ts";
import { registerErrorHandling } from "./plugins/errors.ts";
import { loggerOptions } from "./plugins/logging.ts";

/** Only the app's own pages may call the backend from a browser (AC-F00-23, design.md section 9). */
export const ALLOWED_ORIGINS = ["app://meetapp", "http://127.0.0.1:5173"];

export interface BuildOptions {
  /** Where log lines go (tests capture them); defaults to standard output. */
  logDestination?: DestinationStream;
  logLevel?: string;
  /** One check per service the backend needs (database, cache, …); see server.ts. */
  healthChecks?: Record<string, HealthCheck>;
}

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
  await app.register(cors, { origin: ALLOWED_ORIGINS });
  if (config.NODE_ENV === "development") await registerDocs(app);

  await app.register(healthRoutes, { health: createHealthService(options.healthChecks ?? {}) });
  if (config.NODE_ENV === "test") await app.register(testErrorRoutes);
  return app;
}
