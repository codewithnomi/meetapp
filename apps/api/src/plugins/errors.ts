// One error format for every endpoint (AC-F00-20, backend.md): bad input → 400 with details,
// unknown route → 404, anything unexpected → 500 with only a reference id. Never a stack trace.
import type { ErrorCode, ErrorResponse } from "@meetapp/contracts";
import { hasZodFastifySchemaValidationErrors } from "@fastify/type-provider-zod";
import * as Sentry from "@sentry/node";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/** An expected refusal with its own status and code (401 not signed in, 403 not allowed, …). */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(status: number, code: ErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** 429: too many tries; the message says how long to wait (AC-F01-13). */
export function tooManyAttempts(retryAfterSeconds: number): AppError {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  const message = `Too many attempts, try again in ${String(minutes)} minute${minutes === 1 ? "" : "s"}.`;
  return new AppError(429, "TOO_MANY_ATTEMPTS", message, retryAfterSeconds);
}

function send(reply: FastifyReply, status: number, error: ErrorResponse["error"]): FastifyReply {
  return reply.status(status).send({ error });
}

function handleError(error: FastifyError | AppError, request: FastifyRequest, reply: FastifyReply): FastifyReply {
  const requestId = request.id;
  if (error instanceof AppError) {
    const { retryAfterSeconds } = error;
    if (retryAfterSeconds === undefined) {
      return send(reply, error.status, { code: error.code, message: error.message, requestId });
    }
    reply.header("retry-after", String(retryAfterSeconds));
    return send(reply, error.status, { code: error.code, message: error.message, requestId, retryAfterSeconds });
  }
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
