// GET /api/v1/flags: every feature flag and whether it is on (AC-F00-34).
import { flagsResponseSchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FlagsService } from "./flags.service.ts";

export const flagsRoutes: FastifyPluginAsyncZod<{ flags: FlagsService }> = async (app, { flags }) => {
  app.get(
    "/api/v1/flags",
    {
      schema: {
        summary: "Which features are switched on? Keys not listed are off.",
        tags: ["flags"],
        response: { 200: flagsResponseSchema },
      },
    },
    async () => flags.list(),
  );
};
