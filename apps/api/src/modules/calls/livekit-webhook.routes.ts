// Reports from the call server (F02 design.md sections 3.5–3.7). Only LiveKit can send them: each is
// signed with the API key and carries a hash of its body, both checked before anything changes; anything
// else is 401. The body is read as raw text (LiveKit sends application/webhook+json) and never logged.
import type { FastifyPluginAsync } from "fastify";
import { AppError } from "../../plugins/errors.ts";
import type { WebhookService } from "./webhook.service.ts";

const ROUTE = {
  config: { access: "public" as const },
  schema: {
    summary: "Reports from the call server",
    description: "LiveKit only (signed with the API key, body hash checked). 401 otherwise.",
    tags: ["calls"],
    hide: true,
  },
};

export const liveKitWebhookRoutes: FastifyPluginAsync<{ webhooks: WebhookService }> = async (app, { webhooks }) => {
  app.addContentTypeParser("application/webhook+json", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });
  app.post("/api/v1/livekit/webhook", ROUTE, async (request, reply) => {
    const body = typeof request.body === "string" ? request.body : "";
    try {
      await webhooks.receive(body, request.headers.authorization);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, "UNAUTHORIZED", "Not a report from the call server.");
    }
    return reply.status(200).send();
  });
};
