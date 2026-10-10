// Shared request/response schemas (Zod) used by the backend and the apps; the source of the OpenAPI file.
export { ERROR_CODES, errorResponseSchema, type ErrorResponse } from "./errors.ts";
export { healthCheckStateSchema, healthResponseSchema, type HealthResponse } from "./health.ts";
