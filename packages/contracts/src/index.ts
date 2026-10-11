// Shared request/response schemas (Zod) used by the backend and the apps; the source of the OpenAPI file.
export { ERROR_CODES, errorResponseSchema, type ErrorCode, type ErrorResponse } from "./errors.ts";
export { healthCheckStateSchema, healthResponseSchema, type HealthResponse } from "./health.ts";
export { flagSchema, flagsResponseSchema, type Flag } from "./flags.ts";
export { acceptTermsBodySchema, meResponseSchema, type MeResponse } from "./accounts.ts";
