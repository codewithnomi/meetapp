// Calls from chats: database access only (F15 design.md 3.1–3.3, D072). Starting and joining run inside
// `locked`, which holds the chat's row, so two starts at the same moment make one call (AC-F15-26) and
// the 20-person limit holds under any timing (AC-F15-14).
import { callAttendances, callRings, calls, conversations, type Call, type Executor } from "@meetapp/db";
import { and, asc, countDistinct, eq, inArray, isNull } from "drizzle-orm";
import type { CallMedia } from "@meetapp/contracts";
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

export async function peopleCount(tx: Executor, callId: string): Promise<number> {
  const [row] = await tx
    .select({ n: countDistinct(callAttendances.userId) })
    .from(callAttendances)
    .where(and(eq(callAttendances.callId, callId), inArray(callAttendances.status, [...IN_CALL_STATUSES])));
  return row?.n ?? 0;
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
    /** The person who took the call's first seat: its starter. */
    starterOf: async (callId: string) => {
      const [row] = await executor
        .select({ userId: callAttendances.userId, name: callAttendances.displayName })
        .from(callAttendances)
        .where(eq(callAttendances.callId, callId))
        .orderBy(asc(callAttendances.createdAt))
        .limit(1);
      return row;
    },
    /** Runs `work` while holding the chat's row: where starts and joins take turns. */
    locked: <T>(conversationId: string, work: (tx: Executor) => Promise<T>): Promise<T> =>
      executor.transaction(async (tx) => {
        await tx
          .select({ id: conversations.id })
          .from(conversations)
          .where(eq(conversations.id, conversationId))
          .for("update");
        return work(tx);
      }),
    /** One ringing row per person rung (F15 design 3.3); delivery is the ring targets' job (T4). */
    ring: async (tx: Executor, call: Call, userIds: string[]) => {
      if (userIds.length === 0) return [];
      return tx
        .insert(callRings)
        .values(userIds.map((userId) => ({ workspaceId: call.workspaceId, callId: call.id, userId })))
        .returning();
    },
    /** A person rung who starts or joins the call themselves has answered (AC-F15-26). */
    answeredByJoining: (tx: Executor, callId: string, userId: string, at: Date) =>
      tx
        .update(callRings)
        .set({ state: "accepted", answeredAt: at })
        .where(and(eq(callRings.callId, callId), eq(callRings.userId, userId), eq(callRings.state, "ringing")))
        .returning(),
  };
}

export type ChatCallsRepository = ReturnType<typeof createChatCallsRepository>;
