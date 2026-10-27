// Calls from chats (F15 design.md 3.1–3.9): starting and joining a chat's call, ringing (answer, decline,
// cancel, Add people), the person's running calls and moving a call to this device, and the ringtone.
// The join answer is F02's (`joinedSchema`): a ticket plus the call-server pass, never a lobby.
import { z } from "zod";

/** What the caller chose: shown in the ring; the camera starts on for video, off for audio (AC-F15-01). */
export const CALL_MEDIA = ["video", "audio"] as const;
export type CallMedia = (typeof CALL_MEDIA)[number];

export const CHAT_CALL_LIMITS = {
  /** People in one chat call; also the largest group that rings (AC-F15-04, 14). */
  people: 20,
  ringSeconds: 30,
  /** Starts plus people rung by Add people, per person per minute (AC-F15-22). */
  callsPerMinute: 10,
  ringtones: 5,
} as const;

export const RING_STATES = ["ringing", "accepted", "declined", "missed", "cancelled"] as const;
export const RING_STOP_REASONS = ["accepted", "declined", "cancelled", "missed", "ended"] as const;

export const startCallBodySchema = z.object({ media: z.enum(CALL_MEDIA) }).meta({ id: "StartChatCall" });
export const acceptCallBodySchema = z.object({ media: z.enum(CALL_MEDIA) }).meta({ id: "AcceptChatCall" });
export const ringPeopleBodySchema = z
  .object({ userIds: z.array(z.uuid()).min(1).max(CHAT_CALL_LIMITS.people) })
  .meta({ id: "RingPeople" });
export const transferCallBodySchema = z.object({ fromAttendanceId: z.uuid() }).meta({ id: "TransferCall" });

/** A chat's running call, for **Join** (AC-F15-03, 15); `null` when none runs. */
export const runningCallSchema = z
  .object({
    call: z
      .object({
        callId: z.uuid(),
        media: z.enum(CALL_MEDIA),
        startedAt: z.iso.datetime(),
        startedBy: z.object({ userId: z.uuid(), name: z.string() }),
        people: z.number().int().min(0),
      })
      .nullable(),
  })
  .meta({ id: "RunningChatCall" });

/** The person's running calls and which of their devices are in them (AC-F15-33). */
export const activeCallsSchema = z
  .object({
    calls: z.array(
      z.object({
        callId: z.uuid(),
        conversationId: z.uuid().nullable(),
        meetingId: z.uuid().nullable(),
        title: z.string(),
        media: z.enum(CALL_MEDIA),
        /** This person's seats (one per device), oldest first. */
        seats: z.array(z.object({ attendanceId: z.uuid(), joinedAt: z.iso.datetime() })),
      }),
    ),
  })
  .meta({ id: "ActiveCalls" });

/** Live-line messages for ringing (AC-F15-05–09, 34): every window of the person rings and stops together. */
export const ringMessageSchema = z.object({
  t: z.literal("ring"),
  callId: z.uuid(),
  conversationId: z.uuid(),
  from: z.object({ userId: z.uuid(), name: z.string(), photoUrl: z.string().nullable() }),
  media: z.enum(CALL_MEDIA),
  /** Set for a group call: the group's name. */
  groupName: z.string().nullable(),
  expiresAt: z.iso.datetime(),
});
export const ringStopMessageSchema = z.object({
  t: z.literal("ring_stop"),
  callId: z.uuid(),
  reason: z.enum(RING_STOP_REASONS),
});
export type RingMessage = z.infer<typeof ringMessageSchema>;

/** The person's ringtone (1–5) and its volume, kept on the account (AC-F15-32). */
export const ringtoneSettingsSchema = z.object({
  ringtone: z.number().int().min(1).max(CHAT_CALL_LIMITS.ringtones),
  ringVolume: z.number().int().min(0).max(100),
});
