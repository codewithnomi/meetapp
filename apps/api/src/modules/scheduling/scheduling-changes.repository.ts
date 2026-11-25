// Changing scheduled meetings: database access only (F13 design.md "Backend endpoints"; AC-F13-16, 18, 19).
// Answers for the series or one occurrence, edits of the series or one occurrence, and cancellations.
// Each change raises the schedule's SEQUENCE, so calendar apps take the newest file.
import {
  meetingCoOrganizers,
  meetingInviteeAnswers,
  meetingInvitees,
  meetingOccurrenceChanges,
  meetings,
  meetingSchedules,
  type Executor,
} from "@meetapp/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { NewInvitee } from "./scheduling.repository.ts";

export type Answer = "accepted" | "tentative" | "declined";

export interface SeriesChange {
  title?: string | undefined;
  startsAt?: Date | undefined;
  endsAt?: Date | undefined;
  allDay?: boolean | undefined;
  timeZone?: string | undefined;
  rrule?: string | null | undefined;
  repeatUntil?: Date | null | undefined;
  description?: string | undefined;
  expiresAt?: Date | undefined;
  /** The time moved: everyone's answers go back to "no answer" and one-occurrence changes go (AC-F13-18). */
  timeMoved: boolean;
}

interface OccurrenceEdit {
  startsAt?: Date | undefined;
  endsAt?: Date | undefined;
  title?: string | undefined;
  description?: string | undefined;
}

const bump = { sequence: sql`${meetingSchedules.sequence} + 1` };

async function updateSeries(executor: Executor, meetingId: string, change: SeriesChange): Promise<void> {
  const { title, expiresAt, timeMoved, ...fields } = change;
  await executor.transaction(async (tx) => {
    const meetingFields = { ...(title !== undefined ? { title } : {}), ...(expiresAt ? { expiresAt } : {}) };
    if (Object.keys(meetingFields).length > 0)
      await tx.update(meetings).set(meetingFields).where(eq(meetings.id, meetingId));
    const defined = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
    await tx
      .update(meetingSchedules)
      .set({ ...defined, ...bump })
      .where(eq(meetingSchedules.meetingId, meetingId));
    if (!timeMoved) return;
    await tx.delete(meetingOccurrenceChanges).where(eq(meetingOccurrenceChanges.meetingId, meetingId));
    const invitees = tx
      .select({ id: meetingInvitees.id })
      .from(meetingInvitees)
      .where(eq(meetingInvitees.meetingId, meetingId));
    await tx.delete(meetingInviteeAnswers).where(inArray(meetingInviteeAnswers.inviteeId, invitees));
    await tx
      .update(meetingInvitees)
      .set({ answer: "none", answeredAt: null })
      .where(eq(meetingInvitees.meetingId, meetingId));
  });
}

/** One occurrence moved, renamed or cancelled on its own. */
function occurrenceChanges(executor: Executor) {
  return {
    editOccurrence: (scope: { meetingId: string; workspaceId: string }, originalStart: Date, edit: OccurrenceEdit) =>
      executor.transaction(async (tx) => {
        await tx
          .insert(meetingOccurrenceChanges)
          .values({ ...scope, originalStart, ...edit })
          .onConflictDoUpdate({
            target: [meetingOccurrenceChanges.meetingId, meetingOccurrenceChanges.originalStart],
            set: edit,
          });
        await tx.update(meetingSchedules).set(bump).where(eq(meetingSchedules.meetingId, scope.meetingId));
      }),
    cancelOccurrence: (scope: { meetingId: string; workspaceId: string }, originalStart: Date) =>
      executor.transaction(async (tx) => {
        await tx
          .insert(meetingOccurrenceChanges)
          .values({ ...scope, originalStart, cancelled: true })
          .onConflictDoUpdate({
            target: [meetingOccurrenceChanges.meetingId, meetingOccurrenceChanges.originalStart],
            set: { cancelled: true },
          });
        await tx.update(meetingSchedules).set(bump).where(eq(meetingSchedules.meetingId, scope.meetingId));
      }),
  };
}

/** Invitees added or removed by an update. */
function inviteeChanges(executor: Executor) {
  return {
    addInvitees: async (scope: { meetingId: string; workspaceId: string }, invitees: NewInvitee[]) => {
      if (invitees.length === 0) return [];
      const rows = await executor
        .insert(meetingInvitees)
        .values(invitees.map((invitee) => ({ ...invitee, ...scope })))
        .onConflictDoNothing()
        .returning({ id: meetingInvitees.id, userId: meetingInvitees.userId });
      return rows;
    },
    removeInvitees: async (meetingId: string, inviteeIds: string[]): Promise<void> => {
      if (inviteeIds.length === 0) return;
      await executor
        .delete(meetingInvitees)
        .where(and(eq(meetingInvitees.meetingId, meetingId), inArray(meetingInvitees.id, inviteeIds)));
    },
  };
}

export function createSchedulingChangesRepository(executor: Executor) {
  return {
    answerSeries: async (inviteeId: string, answer: Answer, at: Date): Promise<void> => {
      await executor.update(meetingInvitees).set({ answer, answeredAt: at }).where(eq(meetingInvitees.id, inviteeId));
    },
    answerOccurrence: async (
      scope: { inviteeId: string; workspaceId: string },
      originalStart: Date,
      answer: Answer,
    ) => {
      await executor
        .insert(meetingInviteeAnswers)
        .values({ ...scope, originalStart, answer })
        .onConflictDoUpdate({
          target: [meetingInviteeAnswers.inviteeId, meetingInviteeAnswers.originalStart],
          set: { answer },
        });
    },
    updateSeries: (meetingId: string, change: SeriesChange) => updateSeries(executor, meetingId, change),
    ...occurrenceChanges(executor),
    /** The whole series: off every calendar, and its link stops working at once (AC-F13-19). */
    cancelSeries: (meetingId: string, at: Date) =>
      executor.transaction(async (tx) => {
        await tx
          .update(meetingSchedules)
          .set({ cancelledAt: at, ...bump })
          .where(eq(meetingSchedules.meetingId, meetingId));
        await tx.update(meetings).set({ expiresAt: at }).where(eq(meetings.id, meetingId));
      }),
    ...inviteeChanges(executor),
    /** The organizer and co-organizers' ids, for live news. */
    managers: async (meetingId: string): Promise<string[]> => {
      const [meeting] = await executor
        .select({ id: meetings.organizerId })
        .from(meetings)
        .where(eq(meetings.id, meetingId));
      const co = await executor
        .select({ id: meetingCoOrganizers.userId })
        .from(meetingCoOrganizers)
        .where(eq(meetingCoOrganizers.meetingId, meetingId));
      return [...(meeting ? [meeting.id] : []), ...co.map((row) => row.id)];
    },
  };
}

export type SchedulingChangesRepository = ReturnType<typeof createSchedulingChangesRepository>;
