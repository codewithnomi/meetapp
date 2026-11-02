// Chat notes such as "Aisha Khan pinned a message" (kind "system"): F03 pins and the chat setting, F14
// group changes, F15 calls (started, ended, missed).
import { z } from "zod";
import { CALL_MEDIA } from "./chat-calls.ts";

/** How a meeting's chat works: during and after, during the call only, or off (F03). */
export const CHAT_MODES = ["on", "in_meeting", "off"] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

export const systemNoteSchema = z.object({
  /** F14 groups: named, added, removed, left, didnt_join (AC-F14-14, 16, 17, 18). F15 calls:
   * call_started, call_ended, call_missed (AC-F15-15). */
  event: z.enum([
    "pinned",
    "chat_mode",
    "named",
    "added",
    "removed",
    "left",
    "didnt_join",
    "call_started",
    "call_ended",
    "call_missed",
  ]),
  name: z.string(),
  mode: z.enum(CHAT_MODES).optional(),
  /** The people added or removed. */
  names: z.array(z.string()).optional(),
  /** The group's new name. */
  groupName: z.string().optional(),
  /** F15: the call the note is about, video or audio, its length, and who was in it. */
  callId: z.uuid().optional(),
  media: z.enum(CALL_MEDIA).optional(),
  seconds: z.number().int().min(0).optional(),
  /** call_missed: the only person who sees the note (AC-F15-15). */
  forUserId: z.uuid().optional(),
});
