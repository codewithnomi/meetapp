// A route that always fails, used by the error-handling tests (TC-F00-49, 50).
// app.ts registers it ONLY when NODE_ENV is "test", so it never exists in development or production.
import type { FastifyPluginAsync } from "fastify";

export const testErrorRoutes: FastifyPluginAsync = async (app) => {
  app.post("/__test__/error", async () => {
    throw new Error("db password=hunter2 for alice@example.com");
  });
};
