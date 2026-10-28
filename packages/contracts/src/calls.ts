// Joining a meeting, the lobby and the call (F02 design.md sections 3.3–3.5 and 6). In-call and lobby
// routes are authenticated with the meeting ticket in the X-Meeting-Ticket header.
import { z } from "zod";
import { PARTICIPANT_GROUPS, deviceKeySchema } from "./meetings.ts";

export const ATTENDANCE_STATUSES = [
  "waiting",
  "admitted",
  "in_call",
  "left",
  "denied",
  "removed",
  "timed_out",
  "turned_away",
] as const;
export const CALL_ROLES = ["organizer", "co_organizer", "presenter", "attendee"] as const;

/** A guest's name is checked on the server (1–60 characters after cleaning, AC-F02-11). */
export const joinMeetingBodySchema = z
  .object({
    lookupToken: z.string().max(2048),
    guestName: z.string().max(200).optional(),
    deviceKey: deviceKeySchema,
  })
  .meta({ id: "JoinMeeting" });

/** What the app needs to connect to the call server (only when the person may be in the call). */
export const callAccessSchema = z
  .object({
    callId: z.uuid(),
    serverUrl: z.string(),
    pass: z.string(),
    role: z.enum(CALL_ROLES),
  })
  .meta({ id: "CallAccess" });

export const attendanceSchema = z
  .object({
    attendanceId: z.uuid(),
    status: z.enum(ATTENDANCE_STATUSES),
    title: z.string(),
    group: z.enum(PARTICIPANT_GROUPS),
    call: callAccessSchema.optional(),
    /** Who removed the person (AC-F02-35), shown in "You were removed". */
    actedByName: z.string().optional(),
    /** Why a person left: their own Leave, a dropped connection, removal, or the end of the meeting. */
    leftReason: z.enum(["leave", "dropped", "removed", "ended", "locked", "guests_off"]).optional(),
  })
  .meta({ id: "Attendance" });

/** The join answer also carries the meeting ticket, kept only in the app's memory. */
export const joinedSchema = attendanceSchema.extend({ ticket: z.string() }).meta({ id: "Joined" });

/** F15: the start answer, F02's join answer, and whether anyone is being rung. False when a call was already
 * running (it was joined) or nobody rings (a group of more than 20): the app goes straight into the call.
 */
export const startedCallSchema = joinedSchema.extend({ ringing: z.boolean() }).meta({ id: "StartedChatCall" });

export const attendanceParamsSchema = z.object({ attendanceId: z.string() });
export const callParamsSchema = z.object({ callId: z.string() });
export const meetingTicketHeadersSchema = z.object({ "x-meeting-ticket": z.string().max(200).optional() });

export const lobbyResponseSchema = z
  .object({
    waiting: z.array(
      z.object({
        attendanceId: z.uuid(),
        name: z.string(),
        group: z.enum(PARTICIPANT_GROUPS),
        waitingSince: z.iso.datetime(),
      }),
    ),
  })
  .meta({ id: "Lobby" });

export const lobbyDecisionBodySchema = z
  .object({ attendanceIds: z.array(z.uuid()).max(100).optional(), all: z.boolean().optional() })
  .meta({ id: "LobbyDecision" });

/** How many were let in (or denied), and how many didn't fit (AC-F02-42). */
export const lobbyDecisionResponseSchema = z
  .object({ decided: z.number().int(), didNotFit: z.number().int() })
  .meta({ id: "LobbyDecisionResult" });

/** A meeting's record (AC-F02-41): for the people who took part, the organizer and co-organizers. */
export const meetingRecordSchema = z
  .object({
    title: z.string(),
    workspaceId: z.uuid(),
    organizer: z.object({ id: z.uuid(), name: z.string() }),
    calls: z.array(
      z.object({
        callId: z.uuid(),
        startedAt: z.iso.datetime(),
        endedAt: z.iso.datetime().nullable(),
        endReason: z.enum(["last_left", "ended", "time_limit"]).nullable(),
        participants: z.array(
          z.object({
            name: z.string(),
            group: z.enum(PARTICIPANT_GROUPS),
            joinedAt: z.iso.datetime().nullable(),
            leftAt: z.iso.datetime().nullable(),
          }),
        ),
      }),
    ),
  })
  .meta({ id: "MeetingRecord" });

export const participantParamsSchema = z.object({ callId: z.string(), attendanceId: z.string() });
export const handBodySchema = z.object({ raised: z.boolean() }).meta({ id: "Hand" });
export const roleBodySchema = z.object({ role: z.enum(["presenter", "attendee"]) }).meta({ id: "ParticipantRole" });
export const lockBodySchema = z.object({ locked: z.boolean() }).meta({ id: "CallLock" });
