// Scheduled meetings (F13 design.md "Data stored", D095): an F02 meeting of kind `scheduled` plus its
// schedule. A repeat is one rule (RFC 5545 RRULE) expanded when read; single-occurrence changes, the
// invitees and their answers, and each person's dismissed or snoozed reminders have their own tables.
// External invitees' emails are stored encrypted, with a keyed hash for lookups (as F02's secrets).
import { boolean, index, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { id, moment, timestamps } from "./columns.ts";
import { meetings } from "./meetings.ts";
import { workspaces } from "./workspaces.ts";

export const inviteAnswer = pgEnum("invite_answer", ["none", "accepted", "tentative", "declined"]);
export const inviteEmailStatus = pgEnum("invite_email_status", ["queued", "sent", "failed"]);
export const reminderKind = pgEnum("reminder_kind", ["before", "start"]);

const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });
const meetingRef = () =>
  uuid("meeting_id")
    .notNull()
    .references(() => meetings.id, { onDelete: "cascade" });

export const meetingSchedules = pgTable(
  "meeting_schedules",
  {
    id: id(),
    workspaceId: workspaceRef(),
    meetingId: meetingRef().unique(),
    /** The first occurrence, in UTC. */
    startsAt: moment("starts_at").notNull(),
    endsAt: moment("ends_at").notNull(),
    /** The organizer's IANA time zone: repeats keep their hour there across summer time. */
    timeZone: text("time_zone").notNull(),
    allDay: boolean("all_day").notNull().default(false),
    /** e.g. `FREQ=WEEKLY;BYDAY=MO,WE`; null = does not repeat. */
    rrule: text("rrule"),
    /** Null = no end date. */
    repeatUntil: moment("repeat_until"),
    description: text("description").notNull().default(""),
    /** +1 per change, for the calendar file's SEQUENCE. */
    sequence: integer("sequence").notNull().default(0),
    cancelledAt: moment("cancelled_at"),
    ...timestamps(),
  },
  (table) => [index("meeting_schedules_workspace_id_idx").on(table.workspaceId)],
);

/** One occurrence moved, renamed or cancelled; nulls keep the series' value. */
export const meetingOccurrenceChanges = pgTable(
  "meeting_occurrence_changes",
  {
    id: id(),
    workspaceId: workspaceRef(),
    meetingId: meetingRef(),
    /** Which occurrence: its start under the rule. */
    originalStart: moment("original_start").notNull(),
    cancelled: boolean("cancelled").notNull().default(false),
    startsAt: moment("starts_at"),
    endsAt: moment("ends_at"),
    title: text("title"),
    description: text("description"),
    ...timestamps(),
  },
  (table) => [
    unique("meeting_occurrence_changes_once").on(table.meetingId, table.originalStart),
    index("meeting_occurrence_changes_workspace_id_idx").on(table.workspaceId),
  ],
);

/** A member (user_id) or an external person (encrypted email); at most 250 per meeting (trigger). */
export const meetingInvitees = pgTable(
  "meeting_invitees",
  {
    id: id(),
    workspaceId: workspaceRef(),
    meetingId: meetingRef(),
    userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
    emailEnc: text("email_enc"),
    /** Keyed hash of the lower-cased email. */
    emailLookup: text("email_lookup"),
    keyVersion: integer("key_version"),
    answer: inviteAnswer("answer").notNull().default("none"),
    answeredAt: moment("answered_at"),
    emailStatus: inviteEmailStatus("email_status").notNull().default("queued"),
    ...timestamps(),
  },
  (table) => [
    unique("meeting_invitees_member_once").on(table.meetingId, table.userId),
    unique("meeting_invitees_email_once").on(table.meetingId, table.emailLookup),
    index("meeting_invitees_workspace_id_idx").on(table.workspaceId),
    index("meeting_invitees_user_id_idx").on(table.userId),
  ],
);

/** An answer for one occurrence, overriding the series answer. */
export const meetingInviteeAnswers = pgTable(
  "meeting_invitee_answers",
  {
    id: id(),
    workspaceId: workspaceRef(),
    inviteeId: uuid("invitee_id")
      .notNull()
      .references(() => meetingInvitees.id, { onDelete: "cascade" }),
    originalStart: moment("original_start").notNull(),
    answer: inviteAnswer("answer").notNull(),
    ...timestamps(),
  },
  (table) => [
    unique("meeting_invitee_answers_once").on(table.inviteeId, table.originalStart),
    index("meeting_invitee_answers_workspace_id_idx").on(table.workspaceId),
  ],
);

/** A reminder dismissed (or snoozed) by one person, so it shows once across windows and devices. */
export const reminderDismissals = pgTable(
  "reminder_dismissals",
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    meetingId: meetingRef(),
    originalStart: moment("original_start").notNull(),
    kind: reminderKind("kind").notNull(),
    /** Null = dismissed; otherwise shown again after this moment. */
    snoozedUntil: moment("snoozed_until"),
    ...timestamps(),
  },
  (table) => [
    unique("reminder_dismissals_once").on(table.userId, table.meetingId, table.originalStart, table.kind),
    index("reminder_dismissals_workspace_id_idx").on(table.workspaceId),
  ],
);

export type MeetingSchedule = typeof meetingSchedules.$inferSelect;
export type MeetingInvitee = typeof meetingInvitees.$inferSelect;
