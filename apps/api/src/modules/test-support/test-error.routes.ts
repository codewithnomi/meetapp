// Test-only routes. app.ts registers them ONLY when NODE_ENV is "test", so they never exist in
// development or production: one that always fails (error handling, TC-F00-49, 50) and one ordinary
// signed-in route (session check and terms gate, TC-F01-16).
import type { FastifyPluginAsync } from "fastify";

export const testErrorRoutes: FastifyPluginAsync = async (app) => {
  app.post("/__test__/error", async () => {
    throw new Error("db password=hunter2 for alice@example.com");
  });
  // An ordinary /api/v1 route: needs a signed-in person who accepted the terms.
  app.get("/api/v1/__test__/whoami", async (request) => ({ id: request.user?.id }));
};
