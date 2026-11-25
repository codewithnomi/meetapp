// Reminders and the privacy sweep: database access only (F13 design.md "Jobs"; AC-F13-21, 22, 30).
// Candidates are scheduled meetings that aren't cancelled or expired, whose organizer is still in the
// workspace, with the people to remind: the organizer and invited members still in the workspace.
import {
  meetingInviteeAnswers,
  meetingOccurrenceChanges,
  meetingInvitees,
  meetings,
  meetingSchedules,
  reminderDismissals,
  workspaceMembers,
  type Executor,
  type MeetingSchedule,
} from "@meetapp/db";
import { aliasedTable, and, eq, gt, inArray, isNotNull, isNull, lt, or } from "drizzle-orm";

export interface ReminderPerson {
  userId: string;
  /** The series answer; null for an organizer who didn't invite themselves. */
  answer: string | null;
}

export interface ReminderCandidate {
  schedule: MeetingSchedule;
  workspaceId: string;
  title: string;
  people: ReminderPerson[];
}

export interface DismissalRow {
  userId: string;
  meetingId: string;
  originalStart: Date;
  kind: "before" | "start";
  snoozedUntil: Date | null;
}

const organizerMember = aliasedTable(workspaceMembers, "organizer_member");

/** Invited members still in the workspace, with their series answer. */
async function invitedMembers(executor: Executor, meetingIds: string[]) {
  return executor
    .select({ meetingId: meetingInvitees.meetingId, userId: meetingInvitees.userId, answer: meetingInvitees.answer })
    .from(meetingInvitees)
    .innerJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, meetingInvitees.workspaceId),
        eq(workspaceMembers.userId, meetingInvitees.userId),
      ),
    )
    .where(inArray(meetingInvitees.meetingId, meetingIds));
}

/** Schedules that may have an occurrence in [from, to). */
async function candidates(
  executor: Executor,
  range: { from: Date; to: Date; now: Date },
): Promise<ReminderCandidate[]> {
  const rows = await executor
    .select({
      schedule: meetingSchedules,
      workspaceId: meetings.workspaceId,
      title: meetings.title,
      organizerId: meetings.organizerId,
    })
    .from(meetingSchedules)
    .innerJoin(meetings, eq(meetings.id, meetingSchedules.meetingId))
    .innerJoin(
      organizerMember,
      and(eq(organizerMember.workspaceId, meetings.workspaceId), eq(organizerMember.userId, meetings.organizerId)),
    )
    .where(
      and(
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
      ),
    );
  if (rows.length === 0) return [];
  const invited = await invitedMembers(
    executor,
    rows.map((row) => row.schedule.meetingId),
  );
  return rows.map((row) => {
    const people: ReminderPerson[] = invited
      .filter((i) => i.meetingId === row.schedule.meetingId && i.userId !== null)
      .map((i) => ({ userId: i.userId ?? "", answer: i.answer }));
    if (!people.some((p) => p.userId === row.organizerId)) people.push({ userId: row.organizerId, answer: null });
    return { schedule: row.schedule, workspaceId: row.workspaceId, title: row.title, people };
  });
}

/** One-occurrence answers of these meetings, keyed `meetingId|userId|startMs`. */
async function occurrenceAnswers(executor: Executor, meetingIds: string[]): Promise<Map<string, string>> {
  if (meetingIds.length === 0) return new Map();
  const rows = await executor
    .select({
      meetingId: meetingInvitees.meetingId,
      userId: meetingInvitees.userId,
      originalStart: meetingInviteeAnswers.originalStart,
      answer: meetingInviteeAnswers.answer,
    })
    .from(meetingInviteeAnswers)
    .innerJoin(meetingInvitees, eq(meetingInvitees.id, meetingInviteeAnswers.inviteeId))
    .where(inArray(meetingInvitees.meetingId, meetingIds));
  return new Map(rows.map((r) => [`${r.meetingId}|${r.userId ?? ""}|${String(r.originalStart.getTime())}`, r.answer]));
}

