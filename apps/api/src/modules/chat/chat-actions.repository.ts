// Storage for what people do to messages (F03 design.md 3.5 and 3.6): edits, deletes, reactions,
// replies and pins. Each change and its news are saved in one transaction. Database access only.
import {
  chatAttachments,
  chatMessages,
  chatPins,
  chatReactions,
  type ChatMessage,
  type Database,
  type Executor,
} from "@meetapp/db";
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { recordEvent } from "./chat.repository.ts";

/** Most different emoji one person may add to one message (AC-F03-13). */
const CHECK_VIOLATION = "23514";

export type Change<T> = { row: T; seq: number } | undefined;

const where = (message: Pick<ChatMessage, "workspaceId" | "meetingId" | "conversationId">) => ({
  conversationId: message.conversationId,
  workspaceId: message.workspaceId,
  meetingId: message.meetingId,
});

const live = (meetingId: string, id: string) =>
  and(eq(chatMessages.meetingId, meetingId), eq(chatMessages.id, id), isNull(chatMessages.deletedAt));

/** Removes a message's content; who sent it and when stay (AC-F03-10). Its pin and files go too. */
async function deleteMessage(db: Database, meetingId: string, id: string, by: string): Promise<Change<ChatMessage>> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(chatMessages)
      .set({ body: null, plainText: null, gif: null, sticker: null, deletedAt: new Date(), deletedByAttendanceId: by })
      .where(and(live(meetingId, id), ne(chatMessages.kind, "system")))
      .returning();
    if (!row) return undefined;
    await tx.delete(chatPins).where(eq(chatPins.messageId, id));
    await tx.update(chatAttachments).set({ status: "deleted" }).where(eq(chatAttachments.messageId, id));
    return { row, seq: await recordEvent(tx, where(row), "message_deleted", { id }) };
  });
}

async function addReaction(
  db: Database,
  message: ChatMessage,
  person: { attendanceId: string; name: string },
  emoji: string,
): Promise<number | undefined> {
  return db.transaction(async (tx) => {
    // One reaction per person, as in Teams (D061): a different emoji replaces the earlier one.
    const mine = and(eq(chatReactions.messageId, message.id), eq(chatReactions.attendanceId, person.attendanceId));
    await tx.delete(chatReactions).where(and(mine, ne(chatReactions.emoji, emoji)));
    const [added] = await tx
      .insert(chatReactions)
      .values({
        workspaceId: message.workspaceId,
        messageId: message.id,
        attendanceId: person.attendanceId,
        emoji,
        reactorName: person.name,
      })
      .onConflictDoNothing()
      .returning();
    if (!added) return undefined;
    return recordEvent(tx, where(message), "reactions_changed", { id: message.id });
  });
}

async function removeReaction(db: Database, message: ChatMessage, attendanceId: string, emoji: string) {
  return db.transaction(async (tx) => {
    const removed = await tx
      .delete(chatReactions)
      .where(
        and(
          eq(chatReactions.messageId, message.id),
          eq(chatReactions.attendanceId, attendanceId),
          eq(chatReactions.emoji, emoji),
        ),
      )
      .returning();
    if (removed.length === 0) return undefined;
    return recordEvent(tx, where(message), "reactions_changed", { id: message.id });
  });
}

const isPinLimit = (error: unknown) =>
  ((error as { cause?: { code?: string } }).cause ?? (error as { code?: string })).code === CHECK_VIOLATION;

async function pin(db: Database, message: ChatMessage, by: string): Promise<number | "full" | undefined> {
  try {
    return await db.transaction(async (tx) => {
      const [added] = await tx
        .insert(chatPins)
        .values({ ...where(message), messageId: message.id, pinnedByAttendanceId: by })
        .onConflictDoNothing()
        .returning();
      if (!added) return undefined;
      return recordEvent(tx, where(message), "pins_changed", { id: message.id, pinned: true });
    });
  } catch (error) {
    if (isPinLimit(error)) return "full";
    throw error;
  }
}

async function unpin(db: Database, message: ChatMessage): Promise<number | undefined> {
  return db.transaction(async (tx) => {
    const removed = await tx.delete(chatPins).where(eq(chatPins.messageId, message.id)).returning();
    if (removed.length === 0) return undefined;
    return recordEvent(tx, where(message), "pins_changed", { id: message.id, pinned: false });
  });
}

export function createChatActionsRepository(db: Database) {
  return {
    /** Changes the text of a message that isn't deleted; undefined when there is none. */
    edit: (meetingId: string, id: string, change: { body: unknown; plainText: string }): Promise<Change<ChatMessage>> =>
      db.transaction(async (tx) => {
        const [row] = await tx
          .update(chatMessages)
          .set({ ...change, editedAt: new Date() })
          .where(and(live(meetingId, id), eq(chatMessages.kind, "text")))
          .returning();
        return row ? { row, seq: await recordEvent(tx, where(row), "message_edited", { id }) } : undefined;
      }),
    delete: (meetingId: string, id: string, by: string) => deleteMessage(db, meetingId, id, by),
    addReaction: (message: ChatMessage, person: { attendanceId: string; name: string }, emoji: string) =>
      addReaction(db, message, person, emoji),
    removeReaction: (message: ChatMessage, attendanceId: string, emoji: string) =>
      removeReaction(db, message, attendanceId, emoji),
    pin: (message: ChatMessage, by: string) => pin(db, message, by),
    unpin: (message: ChatMessage) => unpin(db, message),
    /** Reactions of these messages, for building what apps see. */
    reactionsOf: (messageIds: string[]) =>
      messageIds.length === 0
        ? Promise.resolve([])
        : db.select().from(chatReactions).where(inArray(chatReactions.messageId, messageIds)),
    /** The messages these replies quote, from the same meeting only. */
    quoted: (meetingId: string, ids: string[]) =>
      ids.length === 0
        ? Promise.resolve([])
        : db
            .select()
            .from(chatMessages)
            .where(and(eq(chatMessages.meetingId, meetingId), inArray(chatMessages.id, ids))),
    pinnedIds: async (meetingId: string, executor: Executor = db) =>
      (
        await executor
          .select({ id: chatPins.messageId })
          .from(chatPins)
          .where(eq(chatPins.meetingId, meetingId))
          .orderBy(chatPins.createdAt)
      ).map((row) => row.id),
  };
}

export type ChatActionsRepository = ReturnType<typeof createChatActionsRepository>;
