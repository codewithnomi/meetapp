// Scheduled meetings: database access only (F13 design.md "Data stored", D095). A new scheduled meeting is
// written in one transaction (the F02 meeting, its schedule, its invitees). Every read filters by the
// meeting's workspace and by who asks (S2); a meeting whose organizer left its workspace, or that expired,
// is never listed (AC-F13-29, D093).
import {
  meetingCoOrganizers,
  meetingInvitees,
  meetingOccurrenceChanges,
  meetings,
  meetingSchedules,
  user,
  workspaceMembers,
  type Executor,
  type MeetingInvitee,
  type MeetingSchedule,
} from "@meetapp/db";
import { aliasedTable, and, eq, exists, gt, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { createMeetingsRepository, type NewMeeting } from "../meetings/meetings.repository.ts";

export type { MeetingInvitee, MeetingSchedule } from "@meetapp/db";

export type NewSchedule = Omit<
  typeof meetingSchedules.$inferInsert,
  "id" | "meetingId" | "workspaceId" | "createdAt" | "updatedAt"
>;
export type NewInvitee = { userId: string } | { emailEnc: string; emailLookup: string; keyVersion: number };

/** One schedule as the calendar needs it. */
export interface CalendarRow {
  schedule: MeetingSchedule;
  title: string;
  organizerId: string;
  organizerName: string;
  /** The caller's own answer; null when not invited (an organizer who didn't invite themselves). */
  myAnswer: MeetingInvitee["answer"] | null;
}

export interface OccurrenceChangeRow {
  meetingId: string;
  originalStart: Date;
  cancelled: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  title: string | null;
}

export interface InviteeRow {
  id: string;
  userId: string | null;
  name: string | null;
  emailEnc: string | null;
  keyVersion: number | null;
  answer: MeetingInvitee["answer"];
}

const organizerMember = aliasedTable(workspaceMembers, "organizer_member");

/** The caller organizes, co-organizes or is invited as a member. */
const involves = (userId: string) =>
  or(
    eq(meetings.organizerId, userId),
    exists(
      sql`(select 1 from ${meetingCoOrganizers} where ${meetingCoOrganizers.meetingId} = ${meetings.id} and ${meetingCoOrganizers.userId} = ${userId})`,
    ),
    exists(
      sql`(select 1 from ${meetingInvitees} where ${meetingInvitees.meetingId} = ${meetings.id} and ${meetingInvitees.userId} = ${userId})`,
    ),
  );

export interface CalendarRange {
  from: Date;
  to: Date;
  now: Date;
}

/** Schedules in this workspace the caller is part of that may have an occurrence in [from, to). */
async function calendarRows(
  executor: Executor,
  userId: string,
  workspaceId: string,
  range: CalendarRange,
): Promise<CalendarRow[]> {
  const mine = await executor
    .select({ answer: meetingInvitees.answer, meetingId: meetingInvitees.meetingId })
    .from(meetingInvitees)
    .where(and(eq(meetingInvitees.workspaceId, workspaceId), eq(meetingInvitees.userId, userId)));
  const answers = new Map(mine.map((row) => [row.meetingId, row.answer]));
  const rows = await executor
    .select({
      schedule: meetingSchedules,
      title: meetings.title,
      organizerId: meetings.organizerId,
      organizerName: user.name,
    })
    .from(meetingSchedules)
    .innerJoin(meetings, eq(meetings.id, meetingSchedules.meetingId))
    .innerJoin(user, eq(user.id, meetings.organizerId))
    .innerJoin(
      organizerMember,
      and(eq(organizerMember.workspaceId, meetings.workspaceId), eq(organizerMember.userId, meetings.organizerId)),
    )
    .where(
      and(
        eq(meetingSchedules.workspaceId, workspaceId),
        eq(meetings.workspaceId, workspaceId),
        isNull(meetingSchedules.cancelledAt),
        gt(meetings.expiresAt, range.now),
        lt(meetingSchedules.startsAt, range.to),
        or(
          gt(meetingSchedules.endsAt, range.from),
          and(
            isNotNull(meetingSchedules.rrule),
            or(isNull(meetingSchedules.repeatUntil), gt(meetingSchedules.repeatUntil, range.from)),
          ),
        ),
        involves(userId),
      ),
    );
  return rows.map((row): CalendarRow => ({ ...row, myAnswer: answers.get(row.schedule.meetingId) ?? null }));
}

const inviteesOf = (executor: Executor, meetingId: string): Promise<InviteeRow[]> =>
  executor
    .select({
      id: meetingInvitees.id,
      userId: meetingInvitees.userId,
      name: user.name,
      emailEnc: meetingInvitees.emailEnc,
      keyVersion: meetingInvitees.keyVersion,
      answer: meetingInvitees.answer,
    })
    .from(meetingInvitees)
    .leftJoin(user, eq(user.id, meetingInvitees.userId))
    .where(eq(meetingInvitees.meetingId, meetingId))
    .orderBy(meetingInvitees.createdAt);

export function createSchedulingRepository(executor: Executor) {
  return {
    /** The meeting, its schedule and its invitees, all or nothing. */
    create: (build: () => NewMeeting, schedule: NewSchedule, invitees: NewInvitee[]): Promise<string> =>
      executor.transaction(async (tx) => {
        const meeting = await createMeetingsRepository(tx).insert(build);
        const scope = { meetingId: meeting.id, workspaceId: meeting.workspaceId };
        await tx.insert(meetingSchedules).values({ ...schedule, ...scope });
        if (invitees.length > 0) await tx.insert(meetingInvitees).values(invitees.map((i) => ({ ...i, ...scope })));
        return meeting.id;
      }),

    calendar: (userId: string, workspaceId: string, range: CalendarRange) =>
      calendarRows(executor, userId, workspaceId, range),

    changesFor: async (meetingIds: string[]): Promise<OccurrenceChangeRow[]> => {
      if (meetingIds.length === 0) return [];
      return executor
        .select({
          meetingId: meetingOccurrenceChanges.meetingId,
          originalStart: meetingOccurrenceChanges.originalStart,
          cancelled: meetingOccurrenceChanges.cancelled,
          startsAt: meetingOccurrenceChanges.startsAt,
          endsAt: meetingOccurrenceChanges.endsAt,
          title: meetingOccurrenceChanges.title,
        })
        .from(meetingOccurrenceChanges)
        .where(inArray(meetingOccurrenceChanges.meetingId, meetingIds));
    },

    schedule: async (meetingId: string): Promise<MeetingSchedule | undefined> => {
      const [row] = await executor.select().from(meetingSchedules).where(eq(meetingSchedules.meetingId, meetingId));
      return row;
    },

    invitees: (meetingId: string) => inviteesOf(executor, meetingId),

    /** Whether the person is a member of the workspace now. */
    isMember: async (workspaceId: string, userId: string): Promise<boolean> => {
      const [row] = await executor
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
      return row !== undefined;
    },
  };
}

export type SchedulingRepository = ReturnType<typeof createSchedulingRepository>;
