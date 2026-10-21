// Chat storage (F03 design.md sections 3.2–3.4 and 4). Database access only: every query is limited
// to one meeting, which the service reached through the caller's ticket (S2).
import { type Database, type Executor, chatEvents, chatMessages, meetings, type ChatMessage } from "@meetapp/db";
import { meetingConversation, meetingOf, type ChatPlace } from "./meeting-conversation.repository.ts";

export type { ChatPlace };
import { and, asc, desc, eq, gt, lt, or, sql } from "drizzle-orm";
import { claimAttachments } from "./chat-files.repository.ts";

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
async function nextSeq(executor: Executor, meetingId: string): Promise<number> {
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
  where: ChatPlace,
  type: string,
  payload: Record<string, unknown>,
): Promise<number> {
  const meetingId = meetingOf(where);
  const seq = await nextSeq(executor, meetingId);
  // Only these fields: callers may pass a whole message or poll row.
  const { workspaceId } = where;
  const conversationId = where.conversationId ?? (await meetingConversation(executor, workspaceId, meetingId));
  await executor.insert(chatEvents).values({ workspaceId, meetingId, conversationId, seq, type, payload });
  return seq;
}

/**
 * Saves a message and its event together. When the same sender already sent this `clientId`, nothing
 * is added and the saved message comes back with `created: false` (AC-F03-05).
 */
/** Thrown inside the save when the files named aren't this sender's ready, unsent files. */
export class AttachmentsNotYoursError extends Error {
  constructor() {
    super("attachments can't be sent with this message");
    this.name = "AttachmentsNotYoursError";
  }
}

async function insertMessage(db: Database, message: NewChatMessage, eventType: string, attachmentIds: string[] = []) {
  return db.transaction(async (tx) => {
    const conversationId =
      message.conversationId ??
      (await meetingConversation(tx, message.workspaceId, meetingOf({ meetingId: message.meetingId ?? null })));
    const [saved] = await tx
      .insert(chatMessages)
      .values({ ...message, conversationId })
      .onConflictDoNothing()
      .returning();
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
    const claim = {
      ids: attachmentIds,
      messageId: saved.id,
      meetingId: meetingOf(saved),
      uploaderAttendanceId: saved.senderAttendanceId ?? "",
    };
    if (!(await claimAttachments(tx, claim))) throw new AttachmentsNotYoursError();
    const seq = await recordEvent(tx, saved, eventType, { id: saved.id });
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
    /** The newest news number of a meeting (0 before any), sent with the first page (verification round 1). */
    lastSeq: async (meetingId: string): Promise<number> => {
      const [row] = await db
        .select({ last: sql<number>`coalesce(max(${chatEvents.seq}), 0)::int` })
        .from(chatEvents)
        .where(eq(chatEvents.meetingId, meetingId));
      return row?.last ?? 0;
    },
    insertMessage: (message: NewChatMessage, eventType: string, attachmentIds?: string[]) =>
      insertMessage(db, message, eventType, attachmentIds),
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

export type { ChatMessage } from "@meetapp/db";
