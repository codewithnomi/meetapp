// What sending and reading in chats needs from storage (F14 design.md 3.3, 3.5; AC-F14-12, 19, 24):
// a person's name and read-receipt setting, the workspace's GIF switch, how many messages a sender put
// into an unanswered request, and the members' read marks for "Seen". Database access only.
import { type Database, chatMessages, conversationMembers, conversationReads, user, workspaces } from "@meetapp/db";
import { and, eq, gte, isNull, sql } from "drizzle-orm";

async function person(db: Database, userId: string) {
  const [row] = await db
    .select({ name: user.name, readReceipts: user.readReceipts, ringtone: user.ringtone, ringVolume: user.ringVolume })
    .from(user)
    .where(eq(user.id, userId));
  return row;
}

/** Messages this person sent into the chat since `since` (the 10 while a request waits, AC-F14-12). */
async function sentSince(db: Database, conversationId: string, userId: string, since: Date) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        eq(chatMessages.senderUserId, userId),
        isNull(chatMessages.senderAttendanceId),
        sql`${chatMessages.kind} <> 'system'`,
        gte(chatMessages.createdAt, since),
      ),
    );
  return row?.n ?? 0;
}

/** Accepted members with their read-receipt setting and read mark (AC-F14-24). */
function readers(db: Database, conversationId: string) {
  return db
    .select({
      userId: user.id,
      name: user.name,
      readReceipts: user.readReceipts,
      lastReadAt: conversationReads.lastReadAt,
    })
    .from(conversationMembers)
    .innerJoin(user, eq(user.id, conversationMembers.userId))
    .leftJoin(
      conversationReads,
      and(
        eq(conversationReads.conversationId, conversationMembers.conversationId),
        eq(conversationReads.userId, conversationMembers.userId),
      ),
    )
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.state, "accepted")));
}

export function createChatsMessagesRepository(db: Database) {
  return {
    person: (userId: string) => person(db, userId),
    allowGifs: async (workspaceId: string) => {
      const [row] = await db
        .select({ allow: workspaces.allowGifs })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId));
      return row?.allow ?? false;
    },
    sentSince: (conversationId: string, userId: string, since: Date) => sentSince(db, conversationId, userId, since),
    readers: (conversationId: string) => readers(db, conversationId),
    unhide: (conversationId: string) =>
      db
        .update(conversationMembers)
        .set({ hidden: false })
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.hidden, true))),
    setPrefs: (userId: string, prefs: { readReceipts?: boolean; ringtone?: number; ringVolume?: number }) =>
      db.update(user).set(prefs).where(eq(user.id, userId)),
  };
}

export type ChatsMessagesRepository = ReturnType<typeof createChatsMessagesRepository>;
