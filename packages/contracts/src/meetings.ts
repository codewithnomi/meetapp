// Meetings (F02 design.md sections 3 and 6): making a meeting, its details and options, and the
// workspace's guest switch. Titles and names are plain text everywhere (AC-F02-51).
import { z } from "zod";

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
export const workspaceSettingsBodySchema = z.object({ allowGuests: z.boolean() }).meta({ id: "WorkspaceSettings" });
