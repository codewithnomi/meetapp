// Meeting chat news (F03 design.md 3.4): what the server sends on `meetapp.chat`, and the missed news an
// app asks for after a reconnect.
import { z } from "zod";
import { chatMessageSchema } from "./chat.ts";

/** News delivered on `meetapp.chat` and kept a day for catching up (design 3.4). */
export const chatEventSchema = z
  .object({
    seq: z.number().int().positive(),
    type: z.string(),
    id: z.uuid().optional(),
    message: chatMessageSchema.optional(),
    /** With poll_changed: which poll, and its new version (no results: they depend on who asks). */
    pollId: z.uuid().optional(),
    version: z.number().int().optional(),
    /** With pins_changed: the message is pinned now (true) or not (false). */
    pinned: z.boolean().optional(),
  })
  .meta({ id: "ChatEvent" });
export type ChatEvent = z.infer<typeof chatEventSchema>;

export const eventsPageSchema = z
  .object({
    events: z.array(chatEventSchema),
    /** True when events older than `after` were already cleaned: reload the pins and visible pages. */
    gap: z.boolean(),
  })
  .meta({ id: "ChatEventsPage" });
