// GET /api/v1/health: 200 when every part answers, 503 naming each part that is down (AC-F00-02).
import { healthResponseSchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { HealthService } from "./health.service.ts";

export const healthRoutes: FastifyPluginAsyncZod<{ health: HealthService }> = async (app, { health }) => {
  app.get(
    "/api/v1/health",
    {
      // Before sign-in too: the apps check health and flags on the sign-in screen.
      config: { access: "public" },
      schema: {
        summary: "Is the backend and every service it needs working?",
        description:
          "Checks the database, cache, call server and file storage. Answers 200 with `ok` for each part when all work, or 503 with `down` for each part that doesn't. Used by the status page and the tests; needs no login.",
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
