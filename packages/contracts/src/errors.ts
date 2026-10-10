// The one error format every endpoint uses (docs/engineering/backend.md, AC-F00-20).
import { z } from "zod";

export const ERROR_CODES = ["BAD_REQUEST", "NOT_FOUND", "INTERNAL_ERROR"] as const;

export const errorResponseSchema = z
  .object({
    error: z.object({
      code: z.enum(ERROR_CODES),
      message: z.string(),
      requestId: z.string(),
      details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    }),
  })
  .meta({ id: "ErrorResponse", description: "Standard error body. Quote the requestId when reporting a problem." });

export type ErrorResponse = z.infer<typeof errorResponseSchema>;
