// Chat file records (F03 design.md section 6 and 4; F14 AC-19). A chat's total (a meeting's 500 MB, a
// one-to-one or group chat's 2 GB) is counted with the conversation row locked, so two uploads at once
// can't both slip under it; unsent files count too (AC-F03-34).
import { chatAttachments, conversations, type ChatAttachment, type Database, type Executor } from "@meetapp/db";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { isWho, type Who } from "./chat-who.ts";

const uploader = { attendanceId: chatAttachments.uploaderAttendanceId, userId: chatAttachments.uploaderUserId };

export type NewAttachment = typeof chatAttachments.$inferInsert;

/** Gives files to a message: only this sender's ready, unsent files of this meeting. */
export async function claimAttachments(
  tx: Executor,
  claim: { ids: string[]; messageId: string; conversationId: string; uploader: Who },
): Promise<boolean> {
  if (claim.ids.length === 0) return true;
  const claimed = await tx
    .update(chatAttachments)
    .set({ messageId: claim.messageId })
    .where(
      and(
        inArray(chatAttachments.id, claim.ids),
        eq(chatAttachments.conversationId, claim.conversationId),
        isWho(uploader, claim.uploader),
        eq(chatAttachments.status, "ready"),
        isNull(chatAttachments.messageId),
      ),
    )
    .returning({ id: chatAttachments.id });
  return claimed.length === new Set(claim.ids).size;
}

export function createChatFilesRepository(db: Database) {
  return {
    /** A new upload's record, or "full" when the chat's files would pass `maxBytes`. */
    reserve: (
      attachment: NewAttachment & { conversationId: string },
      maxBytes: number,
    ): Promise<ChatAttachment | "full"> =>
      db.transaction(async (tx) => {
        const { conversationId } = attachment;
        await tx.execute(sql`select 1 from ${conversations} where ${conversations.id} = ${conversationId} for update`);
        const [used] = await tx
          .select({ bytes: sql<number>`coalesce(sum(${chatAttachments.sizeBytes}), 0)::bigint` })
          .from(chatAttachments)
          .where(and(eq(chatAttachments.conversationId, conversationId), ne(chatAttachments.status, "deleted")));
        if (Number(used?.bytes ?? 0) + attachment.sizeBytes > maxBytes) return "full";
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
    byId: async (conversationId: string, id: string): Promise<ChatAttachment | undefined> => {
      const [row] = await db
        .select()
        .from(chatAttachments)
        .where(and(eq(chatAttachments.conversationId, conversationId), eq(chatAttachments.id, id)));
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
