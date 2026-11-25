// Scheduled meetings: database access only (F13 design.md "Data stored", D095). A new scheduled meeting is
// written in one transaction (the F02 meeting, its schedule, its invitees). Every read filters by the
// meeting's workspace and by who asks (S2); a meeting whose organizer left its workspace, or that expired,
// is never listed (AC-F13-29, D093).
import {
  meetingCoOrganizers,
  meetingInviteeAnswers,
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

export type { MeetingSchedule } from "@meetapp/db";

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
  /** The caller's answers for single occurrences, by their original start (ms). */
  occurrenceAnswers: Map<number, MeetingInvitee["answer"]>;
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
  emailStatus: MeetingInvitee["emailStatus"];
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

/** The caller's one-occurrence answers in this workspace, by meeting. */
async function occurrenceAnswersOf(executor: Executor, userId: string, workspaceId: string) {
  const rows = await executor
    .select({
      meetingId: meetingInvitees.meetingId,
      originalStart: meetingInviteeAnswers.originalStart,
      answer: meetingInviteeAnswers.answer,
    })
    .from(meetingInviteeAnswers)
    .innerJoin(meetingInvitees, eq(meetingInvitees.id, meetingInviteeAnswers.inviteeId))
    .where(and(eq(meetingInviteeAnswers.workspaceId, workspaceId), eq(meetingInvitees.userId, userId)));
  const byMeeting = new Map<string, Map<number, MeetingInvitee["answer"]>>();
  for (const row of rows) {
    const map = byMeeting.get(row.meetingId) ?? new Map<number, MeetingInvitee["answer"]>();
    map.set(row.originalStart.getTime(), row.answer);
    byMeeting.set(row.meetingId, map);
  }
  return byMeeting;
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
  const perOccurrence = await occurrenceAnswersOf(executor, userId, workspaceId);
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
  return rows.map((row): CalendarRow => ({
    ...row,
    myAnswer: answers.get(row.schedule.meetingId) ?? null,
    occurrenceAnswers: perOccurrence.get(row.schedule.meetingId) ?? new Map(),
  }));
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
      emailStatus: meetingInvitees.emailStatus,
    })
    .from(meetingInvitees)
    .leftJoin(user, eq(user.id, meetingInvitees.userId))
    .where(eq(meetingInvitees.meetingId, meetingId))
    .orderBy(meetingInvitees.createdAt);

/** The meeting, its schedule and its invitees, all or nothing. */
const createScheduled = (
  executor: Executor,
  build: () => NewMeeting,
  schedule: NewSchedule,
  invitees: NewInvitee[],
): Promise<{ meetingId: string; inviteeIds: string[] }> =>
  executor.transaction(async (tx) => {
    const meeting = await createMeetingsRepository(tx).insert(build);
    const scope = { meetingId: meeting.id, workspaceId: meeting.workspaceId };
    await tx.insert(meetingSchedules).values({ ...schedule, ...scope });
    const rows =
      invitees.length > 0
        ? await tx
            .insert(meetingInvitees)
            .values(invitees.map((i) => ({ ...i, ...scope })))
            .returning({ id: meetingInvitees.id })
        : [];
    return { meetingId: meeting.id, inviteeIds: rows.map((row) => row.id) };
  });

/** What one meeting email needs (the address is opened only when it is sent, design "Privacy"). */
async function mailFacts(executor: Executor, inviteeId: string) {
  const [row] = await executor
    .select({
      invitee: meetingInvitees,
      memberEmail: user.email,
      meeting: meetings,
      schedule: meetingSchedules,
    })
    .from(meetingInvitees)
    .innerJoin(meetings, eq(meetings.id, meetingInvitees.meetingId))
    .innerJoin(meetingSchedules, eq(meetingSchedules.meetingId, meetingInvitees.meetingId))
    .leftJoin(user, eq(user.id, meetingInvitees.userId))
    .where(eq(meetingInvitees.id, inviteeId));
  if (!row) return undefined;
  const [organizer] = await executor.select({ name: user.name }).from(user).where(eq(user.id, row.meeting.organizerId));
  return { ...row, organizerName: organizer?.name ?? "" };
}

/** The same without an invitee: for people just removed from the meeting (their row is gone). */
async function meetingMailFacts(executor: Executor, meetingId: string, userId: string | undefined) {
  const [row] = await executor
    .select({ meeting: meetings, schedule: meetingSchedules, organizerName: user.name })
    .from(meetings)
    .innerJoin(meetingSchedules, eq(meetingSchedules.meetingId, meetings.id))
    .innerJoin(user, eq(user.id, meetings.organizerId))
    .where(eq(meetings.id, meetingId));
  if (!row) return undefined;
  const [member] = userId ? await executor.select({ email: user.email }).from(user).where(eq(user.id, userId)) : [];
  return { ...row, memberEmail: member?.email ?? null };
}

export type MailFacts = Pick<
  NonNullable<Awaited<ReturnType<typeof mailFacts>>>,
  "meeting" | "schedule" | "organizerName"
>;

export function createSchedulingRepository(executor: Executor) {
  return {
    mailFacts: (inviteeId: string) => mailFacts(executor, inviteeId),
    meetingMailFacts: (meetingId: string, userId?: string) => meetingMailFacts(executor, meetingId, userId),
    setEmailStatus: async (inviteeId: string, status: "queued" | "sent" | "failed"): Promise<void> => {
      await executor.update(meetingInvitees).set({ emailStatus: status }).where(eq(meetingInvitees.id, inviteeId));
    },
    create: (build: () => NewMeeting, schedule: NewSchedule, invitees: NewInvitee[]) =>
      createScheduled(executor, build, schedule, invitees),

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
