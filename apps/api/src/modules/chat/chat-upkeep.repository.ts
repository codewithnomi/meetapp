// Chat upkeep (F03 design.md sections 3.4, 4 and 6): clean-up of old news and unused files, a deleted
// account's chat (AC-F03-44), and a person's chat for a data request. Database access only.
import {
  callAttendances,
  chatAttachments,
  chatEvents,
  conversationMembers,
  chatMessages,
  chatPollVotes,
  chatReactions,
  type Database,
  type Executor,
} from "@meetapp/db";
import { and, eq, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";

const DELETED_USER = "Deleted user";
/** Rows filled per step, so one fill never holds a long lock (design 4, "order of the change"). */
const FILL_BATCH = 5_000;
const FILLED_TABLES = ["chat_messages", "chat_events", "chat_pins", "chat_polls", "chat_attachments"] as const;

/**
 * F14 step 2 (D065): every meeting gets its conversation and every meeting chat row its `conversation_id`.
 * Safe to stop and run again; returns how many rows it filled (0 once everything is filled).
 */
async function fillConversations(db: Database): Promise<number> {
  await db.execute(sql`
    insert into conversations (workspace_id, kind, meeting_id)
    select m.workspace_id, 'meeting', m.id from meetings m
    where not exists (select 1 from conversations c where c.meeting_id = m.id)
    on conflict (meeting_id) do nothing`);
  let filled = 0;
  for (const table of FILLED_TABLES) {
    for (;;) {
      const done = await db.execute(sql`
        update ${sql.identifier(table)} t set conversation_id = c.id, updated_at = now()
        from conversations c
        where c.meeting_id = t.meeting_id
          and t.id in (select id from ${sql.identifier(table)} where conversation_id is null and meeting_id is not null limit ${FILL_BATCH})`);
      const count = done.rowCount ?? 0;
      filled += count;
      if (count < FILL_BATCH) break;
    }
  }
  return filled;
}

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
    fillConversations: () => fillConversations(db),
    /** F14: chat requests not answered in 30 days are tidied away (AC-F14-12; reads hide them already). */
    expireRequests: (before: Date) =>
      db
        .update(conversationMembers)
        .set({ state: "declined", updatedAt: new Date() })
        .where(and(eq(conversationMembers.state, "pending"), lt(conversationMembers.requestedAt, before))),
    /** Catch-up news is kept a day (design 3.4). */
    /**
     * Old news goes, except each meeting's newest piece: news numbers continue from it and never start
     * again at 1 during a long call (verification round 1).
     */
    forgetEventsBefore: (before: Date) =>
      db
        .delete(chatEvents)
        .where(
          and(
            lt(chatEvents.createdAt, before),
            sql`${chatEvents.seq} < (select max(e.seq) from ${chatEvents} e where e.meeting_id = ${chatEvents.meetingId})`,
          ),
        ),
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
