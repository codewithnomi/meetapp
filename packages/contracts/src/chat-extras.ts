// Meeting chat, continued (F03 design.md sections 3.7, 6 and 7): polls, files and GIF settings.
// Split from chat.ts only to keep each file short; chat.ts re-exports everything here.
import { z } from "zod";

/** Poll limits (AC-F03-21). */
export const POLL_LIMITS = { question: 200, option: 100, minOptions: 2, maxOptions: 10 } as const;

export const createPollBodySchema = z
  .object({
    clientId: z.uuid(),
    question: z.string().trim().min(1).max(POLL_LIMITS.question),
    options: z
      .array(z.string().trim().min(1).max(POLL_LIMITS.option))
      .min(POLL_LIMITS.minOptions)
      .max(POLL_LIMITS.maxOptions),
    multiple: z.boolean(),
    anonymous: z.boolean(),
  })
  .meta({ id: "CreatePoll" });

export const pollParamsSchema = z.object({ callId: z.string(), pollId: z.string() });
export const voteBodySchema = z
  .object({ optionIds: z.array(z.uuid()).min(1).max(POLL_LIMITS.maxOptions) })
  .meta({ id: "PollVote" });

/**
 * A poll as one person may see it. Counts come only to those who voted, the creator, the organizer and
 * co-organizers (owner, 2026-10-20, as in Teams); names only for polls that aren't anonymous.
 */
export const pollSchema = z
  .object({
    id: z.uuid(),
    messageId: z.uuid(),
    question: z.string(),
    multiple: z.boolean(),
    anonymous: z.boolean(),
    closed: z.boolean(),
    version: z.number().int(),
    creatorName: z.string(),
    yourChoice: z.array(z.uuid()),
    results: z
      .object({
        voters: z.number().int(),
        options: z.array(
          z.object({ id: z.uuid(), votes: z.number().int(), percent: z.number().int(), names: z.array(z.string()) }),
        ),
      })
      .nullable(),
    options: z.array(z.object({ id: z.uuid(), text: z.string() })),
  })
  .meta({ id: "Poll" });
export type PollView = z.infer<typeof pollSchema>;

export const attachmentParamsSchema = z.object({ callId: z.string(), attachmentId: z.string() });
export const attachmentLinkQuerySchema = z.object({ preview: z.enum(["true", "false"]).default("false") });
export const uploadedSchema = z
  .object({ id: z.uuid(), fileName: z.string(), mediaType: z.string(), sizeBytes: z.number().int() })
  .meta({ id: "ChatUpload" });
/** A download link to our own backend, valid 5 minutes (AC-F03-31). */
export const attachmentLinkSchema = z
  .object({ url: z.string(), expiresAt: z.iso.datetime({ offset: true }) })
  .meta({ id: "ChatFileLink" });
export const fileTokenParamsSchema = z.object({ token: z.string().max(300) });

/** What the app needs to search KLIPY itself (design section 7). */
export const gifSettingsSchema = z
  .object({
    /** False when no GIF key is set: the picker says GIFs aren't available. */
    available: z.boolean(),
    apiUrl: z.string(),
    key: z.string(),
    /** Random per person and meeting, so KLIPY can't follow one person across meetings. */
    customerId: z.string(),
  })
  .meta({ id: "GifSettings" });

/** After-meeting routes take the meeting instead of the call (AC-F03-42). */
export const meetingChatParamsSchema = z.object({ meetingId: z.string() });
export const meetingChatMessageParamsSchema = z.object({ meetingId: z.string(), messageId: z.string() });
export const meetingPollParamsSchema = z.object({ meetingId: z.string(), pollId: z.string() });

/** Past meetings whose chat the person may open (AC-F03-42). */
export const recentMeetingChatsSchema = z
  .object({
    meetings: z.array(
      z.object({
        id: z.uuid(),
        workspaceId: z.uuid(),
        title: z.string(),
        lastJoinedAt: z.iso.datetime(),
        /** Organizer or co-organizer: may still remove messages (AC-F03-11). */
        organizer: z.boolean(),
      }),
    ),
  })
  .meta({ id: "RecentMeetingChats" });
export type RecentMeetingChats = z.infer<typeof recentMeetingChatsSchema>;

export const meetingAttachmentParamsSchema = z.object({ meetingId: z.string(), attachmentId: z.string() });
