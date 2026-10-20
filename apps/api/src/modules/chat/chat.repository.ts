// Chat storage (F03 design.md sections 3.2–3.4 and 4). Database access only: every query is limited
// to one meeting, which the service reached through the caller's ticket (S2).
import { type Database, type Executor, chatEvents, chatMessages, meetings, type ChatMessage } from "@meetapp/db";
import { and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm";

export type NewChatMessage = typeof chatMessages.$inferInsert;

/** Where a page of history starts: the oldest message already shown (time, then id). */
export interface Cursor {
  createdAt: Date;
  id: string;
}

const olderThan = (cursor: Cursor) =>
  or(
    lt(chatMessages.createdAt, cursor.createdAt),
    and(eq(chatMessages.createdAt, cursor.createdAt), lt(chatMessages.id, cursor.id)),
  );

/** The next event number for a meeting; the meeting row is locked so numbers never repeat. */
export async function nextSeq(executor: Executor, meetingId: string): Promise<number> {
  await executor.execute(sql`select 1 from ${meetings} where ${meetings.id} = ${meetingId} for update`);
  const [row] = await executor
    .select({ last: sql<number>`coalesce(max(${chatEvents.seq}), 0)::int` })
    .from(chatEvents)
    .where(eq(chatEvents.meetingId, meetingId));
  return (row?.last ?? 0) + 1;
}

/** Keeps a piece of chat news for catching up, and returns its number (design 3.4). */
export async function recordEvent(
  executor: Executor,
  where: { workspaceId: string; meetingId: string },
  type: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const seq = await nextSeq(executor, where.meetingId);
  await executor.insert(chatEvents).values({ ...where, seq, type, payload });
  return seq;
}

/**
 * Saves a message and its event together. When the same sender already sent this `clientId`, nothing
 * is added and the saved message comes back with `created: false` (AC-F03-05).
 */
async function insertMessage(db: Database, message: NewChatMessage, eventType: string) {
  return db.transaction(async (tx) => {
    const [saved] = await tx.insert(chatMessages).values(message).onConflictDoNothing().returning();
    if (!saved) {
      const [existing] = await tx
        .select()
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.senderAttendanceId, message.senderAttendanceId ?? ""),
            eq(chatMessages.clientId, message.clientId),
          ),
        );
      if (!existing) throw new Error("message neither saved nor found");
      return { message: existing, created: false as const };
    }
    const seq = await nextSeq(tx, saved.meetingId);
    await tx.insert(chatEvents).values({
      workspaceId: saved.workspaceId,
      meetingId: saved.meetingId,
      seq,
      type: eventType,
      payload: { id: saved.id },
    });
    return { message: saved, created: true as const, seq };
  });
}

/** Events after `after`, oldest first, and the oldest number still kept. */
async function eventsAfter(db: Database, meetingId: string, after: number) {
  const rows = await db
    .select()
    .from(chatEvents)
    .where(and(eq(chatEvents.meetingId, meetingId), gt(chatEvents.seq, after)))
    .orderBy(asc(chatEvents.seq))
    .limit(500);
  const [oldest] = await db
    .select({ seq: sql<number | null>`min(${chatEvents.seq})::int` })
    .from(chatEvents)
    .where(eq(chatEvents.meetingId, meetingId));
  return { rows, oldestKept: oldest?.seq ?? null };
}

export function createChatRepository(db: Database) {
  return {
    insertMessage: (message: NewChatMessage, eventType: string) => insertMessage(db, message, eventType),
    /** One page of a meeting's history, newest first (the app shows them oldest at the top). */
    page: (meetingId: string, limit: number, before?: Cursor): Promise<ChatMessage[]> =>
      db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.meetingId, meetingId), before ? olderThan(before) : undefined))
        .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
        .limit(limit),
    one: async (meetingId: string, id: string): Promise<ChatMessage | undefined> => {
      const [row] = await db
        .select()
        .from(chatMessages)
        .where(and(eq(chatMessages.meetingId, meetingId), eq(chatMessages.id, id)));
      return row;
    },
    eventsAfter: (meetingId: string, after: number) => eventsAfter(db, meetingId, after),
  };
}

export type ChatRepository = ReturnType<typeof createChatRepository>;
