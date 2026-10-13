// GET /api/v1/flags: every feature flag and whether it is on (AC-F00-34).
import { flagsResponseSchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FlagsService } from "./flags.service.ts";

export const flagsRoutes: FastifyPluginAsyncZod<{ flags: FlagsService }> = async (app, { flags }) => {
  app.get(
    "/api/v1/flags",
    {
      // Before sign-in too: the apps check health and flags on the sign-in screen.
      config: { access: "public" },
      schema: {
        summary: "Which features are switched on? Keys not listed are off.",
        description:
          "The feature switches from the database, read at most every 10 seconds. The apps ask every 15 seconds, so switching a feature off hides it within 30 seconds. A key that isn't listed counts as off.",
        tags: ["flags"],
        response: { 200: flagsResponseSchema },
      },
    },
    async () => flags.list(),
  );
};
