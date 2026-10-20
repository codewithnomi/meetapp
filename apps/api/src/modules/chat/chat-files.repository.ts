// Chat file records (F03 design.md section 6 and 4). The meeting's 500 MB is counted with the meeting
// row locked, so two uploads at once can't both slip under it; unsent files count too (AC-F03-34).
import { chatAttachments, meetings, type ChatAttachment, type Database, type Executor } from "@meetapp/db";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";

/** All the files of one meeting together, sent or not (AC-F03-34). */
const MAX_MEETING_FILE_BYTES = 500 * 1024 * 1024;

export type NewAttachment = typeof chatAttachments.$inferInsert;

/** Gives files to a message: only this sender's ready, unsent files of this meeting. */
export async function claimAttachments(
  tx: Executor,
  claim: { ids: string[]; messageId: string; meetingId: string; uploaderAttendanceId: string },
): Promise<boolean> {
  if (claim.ids.length === 0) return true;
  const claimed = await tx
    .update(chatAttachments)
    .set({ messageId: claim.messageId })
    .where(
      and(
        inArray(chatAttachments.id, claim.ids),
        eq(chatAttachments.meetingId, claim.meetingId),
        eq(chatAttachments.uploaderAttendanceId, claim.uploaderAttendanceId),
        eq(chatAttachments.status, "ready"),
        isNull(chatAttachments.messageId),
      ),
    )
    .returning({ id: chatAttachments.id });
  return claimed.length === new Set(claim.ids).size;
}

export function createChatFilesRepository(db: Database) {
  return {
    /** A new upload's record, or "full" when the meeting's files would pass 500 MB. */
    reserve: (attachment: NewAttachment): Promise<ChatAttachment | "full"> =>
      db.transaction(async (tx) => {
        await tx.execute(sql`select 1 from ${meetings} where ${meetings.id} = ${attachment.meetingId} for update`);
        const [used] = await tx
          .select({ bytes: sql<number>`coalesce(sum(${chatAttachments.sizeBytes}), 0)::bigint` })
          .from(chatAttachments)
          .where(and(eq(chatAttachments.meetingId, attachment.meetingId), ne(chatAttachments.status, "deleted")));
        if (Number(used?.bytes ?? 0) + attachment.sizeBytes > MAX_MEETING_FILE_BYTES) return "full";
        const [row] = await tx.insert(chatAttachments).values(attachment).returning();
        if (!row) throw new Error("no attachment row");
        return row;
      }),
    ready: (id: string, change: Partial<NewAttachment>) =>
      db
        .update(chatAttachments)
        .set({ ...change, status: "ready" })
        .where(eq(chatAttachments.id, id)),
    /** An upload that failed half-way leaves no record. */
    forget: (id: string) => db.delete(chatAttachments).where(eq(chatAttachments.id, id)),
    byId: async (meetingId: string, id: string): Promise<ChatAttachment | undefined> => {
      const [row] = await db
        .select()
        .from(chatAttachments)
        .where(and(eq(chatAttachments.meetingId, meetingId), eq(chatAttachments.id, id)));
      return row;
    },
    /** For the download route, which has only the signed id. */
    anyById: async (id: string): Promise<ChatAttachment | undefined> => {
      const [row] = await db.select().from(chatAttachments).where(eq(chatAttachments.id, id));
      return row;
    },
    /** The sent files of these messages, for building what apps see. */
    ofMessages: (messageIds: string[]) =>
      messageIds.length === 0
        ? Promise.resolve([])
        : db
            .select()
            .from(chatAttachments)
            .where(and(inArray(chatAttachments.messageId, messageIds), eq(chatAttachments.status, "ready"))),
  };
}

export type ChatFilesRepository = ReturnType<typeof createChatFilesRepository>;

export type { ChatAttachment } from "@meetapp/db";
