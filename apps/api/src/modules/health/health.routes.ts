// GET /api/v1/health: 200 when every part answers, 503 naming each part that is down (AC-F00-02).
import { healthResponseSchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { HealthService } from "./health.service.ts";

export const healthRoutes: FastifyPluginAsyncZod<{ health: HealthService }> = async (app, { health }) => {
  app.get(
    "/api/v1/health",
    {
      schema: {
        summary: "Is the backend and every service it needs working?",
        tags: ["health"],
        response: { 200: healthResponseSchema, 503: healthResponseSchema },
      },
    },
    async (_request, reply) => {
      const result = await health.check();
      return reply.status(result.status === "ok" ? 200 : 503).send(result);
    },
  );
};
