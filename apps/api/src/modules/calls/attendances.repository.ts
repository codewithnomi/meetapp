// Attendances: one join of one person (F02 design.md sections 3.3, 3.4 and 4). Database access only.
// Status changes are conditional ("only if still waiting"), so two people pressing Admit at the same
// moment change the row once (TC-F02-36).
import { callAttendances, type CallAttendance, type Executor } from "@meetapp/db";
import { and, asc, eq, gt, inArray, isNull } from "drizzle-orm";

export type AttendanceStatus = CallAttendance["status"];
export type NewAttendance = Omit<typeof callAttendances.$inferInsert, "id" | "createdAt" | "updatedAt">;

export async function insertAttendance(tx: Executor, values: NewAttendance): Promise<CallAttendance> {
  const [row] = await tx.insert(callAttendances).values(values).returning();
  if (!row) throw new Error("no attendance row");
  return row;
}

/** The waiting people of a meeting who asked since `seenSince`, earliest first (AC-F02-15, 39). */
export function waitingInOrder(tx: Executor, meetingId: string, seenSince: Date): Promise<CallAttendance[]> {
  return tx
    .select()
    .from(callAttendances)
    .where(
      and(
        eq(callAttendances.meetingId, meetingId),
        eq(callAttendances.status, "waiting"),
        gt(callAttendances.lastSeenAt, seenSince),
      ),
    )
    .orderBy(asc(callAttendances.lobbyEnteredAt), asc(callAttendances.id));
}

/** Lets these waiting people into the call; returns how many changed (each only if still waiting). */
export async function admitWaiting(
  tx: Executor,
  ids: string[],
  admission: { callId: string; actedBy: string | null; at: Date },
): Promise<number> {
  if (ids.length === 0) return 0;
  const changed = await tx
    .update(callAttendances)
    .set({ status: "admitted", callId: admission.callId, admittedAt: admission.at, actedBy: admission.actedBy })
    .where(and(inArray(callAttendances.id, ids), eq(callAttendances.status, "waiting")))
    .returning({ id: callAttendances.id });
  return changed.length;
}

/** Denies these waiting people (each only if still waiting). */
async function denyWaiting(executor: Executor, meetingId: string, ids: string[], actedBy: string): Promise<number> {
  if (ids.length === 0) return 0;
  const changed = await executor
    .update(callAttendances)
    .set({ status: "denied", actedBy })
    .where(
      and(
        eq(callAttendances.meetingId, meetingId),
        inArray(callAttendances.id, ids),
        eq(callAttendances.status, "waiting"),
      ),
    )
    .returning({ id: callAttendances.id });
  return changed.length;
}

export type AttendanceChange = Partial<NewAttendance> & { status: AttendanceStatus };

/** Changes the status only if it is still one of `from`; true when it changed. Runs in `tx`. */
export async function moveAttendance(
  tx: Executor,
  id: string,
  from: readonly AttendanceStatus[],
  change: AttendanceChange,
): Promise<boolean> {
  const changed = await tx
    .update(callAttendances)
    .set(change)
    .where(and(eq(callAttendances.id, id), inArray(callAttendances.status, [...from])))
    .returning({ id: callAttendances.id });
  return changed.length === 1;
}

export function createAttendancesRepository(executor: Executor) {
  return {
    byTicket: async (ticketHash: string): Promise<CallAttendance | undefined> => {
      const [row] = await executor.select().from(callAttendances).where(eq(callAttendances.ticketHash, ticketHash));
      return row;
    },
    byId: async (id: string): Promise<CallAttendance | undefined> => {
      const [row] = await executor.select().from(callAttendances).where(eq(callAttendances.id, id));
      return row;
    },
    /** Changes the status only if it is still one of `from`; true when it changed. */
    move: (id: string, from: readonly AttendanceStatus[], change: AttendanceChange) =>
      moveAttendance(executor, id, from, change),
    /** Marks the first Rejoin of a dropped attendance; false when it was already used. */
    markRejoined: async (id: string, at: Date): Promise<boolean> => {
      const changed = await executor
        .update(callAttendances)
        .set({ rejoinedAt: at })
        .where(and(eq(callAttendances.id, id), eq(callAttendances.status, "left"), isNull(callAttendances.rejoinedAt)))
        .returning({ id: callAttendances.id });
      return changed.length === 1;
    },
    /** People marked inside one call (compared with the call server by the clean-up). */
    inCallOf: (callId: string): Promise<CallAttendance[]> =>
      executor
        .select()
        .from(callAttendances)
        .where(and(eq(callAttendances.callId, callId), eq(callAttendances.status, "in_call"))),
    seen: async (id: string, at: Date): Promise<void> => {
      await executor.update(callAttendances).set({ lastSeenAt: at }).where(eq(callAttendances.id, id));
    },
    deny: (meetingId: string, ids: string[], actedBy: string) => denyWaiting(executor, meetingId, ids, actedBy),
  };
}

export type AttendancesRepository = ReturnType<typeof createAttendancesRepository>;
