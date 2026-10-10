// GET /api/v1/health. In T7 it only says the backend itself is up; T8 adds the database, cache,
// call server and storage checks through a health service.
import { healthResponseSchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";

export const healthRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/api/v1/health",
    { schema: { summary: "Is the backend working?", tags: ["health"], response: { 200: healthResponseSchema } } },
    async () => ({ status: "ok" as const, checks: { api: "up" as const } }),
  );
};
