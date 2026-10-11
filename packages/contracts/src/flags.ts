// GET /api/v1/flags: which features are switched on (AC-F00-34). A key not in the list means "off".
import { z } from "zod";

export const flagSchema = z.object({ key: z.string(), enabled: z.boolean() });

export const flagsResponseSchema = z
  .array(flagSchema)
  .meta({ id: "FlagsResponse", description: "Every feature flag. Unknown keys are off." });

export type Flag = z.infer<typeof flagSchema>;