async function occurrenceChanges(executor: Executor, meetingIds: string[]) {
  if (meetingIds.length === 0) return [];
  return executor
    .select({
      meetingId: meetingOccurrenceChanges.meetingId,
      originalStart: meetingOccurrenceChanges.originalStart,
      cancelled: meetingOccurrenceChanges.cancelled,
      startsAt: meetingOccurrenceChanges.startsAt,
      endsAt: meetingOccurrenceChanges.endsAt,
    })
    .from(meetingOccurrenceChanges)
    .where(inArray(meetingOccurrenceChanges.meetingId, meetingIds));
}

export function createRemindersRepository(executor: Executor) {
  return {
    candidates: (range: { from: Date; to: Date; now: Date }) => candidates(executor, range),
    occurrenceAnswers: (meetingIds: string[]) => occurrenceAnswers(executor, meetingIds),
    /** Single occurrences moved or cancelled, so reminders follow them. */
    changes: (meetingIds: string[]) => occurrenceChanges(executor, meetingIds),
    dismissals: async (meetingIds: string[], userId?: string): Promise<DismissalRow[]> => {
      if (meetingIds.length === 0) return [];
      return executor
        .select({
          userId: reminderDismissals.userId,
          meetingId: reminderDismissals.meetingId,
          originalStart: reminderDismissals.originalStart,
          kind: reminderDismissals.kind,
          snoozedUntil: reminderDismissals.snoozedUntil,
        })
        .from(reminderDismissals)
        .where(
          and(
            inArray(reminderDismissals.meetingId, meetingIds),
            userId ? eq(reminderDismissals.userId, userId) : undefined,
          ),
        );
    },
    dismiss: async (row: DismissalRow & { workspaceId: string }): Promise<void> => {
      await executor
        .insert(reminderDismissals)
        .values(row)
        .onConflictDoUpdate({
          target: [
            reminderDismissals.userId,
            reminderDismissals.meetingId,
            reminderDismissals.originalStart,
            reminderDismissals.kind,
          ],
          set: { snoozedUntil: row.snoozedUntil },
        });
    },
  };
}

export type RemindersRepository = ReturnType<typeof createRemindersRepository>;

/** Clean-ups: the privacy sweep, and meetings that stop when their organizer leaves (AC-F13-29, 30). */
export function createSchedulingUpkeepRepository(executor: Executor) {
  return {
    /**
     * Outside invitees' addresses of meetings cancelled or expired before `before` (AC-F13-30): their rows
     * go. Members' rows stay with the meeting.
     */
    sweepOutsideInvitees: async (before: Date): Promise<number> => {
      const gone = executor
        .select({ id: meetings.id })
        .from(meetings)
        .innerJoin(meetingSchedules, eq(meetingSchedules.meetingId, meetings.id))
        .where(or(lt(meetingSchedules.cancelledAt, before), lt(meetings.expiresAt, before)));
      const deleted = await executor
        .delete(meetingInvitees)
        .where(and(isNull(meetingInvitees.userId), inArray(meetingInvitees.meetingId, gone)))
        .returning({ id: meetingInvitees.id });
      return deleted.length;
    },
    /** Scheduled meetings still on whose organizer has left the workspace (AC-F13-29). */
    orphaned: async (now: Date): Promise<{ meetingId: string; inviteeIds: string[] }[]> => {
      const rows = await executor
        .select({ id: meetings.id })
        .from(meetings)
        .innerJoin(meetingSchedules, eq(meetingSchedules.meetingId, meetings.id))
        .leftJoin(
          organizerMember,
          and(eq(organizerMember.workspaceId, meetings.workspaceId), eq(organizerMember.userId, meetings.organizerId)),
        )
        .where(and(isNull(meetingSchedules.cancelledAt), gt(meetings.expiresAt, now), isNull(organizerMember.id)));
      const ids = rows.map((row) => row.id);
      if (ids.length === 0) return [];
      const invitees = await executor
        .select({ id: meetingInvitees.id, meetingId: meetingInvitees.meetingId })
        .from(meetingInvitees)
        .where(inArray(meetingInvitees.meetingId, ids));
      return ids.map((meetingId) => ({
        meetingId,
        inviteeIds: invitees.filter((i) => i.meetingId === meetingId).map((i) => i.id),
      }));
    },
  };
}

export type SchedulingUpkeepRepository = ReturnType<typeof createSchedulingUpkeepRepository>;
