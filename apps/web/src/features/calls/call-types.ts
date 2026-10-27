// Shapes the call screens share (F15).
import type { runningCallSchema } from "@meetapp/contracts";
import type { z } from "zod";

export type { CallMedia } from "@meetapp/contracts";
export type RunningCall = z.infer<typeof runningCallSchema>;
