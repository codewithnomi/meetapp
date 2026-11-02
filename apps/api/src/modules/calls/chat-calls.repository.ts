// Calls from chats: database access only (F15 design.md 3.1–3.3, D072). Starting and joining run inside
// `locked`, which holds the chat's row, so two starts at the same moment make one call (AC-F15-26) and
// the 20-person limit holds under any timing (AC-F15-14).
import { callAttendances, callRings, calls, conversations, type Call, type Executor } from "@meetapp/db";
import { and, asc, countDistinct, eq, inArray, isNotNull, isNull, or, count } from "drizzle-orm";

import type { CallMedia } from "@meetapp/contracts";
import { createCallRingsRepository } from "./call-rings.repository.ts";
import { IN_CALL_STATUSES } from "./calls.repository.ts";

export async function runningChatCall(tx: Executor, conversationId: string): Promise<Call | undefined> {
  const [row] = await tx
    .select()
    .from(calls)
    .where(and(eq(calls.conversationId, conversationId), isNull(calls.endedAt)));
  return row;
}

export async function startChatCall(
  tx: Executor,
  chat: { conversationId: string; workspaceId: string; media: CallMedia },
): Promise<Call> {
  const [row] = await tx
    .insert(calls)
    .values({ conversationId: chat.conversationId, workspaceId: chat.workspaceId, media: chat.media })
    .returning();
  if (!row) throw new Error("no call row");
  return row;
}

/** People (distinct accounts) in the call or let in: a person's second window takes no place. */
export async function peopleIn(tx: Executor, callId: string): Promise<string[]> {
  const rows = await tx
    .selectDistinct({ userId: callAttendances.userId })
    .from(callAttendances)
    .where(and(eq(callAttendances.callId, callId), inArray(callAttendances.status, [...IN_CALL_STATUSES])));
  return rows.flatMap((row) => (row.userId ? [row.userId] : []));
}

/** This person's seats in the call (each device is one, T-fix-5). */
export async function seatsOf(tx: Executor, callId: string, userId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(callAttendances)
    .where(
      and(
        eq(callAttendances.callId, callId),
        eq(callAttendances.userId, userId),
        inArray(callAttendances.status, [...IN_CALL_STATUSES]),
      ),
    );
  return row?.n ?? 0;
}

export async function peopleCount(tx: Executor, callId: string): Promise<number> {
  const [row] = await tx
    .select({ n: countDistinct(callAttendances.userId) })
    .from(callAttendances)
    .where(and(eq(callAttendances.callId, callId), inArray(callAttendances.status, [...IN_CALL_STATUSES])));
  return row?.n ?? 0;
}

/** The person who took the call's first seat: its starter. */
async function starterOf(executor: Executor, callId: string) {
  const [row] = await executor
    .select({ userId: callAttendances.userId, name: callAttendances.displayName })
    .from(callAttendances)
    .where(eq(callAttendances.callId, callId))
    .orderBy(asc(callAttendances.createdAt))
    .limit(1);
  return row;
}

/** Runs `work` while holding the chat's row: where starts and joins take turns. */
function locked<T>(executor: Executor, conversationId: string, work: (tx: Executor) => Promise<T>): Promise<T> {
  return executor.transaction(async (tx) => {
    await tx
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .for("update");
    return work(tx);
  });
}

async function runningCallsOf(executor: Executor, userId: string): Promise<Call[]> {
  const seated = executor
    .select({ id: callAttendances.callId })
    .from(callAttendances)
    .where(and(eq(callAttendances.userId, userId), inArray(callAttendances.status, [...IN_CALL_STATUSES])));
  const rung = executor
    .select({ id: callRings.callId })
    .from(callRings)
    .where(and(eq(callRings.userId, userId), eq(callRings.state, "ringing")));
  return executor
    .select()
    .from(calls)
    .where(
      and(
        isNotNull(calls.conversationId),
        isNull(calls.endedAt),
        or(inArray(calls.id, seated), inArray(calls.id, rung)),
      ),
    );
}

export function createChatCallsRepository(executor: Executor) {
  return {
    reader: executor,
    running: (conversationId: string) => runningChatCall(executor, conversationId),
    byId: async (callId: string): Promise<Call | undefined> => {
      const [row] = await executor.select().from(calls).where(eq(calls.id, callId));
      return row;
    },
    peopleCount: (callId: string) => peopleCount(executor, callId),
    starterOf: (callId: string) => starterOf(executor, callId),
    locked: <T>(conversationId: string, work: (tx: Executor) => Promise<T>): Promise<T> =>
      locked(executor, conversationId, work),
    /** People who were ever connected to the call (not only let in). */
    joinedPeople: async (callId: string) =>
      (
        await executor
          .selectDistinct({ userId: callAttendances.userId })
          .from(callAttendances)
          .where(and(eq(callAttendances.callId, callId), isNotNull(callAttendances.joinedAt)))
      ).flatMap((row) => (row.userId ? [row.userId] : [])),
    peopleIn: (callId: string) => peopleIn(executor, callId),
    /** Running chat calls the person has a seat in or is being rung for (account deletion). */
    runningCallsOf: (userId: string) => runningCallsOf(executor, userId),
    conversationKind: async (conversationId: string) => {
      const [row] = await executor
        .select({ kind: conversations.kind })
        .from(conversations)
        .where(eq(conversations.id, conversationId));
      return row?.kind;
    },
    ...createCallRingsRepository(executor),
  };
}

export type ChatCallsRepository = ReturnType<typeof createChatCallsRepository>;
