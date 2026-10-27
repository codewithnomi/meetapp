// What the call server reports, and the clean-up that repairs anything a lost report missed (F02 design
// sections 3.5, 3.7 and "Edge cases"). Database access only. Each report is handled once (its event id),
// and an attendance ignores reports older than the newest one it has applied.
import { callAttendances, calls, chatPolls, livekitEvents, meetings, type Call, type Executor } from "@meetapp/db";
import { and, eq, inArray, isNull, lt, max, sql } from "drizzle-orm";

export type EndReason = NonNullable<Call["endReason"]>;

/** True the first time an event id is seen; false for a repeat. */
async function firstTime(executor: Executor, eventId: string): Promise<boolean> {
  const rows = await executor
    .insert(livekitEvents)
    .values({ eventId })
    .onConflictDoNothing()
    .returning({ id: livekitEvents.id });
  return rows.length === 1;
}

/** In the call now (joined at `at`, which stays the first join time). */
async function markInCall(executor: Executor, attendanceId: string, at: Date): Promise<void> {
  await executor
    .update(callAttendances)
    .set({
      status: "in_call",
      joinedAt: sql`coalesce(${callAttendances.joinedAt}, ${at})`,
      leftAt: null,
      leftReason: null,
      lastEventAt: at,
    })
    .where(eq(callAttendances.id, attendanceId));
}

export function createCallEventsRepository(executor: Executor) {
  return {
    firstTime: (eventId: string) => firstTime(executor, eventId),
    /** Forgets one report whose handling failed, so the call server's retry is handled (not dropped). */
    forgetEvent: async (eventId: string): Promise<void> => {
      await executor.delete(livekitEvents).where(eq(livekitEvents.eventId, eventId));
    },
    forgetEventsBefore: async (before: Date): Promise<void> => {
      await executor.delete(livekitEvents).where(lt(livekitEvents.createdAt, before));
    },
    inCall: (attendanceId: string, at: Date) => markInCall(executor, attendanceId, at),
    /** Gone without the app's own Leave (a dropped connection, a crash or sleep). */
    dropped: async (attendanceId: string, at: Date): Promise<void> => {
      await executor
        .update(callAttendances)
        .set({ status: "left", leftReason: "dropped", leftAt: at, lastEventAt: at })
        .where(and(eq(callAttendances.id, attendanceId), inArray(callAttendances.status, ["admitted", "in_call"])));
    },
    /** Notes the event time on an attendance that already left by itself. */
    touched: async (attendanceId: string, at: Date): Promise<void> => {
      await executor.update(callAttendances).set({ lastEventAt: at }).where(eq(callAttendances.id, attendanceId));
    },
    /**
     * Ends a running call once: `at`, or the time the last person left. People let in who never connected
     * get the join decision again on their next ask (admitted_at stays as the sign); people still marked
     * inside leave with it.
     */
    endCall: (callId: string, reason: EndReason, at: Date): Promise<boolean> =>
      executor.transaction(async (tx) => endCall(tx, callId, reason, at)),
    runningCalls: (): Promise<Call[]> => executor.select().from(calls).where(isNull(calls.endedAt)),
    /** Waiting people whose 15 minutes are over (the clean-up for apps that stopped asking). */
    timeOutWaiting: async (enteredBefore: Date): Promise<void> => {
      await executor
        .update(callAttendances)
        .set({ status: "timed_out" })
        .where(and(eq(callAttendances.status, "waiting"), lt(callAttendances.lobbyEnteredAt, enteredBefore)));
    },
  };
}

/**
 * What chat keeps when a call ends (F03 design 3.7, 3.8): the chat setting at that moment, which decides
 * who reads the chat afterwards, and open polls close.
 */
async function closeChatOf(tx: Executor, call: { id: string; meetingId: string }, at: Date): Promise<void> {
  await tx
    .update(calls)
    .set({
      chatModeAtEnd: sql`(select ${meetings.chatMode} from ${meetings} where ${meetings.id} = ${call.meetingId})`,
    })
    .where(eq(calls.id, call.id));
  await tx
    .update(chatPolls)
    .set({ closedAt: at })
    .where(and(eq(chatPolls.meetingId, call.meetingId), isNull(chatPolls.closedAt)));
}

async function endCall(tx: Executor, callId: string, reason: EndReason, at: Date): Promise<boolean> {
  const [lastLeft] = await tx
    .select({ at: max(callAttendances.leftAt) })
    .from(callAttendances)
    .where(eq(callAttendances.callId, callId));
  const endedAt = reason === "last_left" && lastLeft?.at ? lastLeft.at : at;
  const ended = await tx
    .update(calls)
    .set({ endedAt, endReason: reason })
    .where(and(eq(calls.id, callId), isNull(calls.endedAt)))
    .returning({ id: calls.id, meetingId: calls.meetingId });
  const [call] = ended;
  if (!call) return false;
  // A chat call (F15) has no meeting chat to close and no lobby to go back to: everyone leaves.
  if (call.meetingId) {
    await closeChatOf(tx, { id: call.id, meetingId: call.meetingId }, at);
    await tx
      .update(callAttendances)
      .set({ status: "waiting", callId: null, lobbyEnteredAt: at, lastSeenAt: at })
      .where(
        and(
          eq(callAttendances.callId, callId),
          eq(callAttendances.status, "admitted"),
          isNull(callAttendances.joinedAt),
        ),
      );
  }
  await tx
    .update(callAttendances)
    .set({ status: "left", leftReason: "ended", leftAt: endedAt })
    .where(and(eq(callAttendances.callId, callId), inArray(callAttendances.status, ["admitted", "in_call"])));
  return true;
}

/** End meeting (AC-F02-38): the call ends, and everyone, the lobby included, leaves at once. */
export function endForEveryone(
  executor: Executor,
  call: { id: string; meetingId: string },
  at: Date,
): Promise<boolean> {
  return executor.transaction(async (tx) => {
    const ended = await tx
      .update(calls)
      .set({ endedAt: at, endReason: "ended" })
      .where(and(eq(calls.id, call.id), isNull(calls.endedAt)))
      .returning({ id: calls.id });
    if (ended.length === 0) return false;
    await closeChatOf(tx, call, at);
    await tx
      .update(callAttendances)
      .set({ status: "left", leftReason: "ended", leftAt: at })
      .where(and(eq(callAttendances.callId, call.id), inArray(callAttendances.status, ["admitted", "in_call"])));
    await tx
      .update(callAttendances)
      .set({ status: "left", leftReason: "ended", leftAt: at })
      .where(and(eq(callAttendances.meetingId, call.meetingId), eq(callAttendances.status, "waiting")));
    return true;
  });
}

export type CallEventsRepository = ReturnType<typeof createCallEventsRepository>;
