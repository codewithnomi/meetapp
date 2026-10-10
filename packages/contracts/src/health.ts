// GET /api/v1/health: is the backend and each service it needs working (AC-F00-02; checks arrive in T8).
import { z } from "zod";

export const healthCheckStateSchema = z.enum(["ok", "down"]);

export const healthResponseSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    checks: z.record(z.string(), healthCheckStateSchema),
  })
  .meta({ id: "HealthResponse", description: "Overall status plus up/down for each service the backend uses." });

export type HealthResponse = z.infer<typeof healthResponseSchema>;
