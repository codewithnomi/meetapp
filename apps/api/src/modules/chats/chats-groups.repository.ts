// Group chat storage (F14 design.md 3.6; AC-F14-14–18): adding people with their history start,
// removing and leaving (with the last news number they may read), renaming, and the group's size.
// Database access only.
import { type Database, conversationMembers, conversations, workspaces, type ConversationMember } from "@meetapp/db";
import { and, eq, inArray, sql } from "drizzle-orm";

export interface GroupAddition {
  userId: string;
  external: boolean;
  historyFrom: Date;
}

/** Adds (or brings back) people; accepted members join at once, external people get a request. */
function add(db: Database, conversation: { id: string; workspaceId: string }, people: GroupAddition[], by: string) {
  if (people.length === 0) return Promise.resolve();
  const now = new Date();
  const rows = people.map((p) => ({
    conversationId: conversation.id,
    workspaceId: conversation.workspaceId,
    userId: p.userId,
    external: p.external,
    state: (p.external ? "pending" : "accepted") as ConversationMember["state"],
    historyFrom: p.historyFrom,
    addedBy: by,
    joinedAt: p.external ? null : now,
    requestedAt: p.external ? now : null,
  }));
  return db
    .insert(conversationMembers)
    .values(rows)
    .onConflictDoUpdate({
      target: [conversationMembers.conversationId, conversationMembers.userId],
      set: {
        state: sql`excluded.state`,
        external: sql`excluded.external`,
        historyFrom: sql`excluded.history_from`,
        addedBy: sql`excluded.added_by`,
        joinedAt: sql`excluded.joined_at`,
        requestedAt: sql`excluded.requested_at`,
        leftSeq: null,
        hidden: false,
        updatedAt: now,
      },
    });
}

/** People in the group or asked to join: what counts toward the 250 (AC-F14-15). */
async function size(db: Database, conversationId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(conversationMembers)
    .where(
      and(
        eq(conversationMembers.conversationId, conversationId),
        inArray(conversationMembers.state, ["accepted", "pending"]),
      ),
    );
  return row?.n ?? 0;
}

export function createChatsGroupsRepository(db: Database) {
  return {
    add: (conversation: { id: string; workspaceId: string }, people: GroupAddition[], by: string) =>
      add(db, conversation, people, by),
    size: (conversationId: string) => size(db, conversationId),
    workspaceKind: async (workspaceId: string) => {
      const [row] = await db.select({ kind: workspaces.kind }).from(workspaces).where(eq(workspaces.id, workspaceId));
      return row?.kind ?? "company";
    },
    /** Removed or left: they keep reading up to `leftSeq` (AC-F14-18). */
    stop: (conversationId: string, userId: string, state: "left" | "removed", leftSeq: number) =>
      db
        .update(conversationMembers)
        .set({ state, leftSeq })
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId))),
    rename: (conversationId: string, name: string) =>
      db.update(conversations).set({ name }).where(eq(conversations.id, conversationId)),
    /** The last member left: the clean-up deletes it, its messages and files within 30 days. */
    markDeleted: (conversationId: string) =>
      db.update(conversations).set({ deletedAt: new Date() }).where(eq(conversations.id, conversationId)),
    accepted: async (conversationId: string) => {
      const [row] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(conversationMembers)
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.state, "accepted")));
      return row?.n ?? 0;
    },
  };
}

export type ChatsGroupsRepository = ReturnType<typeof createChatsGroupsRepository>;
