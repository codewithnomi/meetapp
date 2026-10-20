// Chat upkeep (F03 design.md sections 3.4, 4 and 6): clean-up of old news and unused files, a deleted
// account's chat (AC-F03-44), and a person's chat for a data request. Database access only.
import {
  callAttendances,
  chatAttachments,
  chatEvents,
  chatMessages,
  chatPollVotes,
  chatReactions,
  type Database,
  type Executor,
} from "@meetapp/db";
import { and, eq, inArray, isNull, lt, ne, or } from "drizzle-orm";

const DELETED_USER = "Deleted user";

const joinsOf = (db: Executor, userId: string) =>
  db.select({ id: callAttendances.id }).from(callAttendances).where(eq(callAttendances.userId, userId));

/** A person's own messages and files, for a data request (privacy-legal.md). */
async function exportFor(db: Database, userId: string) {
  const joins = (await joinsOf(db, userId)).map((join) => join.id);
  const messages = await db
    .select({
      meetingId: chatMessages.meetingId,
      createdAt: chatMessages.createdAt,
      kind: chatMessages.kind,
      text: chatMessages.plainText,
    })
    .from(chatMessages)
    .where(and(eq(chatMessages.senderUserId, userId), isNull(chatMessages.deletedAt)));
  const files =
    joins.length === 0
      ? []
      : await db
          .select({
            id: chatAttachments.id,
            fileName: chatAttachments.fileName,
            storageKey: chatAttachments.storageKey,
          })
          .from(chatAttachments)
          .where(and(inArray(chatAttachments.uploaderAttendanceId, joins), eq(chatAttachments.status, "ready")));
  return { messages, files };
}

/** A deleted account's chat: text and files go, the name becomes "Deleted user" (AC-F03-44). */
function forgetPerson(db: Database, userId: string) {
  return db.transaction(async (tx) => {
    const joins = (await joinsOf(tx, userId)).map((join) => join.id);
    await tx
      .update(chatMessages)
      .set({
        body: null,
        plainText: null,
        gif: null,
        sticker: null,
        senderUserId: null,
        senderName: DELETED_USER,
        deletedAt: new Date(),
      })
      .where(and(eq(chatMessages.senderUserId, userId), ne(chatMessages.kind, "system")));
    if (joins.length === 0) return;
    await tx
      .update(chatAttachments)
      .set({ status: "deleted" })
      .where(inArray(chatAttachments.uploaderAttendanceId, joins));
    await tx.delete(chatReactions).where(inArray(chatReactions.attendanceId, joins));
    // Only named votes can be found; anonymous ones never point to a person.
    await tx.delete(chatPollVotes).where(inArray(chatPollVotes.attendanceId, joins));
  });
}

export function createChatUpkeepRepository(db: Database) {
  return {
    /** Catch-up news is kept a day (design 3.4). */
    forgetEventsBefore: (before: Date) => db.delete(chatEvents).where(lt(chatEvents.createdAt, before)),
    /** Files to remove from storage: deleted ones, and uploads never sent within the hour (AC-F03-34). */
    filesToRemove: (unsentBefore: Date) =>
      db
        .select({
          id: chatAttachments.id,
          storageKey: chatAttachments.storageKey,
          previewKey: chatAttachments.previewKey,
        })
        .from(chatAttachments)
        .where(
          or(
            eq(chatAttachments.status, "deleted"),
            and(isNull(chatAttachments.messageId), lt(chatAttachments.createdAt, unsentBefore)),
          ),
        )
        .limit(500),
    forgetFile: (id: string) => db.delete(chatAttachments).where(eq(chatAttachments.id, id)),
    /** Before a meeting record is deleted (F06/F10): its files are marked, so the clean-up removes them. */
    markMeetingFiles: (meetingId: string) =>
      db.update(chatAttachments).set({ status: "deleted" }).where(eq(chatAttachments.meetingId, meetingId)),
    forgetPerson: (userId: string) => forgetPerson(db, userId),
    exportFor: (userId: string) => exportFor(db, userId),
  };
}

export type ChatUpkeepRepository = ReturnType<typeof createChatUpkeepRepository>;
