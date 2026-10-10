// One error format for every endpoint (AC-F00-20, backend.md): bad input → 400 with details,
// unknown route → 404, anything unexpected → 500 with only a reference id. Never a stack trace.
import type { ErrorResponse } from "@meetapp/contracts";
import { hasZodFastifySchemaValidationErrors } from "@fastify/type-provider-zod";
import * as Sentry from "@sentry/node";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

function send(reply: FastifyReply, status: number, error: ErrorResponse["error"]): FastifyReply {
  return reply.status(status).send({ error });
}

function handleError(error: FastifyError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const requestId = request.id;
  if (hasZodFastifySchemaValidationErrors(error)) {
    const details = error.validation.map((issue) => ({
      path: issue.instancePath || "/",
      message: issue.message ?? "invalid",
    }));
    return send(reply, 400, { code: "BAD_REQUEST", message: "The request is not valid.", requestId, details });
  }
  if (error.statusCode !== undefined && error.statusCode >= 400 && error.statusCode < 500) {
    request.log.info({ err: error }, "request rejected");
    return send(reply, error.statusCode, { code: "BAD_REQUEST", message: "The request is not valid.", requestId });
  }
  request.log.error({ err: error }, "unexpected error");
  // Reported only when SENTRY_DSN is set; personal data is stripped first (observability/sentry.ts).
  if (Sentry.isInitialized()) Sentry.captureException(error, { tags: { requestId } });
  const message = `Something went wrong. Reference: ${requestId}`;
  return send(reply, 500, { code: "INTERNAL_ERROR", message, requestId });
}

export function registerErrorHandling(app: FastifyInstance): void {
  app.setErrorHandler(handleError);
  app.setNotFoundHandler((request, reply) =>
    send(reply, 404, { code: "NOT_FOUND", message: "Not found.", requestId: request.id }),
  );
}
