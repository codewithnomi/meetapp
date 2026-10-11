// The one error format every endpoint uses (docs/engineering/backend.md, AC-F00-20).
import { z } from "zod";

export const ERROR_CODES = [
  "BAD_REQUEST",
  "NOT_FOUND",
  "INTERNAL_ERROR",
  // F01: signing in and terms.
  "UNAUTHORIZED",
  "FORBIDDEN",
  "TERMS_REQUIRED",
  "PASSWORD_WEAK",
  "TOO_MANY_ATTEMPTS",
  "CODE_INVALID",
  "CODE_EXPIRED",
  "PASSWORD_WRONG",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.enum(ERROR_CODES),
      message: z.string(),
      requestId: z.string(),
      details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
      /** With TOO_MANY_ATTEMPTS: seconds until trying again works (also in the Retry-After header). */
      retryAfterSeconds: z.number().int().positive().optional(),
    }),
  })
  .meta({ id: "ErrorResponse", description: "Standard error body. Quote the requestId when reporting a problem." });

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
