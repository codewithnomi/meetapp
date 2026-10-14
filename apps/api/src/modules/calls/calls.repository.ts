// Calls: database access only (F02 design.md sections 3.3 and 4). Every change that decides who is in
// a call runs inside `locked`, which holds the meeting's row, so two joins (or a join and an Admit all)
// at the same moment can't both take the last place (AC-F02-42, TC-F02-36–39). The reads below take the
// transaction they run in.
import { callAttendances, calls, meetings, type Call, type Executor } from "@meetapp/db";
import { and, count, eq, gt, inArray, isNotNull, isNull, or, type SQL } from "drizzle-orm";

/** In the call, or let in and about to connect: both take a place. */
export const IN_CALL_STATUSES = ["admitted", "in_call"] as const;

async function countWhere(tx: Executor, condition: SQL | undefined): Promise<number> {
  const [row] = await tx.select({ n: count() }).from(callAttendances).where(condition);
  return row?.n ?? 0;
}

export async function runningCall(tx: Executor, meetingId: string): Promise<Call | undefined> {
  const [row] = await tx
    .select()
    .from(calls)
    .where(and(eq(calls.meetingId, meetingId), isNull(calls.endedAt)));
  return row;
}

export async function startCall(tx: Executor, meeting: { id: string; workspaceId: string }): Promise<Call> {
  const [row] = await tx.insert(calls).values({ meetingId: meeting.id, workspaceId: meeting.workspaceId }).returning();
  if (!row) throw new Error("no call row");
  return row;
}

/** Places taken in the call. */
export const placesTaken = (tx: Executor, callId: string) =>
  countWhere(tx, and(eq(callAttendances.callId, callId), inArray(callAttendances.status, [...IN_CALL_STATUSES])));

/** People waiting in the lobby who asked since `seenSince` (the others have gone, AC-F02-19). */
export const waitingCount = (tx: Executor, meetingId: string, seenSince: Date) =>
  countWhere(
    tx,
    and(
      eq(callAttendances.meetingId, meetingId),
      eq(callAttendances.status, "waiting"),
      gt(callAttendances.lastSeenAt, seenSince),
    ),
  );

/** Someone with an account is in the call (guests can't start a meeting alone, AC-F02-17). */
export const accountInCall = async (tx: Executor, callId: string) =>
  (await countWhere(
    tx,
    and(
      eq(callAttendances.callId, callId),
      inArray(callAttendances.status, [...IN_CALL_STATUSES]),
      isNotNull(callAttendances.userId),
    ),
  )) > 0;

/** This person was removed during this call (AC-F02-35): by account, or by app for guests. */
export async function removedFrom(tx: Executor, callId: string, who: { userId?: string; deviceHash?: string }) {
  const same = [
    ...(who.userId ? [eq(callAttendances.userId, who.userId)] : []),
    ...(who.deviceHash ? [eq(callAttendances.guestDeviceHash, who.deviceHash)] : []),
  ];
  if (same.length === 0) return false;
  return (
    (await countWhere(
      tx,
      and(eq(callAttendances.callId, callId), eq(callAttendances.status, "removed"), or(...same)),
    )) > 0
  );
}

export function createCallsRepository(executor: Executor) {
  return {
    /** For reads outside a lock. */
    reader: executor,
    runningFor: (meetingId: string) => runningCall(executor, meetingId),
    /** Runs `work` while holding the meeting's row: the place where joins and admissions take turns. */
    locked: <T>(meetingId: string, work: (tx: Executor) => Promise<T>): Promise<T> =>
      executor.transaction(async (tx) => {
        await tx.select({ id: meetings.id }).from(meetings).where(eq(meetings.id, meetingId)).for("update");
        return work(tx);
      }),
    byId: async (callId: string): Promise<Call | undefined> => {
      const [row] = await executor.select().from(calls).where(eq(calls.id, callId));
      return row;
    },
  };
}

export type CallsRepository = ReturnType<typeof createCallsRepository>;
