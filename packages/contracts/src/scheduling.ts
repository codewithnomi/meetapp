// Scheduled meetings (F13 design.md "Backend endpoints"): create, update, cancel and answer. Titles and
// descriptions are plain text everywhere (AC-F13-28). "Start not more than 5 minutes ago" depends on the
// clock, so the service and the form check it; everything else is here.
import { z } from "zod";
import { meetingTitleSchema } from "./meetings.ts";

export const REPEAT_KINDS = ["none", "weekdays", "daily", "weekly", "monthly", "yearly"] as const;
export const WEEKDAYS = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export const INVITE_ANSWERS = ["none", "accepted", "tentative", "declined"] as const;
export const SCHEDULE_SCOPES = ["occurrence", "series"] as const;

export const SCHEDULE_LIMITS = {
  description: 2000,
  invitees: 250,
  /** Above this the form notes that a meeting holds 100 people at once (AC-F13-08). */
  callSize: 100,
  /** A start this far in the past is still accepted (AC-F13-10). */
  pastGraceMs: 5 * 60 * 1000,
  cancelMessage: 500,
} as const;

export const inviteeSchema = z.union([z.object({ userId: z.uuid() }), z.object({ email: z.email().max(254) })]);

export const repeatSchema = z
  .object({
    kind: z.enum(REPEAT_KINDS),
    days: z.array(z.enum(WEEKDAYS)).max(7).optional(),
    /** The last day it may repeat; absent = no end date. */
    until: z.iso.datetime().optional(),
  })
  .meta({ id: "Repeat" });

const scheduleFields = {
  title: meetingTitleSchema,
  invitees: z.array(inviteeSchema).max(SCHEDULE_LIMITS.invitees),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime(),
  allDay: z.boolean(),
  /** The organizer's IANA time zone. */
  timeZone: z.string().min(1).max(64),
  repeat: repeatSchema,
  description: z.string().max(SCHEDULE_LIMITS.description),
};

const endAfterStart = (value: { startsAt?: string | undefined; endsAt?: string | undefined }) =>
  !value.startsAt || !value.endsAt || Date.parse(value.endsAt) > Date.parse(value.startsAt);
const END_RULE = { message: "end_before_start", path: ["endsAt"] };

export const scheduleBodySchema = z
  .object(scheduleFields)
  .refine(endAfterStart, END_RULE)
  .meta({ id: "ScheduleMeeting" });

export const scheduleUpdateBodySchema = z
  .object({
    scope: z.enum(SCHEDULE_SCOPES),
    /** Which occurrence, for scope "occurrence". */
    originalStart: z.iso.datetime().optional(),
    ...z.object(scheduleFields).partial().shape,
  })
  .refine(endAfterStart, END_RULE)
  .refine((value) => value.scope === "series" || value.originalStart !== undefined, {
    message: "occurrence_needed",
    path: ["originalStart"],
  })
  .meta({ id: "UpdateSchedule" });

export const scheduleCancelBodySchema = z
  .object({
    scope: z.enum(SCHEDULE_SCOPES),
    originalStart: z.iso.datetime().optional(),
    message: z.string().max(SCHEDULE_LIMITS.cancelMessage).optional(),
  })
  .meta({ id: "CancelSchedule" });

export const scheduleAnswerBodySchema = z
  .object({
    answer: z.enum(INVITE_ANSWERS).exclude(["none"]),
    scope: z.enum(SCHEDULE_SCOPES),
    originalStart: z.iso.datetime().optional(),
  })
  .meta({ id: "AnswerSchedule" });

export type ScheduleBody = z.infer<typeof scheduleBodySchema>;
export type ScheduleUpdateBody = z.infer<typeof scheduleUpdateBodySchema>;
export type InviteAnswer = (typeof INVITE_ANSWERS)[number];
export type RepeatKind = (typeof REPEAT_KINDS)[number];

/** The longest range one calendar read may ask for (a month view is 6 weeks). */
export const CALENDAR_MAX_DAYS = 42;

export const calendarQuerySchema = z
  .object({ from: z.iso.datetime(), to: z.iso.datetime() })
  .refine((q) => Date.parse(q.to) > Date.parse(q.from), { message: "to_before_from", path: ["to"] })
  .refine((q) => Date.parse(q.to) - Date.parse(q.from) <= CALENDAR_MAX_DAYS * 86_400_000, {
    message: "range_too_long",
    path: ["to"],
  });

const personSchema = z.object({ id: z.uuid(), name: z.string() });

export const calendarOccurrenceSchema = z
  .object({
    meetingId: z.uuid(),
    originalStart: z.iso.datetime(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    allDay: z.boolean(),
    title: z.string(),
    organizer: personSchema,
    repeats: z.boolean(),
    /** Null for the organizer when not invited. */
    myAnswer: z.enum(INVITE_ANSWERS).nullable(),
    /** From 5 minutes before the start until the end (AC-F13-03). */
    canJoin: z.boolean(),
  })
  .meta({ id: "CalendarOccurrence" });

export const calendarResponseSchema = z
  .object({ occurrences: z.array(calendarOccurrenceSchema), truncated: z.boolean() })
  .meta({ id: "Calendar" });

export const scheduleDetailsSchema = z
  .object({
    meetingId: z.uuid(),
    title: z.string(),
    description: z.string(),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    allDay: z.boolean(),
    timeZone: z.string(),
    repeat: repeatSchema,
    organizer: personSchema,
    /** For Join and Copy (AC-F13-04). */
    link: z.string(),
    meetingNumber: z.string(),
    passcode: z.string(),
    /** Invited members with their answers; outside invitees' addresses only for organizers (AC-F13-26, 27). */
    invitees: z.array(
      z.object({
        id: z.uuid(),
        member: personSchema.nullable(),
        email: z.string().nullable(),
        answer: z.enum(INVITE_ANSWERS),
      }),
    ),
    /** Outside invitees the caller may not see the address of. */
    hiddenExternal: z.number().int(),
    myAnswer: z.enum(INVITE_ANSWERS).nullable(),
    canManage: z.boolean(),
    cancelled: z.boolean(),
  })
  .meta({ id: "ScheduleDetails" });

export type CalendarOccurrence = z.infer<typeof calendarOccurrenceSchema>;
export type ScheduleDetails = z.infer<typeof scheduleDetailsSchema>;
