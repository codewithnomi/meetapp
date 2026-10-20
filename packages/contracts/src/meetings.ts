// Meetings (F02 design.md sections 3 and 6): making a meeting, its details and options, and the
// workspace's guest switch. Titles and names are plain text everywhere (AC-F02-51).
import { z } from "zod";
import { CHAT_MODES } from "./chat.ts";

export const MEETING_KINDS = ["meet_now", "link"] as const;
/** Who skips the lobby, and who presents (AC-F02-16, AC-F02-36). */
export const MEETING_AUDIENCES = ["everyone", "workspace", "organizers"] as const;
export const MAX_CO_ORGANIZERS = 10;

/** 1–100 characters after trimming (AC-F02-02). */
export const meetingTitleSchema = z.string().trim().min(1).max(100);

export const createMeetingBodySchema = z
  .object({ kind: z.enum(MEETING_KINDS), title: meetingTitleSchema.optional() })
  .meta({ id: "CreateMeeting" });

export const meetingParamsSchema = z.object({ meetingId: z.string() });

export const meetingOptionsSchema = z
  .object({
    lobbyBypass: z.enum(MEETING_AUDIENCES),
    whoCanPresent: z.enum(MEETING_AUDIENCES),
    allowAttendeeMic: z.boolean(),
    allowAttendeeCamera: z.boolean(),
    coOrganizerIds: z.array(z.uuid()).max(MAX_CO_ORGANIZERS),
    /** Meeting chat: on, only during the call, or off (AC-F03-35–38). */
    chatMode: z.enum(CHAT_MODES),
  })
  .meta({ id: "MeetingOptions" });

/** What Meeting info shows (AC-F02-01, AC-F02-02). */
export const meetingDetailsSchema = z
  .object({
    id: z.uuid(),
    workspaceId: z.uuid(),
    kind: z.enum(MEETING_KINDS),
    title: z.string(),
    link: z.string(),
    meetingNumber: z.string(),
    passcode: z.string(),
    organizer: z.object({ id: z.uuid(), name: z.string() }),
    options: meetingOptionsSchema,
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: "MeetingDetails" });

export type MeetingDetails = z.infer<typeof meetingDetailsSchema>;

/** The new meeting, plus the creator's lookup token so Meet now goes straight to the pre-join. */
export const meetingCreatedSchema = meetingDetailsSchema
  .extend({ lookupToken: z.string() })
  .meta({ id: "MeetingCreated" });

/** Any subset of the title and options (organizer and co-organizers; co-organizers: organizer only). */
export const updateMeetingBodySchema = meetingOptionsSchema
  .partial()
  .extend({ title: meetingTitleSchema.optional() })
  .meta({ id: "UpdateMeeting" });

/** The workspace's guest switch (AC-F02-40): owner and admins. */
/** Workspace settings: the guest switch (AC-F02-40) and the GIF switch (AC-F03-27); send either or both. */
export const workspaceSettingsBodySchema = z
  .object({ allowGuests: z.boolean().optional(), allowGifs: z.boolean().optional() })
  .refine((body) => body.allowGuests !== undefined || body.allowGifs !== undefined, "nothing to change")
  .meta({ id: "WorkspaceSettings" });
export type WorkspaceSettings = z.infer<typeof workspaceSettingsBodySchema>;

/** The app's device key (32 random bytes, base64url): guests' "same app" (design section 5). */
export const deviceKeySchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

/**
 * Find a meeting by its link, or by its ID and passcode (AC-F02-08). Anything that isn't a match,
 * malformed input included, gets the same 404 MEETING_NOT_FOUND, so the fields are only length-checked.
 */
export const meetingLookupBodySchema = z
  .object({
    link: z.string().max(2048).optional(),
    meetingNumber: z.string().max(64).optional(),
    passcode: z.string().max(64).optional(),
    deviceKey: deviceKeySchema.optional(),
  })
  .meta({ id: "MeetingLookup" });

export const PARTICIPANT_GROUPS = ["member", "external", "guest"] as const;

/** Only the title, the joiner's group and a 15-minute token for joining: nothing about who is inside. */
export const meetingLookupResponseSchema = z
  .object({ title: z.string(), group: z.enum(PARTICIPANT_GROUPS), lookupToken: z.string() })
  .meta({ id: "MeetingFound" });
