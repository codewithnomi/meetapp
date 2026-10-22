// Chat requests and blocking storage (F14 design.md 3.7; AC-F14-10–13, 27): requests waiting for a
// person, their previews, blocks, the 30-day wait after a deleted request, and the outside-chat setting.
// Database access only.
import {
  type Database,
  callAttendances,
  chatBlocks,
  chatMessages,
  chatRequestCooldowns,
  conversationMembers,
  conversations,
  user,
  workspaceMembers,
  workspaces,
  type ConversationMember,
} from "@meetapp/db";
import { and, asc, eq, gt, gte, inArray, isNull, ne, or, sql } from "drizzle-orm";

/** Requests waiting for this person, sent after `since` (older ones have expired, AC-F14-12). */
function pendingFor(db: Database, userId: string, since: Date) {
  return db
    .select({
      conversation: conversations,
      member: conversationMembers,
      from: { userId: user.id, name: user.name, email: user.email, avatarKey: user.avatarKey },
    })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .innerJoin(user, eq(user.id, conversationMembers.addedBy))
    .where(
      and(
        eq(conversationMembers.userId, userId),
        eq(conversationMembers.state, "pending"),
        gt(conversationMembers.requestedAt, since),
        isNull(conversations.deletedAt),
      ),
    )
    .orderBy(asc(conversationMembers.requestedAt));
}

/** Messages of these conversations a pending person may preview (from their `history_from`). */
function previews(db: Database, rows: { conversationId: string; historyFrom: Date }[]) {
  if (rows.length === 0) return Promise.resolve([]);
  return db
    .select({
      conversationId: chatMessages.conversationId,
      senderName: chatMessages.senderName,
      plainText: chatMessages.plainText,
      kind: chatMessages.kind,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(
      or(
        ...rows.map((row) =>
          and(
            eq(chatMessages.conversationId, row.conversationId),
            gte(chatMessages.createdAt, row.historyFrom),
            isNull(chatMessages.deletedAt),
            ne(chatMessages.kind, "system"),
          ),
        ),
      ),
    )
    .orderBy(asc(chatMessages.createdAt));
}

type StateChange = Partial<Pick<ConversationMember, "state" | "joinedAt" | "requestedAt">>;

function setState(db: Database, conversationId: string, userId: string, change: StateChange) {
  return db
    .update(conversationMembers)
    .set(change)
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
}

/** Blocks between this person and any of `others`, either way. */
async function blocksBetween(db: Database, userId: string, others: string[]) {
  if (others.length === 0) return [];
  return db
    .select({ blockerId: chatBlocks.blockerId, blockedId: chatBlocks.blockedId })
    .from(chatBlocks)
    .where(
      or(
        and(eq(chatBlocks.blockerId, userId), inArray(chatBlocks.blockedId, others)),
        and(eq(chatBlocks.blockedId, userId), inArray(chatBlocks.blockerId, others)),
      ),
    );
}

function blockedBy(db: Database, blockerId: string) {
  return db
    .select({ userId: user.id, name: user.name, avatarKey: user.avatarKey })
    .from(chatBlocks)
    .innerJoin(user, eq(user.id, chatBlocks.blockedId))
    .where(eq(chatBlocks.blockerId, blockerId))
    .orderBy(asc(user.name));
}

/** How many team workspaces the two people share (colleagues can't be blocked, AC-F14-13). */
async function sharedTeamWorkspaces(db: Database, a: string, b: string) {
  const theirs = db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, b));
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, a),
        ne(workspaces.kind, "personal"),
        inArray(workspaceMembers.workspaceId, theirs),
      ),
    );
  return row?.n ?? 0;
}

/** Whether a person can get requests from outside (AC-F14-27, as in Teams): they have no team
 * workspace, or at least one of them allows outside chat. */
async function reachableFromOutside(db: Database, userId: string) {
  const rows = await db
    .select({ allow: workspaces.allowOutsideChat })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(eq(workspaceMembers.userId, userId), ne(workspaces.kind, "personal")));
  return rows.length === 0 || rows.some((row) => row.allow);
}

async function coolingDown(db: Database, fromUser: string, toUser: string, now: Date) {
  const [row] = await db
    .select({ id: chatRequestCooldowns.id })
    .from(chatRequestCooldowns)
    .where(
      and(
        eq(chatRequestCooldowns.fromUser, fromUser),
        eq(chatRequestCooldowns.toUser, toUser),
        gt(chatRequestCooldowns.until, now),
      ),
    );
  return Boolean(row);
}

/** Direct chats with this pair's key in any workspace, with the starter's own row (D065: one per workspace). */
function directsByKey(db: Database, directKey: string, userId: string) {
  return db
    .select({ conversation: conversations, member: conversationMembers })
    .from(conversations)
    .innerJoin(conversationMembers, eq(conversationMembers.conversationId, conversations.id))
    .where(
      and(
        eq(conversations.directKey, directKey),
        eq(conversationMembers.userId, userId),
        isNull(conversations.deletedAt),
      ),
    );
}

/** People whose status `viewer` may see (AC-F14-26): colleagues in shared team workspaces and people in
 * a chat where both have accepted; never anyone blocked either way. */
async function statusAudience(db: Database, viewer: string) {
  const colleagues = await db
    .selectDistinct({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        ne(workspaces.kind, "personal"),
        inArray(
          workspaceMembers.workspaceId,
          db
            .select({ id: workspaceMembers.workspaceId })
            .from(workspaceMembers)
            .where(eq(workspaceMembers.userId, viewer)),
        ),
      ),
    );
  const mine = db
    .select({ id: conversationMembers.conversationId })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.userId, viewer), eq(conversationMembers.state, "accepted")));
  const contacts = await db
    .selectDistinct({ userId: conversationMembers.userId })
    .from(conversationMembers)
    .where(and(inArray(conversationMembers.conversationId, mine), eq(conversationMembers.state, "accepted")));
  const people = new Set([...colleagues, ...contacts].map((row) => row.userId));
  people.delete(viewer);
  const blocks = await blocksBetween(db, viewer, [...people]);
  for (const block of blocks) people.delete(block.blockerId === viewer ? block.blockedId : block.blockerId);
  return people;
}

/** Which of these people are in a call now ("In a meeting", AC-F14-26). */
async function inCall(db: Database, userIds: string[]) {
  if (userIds.length === 0) return new Set<string>();
  const rows = await db
    .selectDistinct({ userId: callAttendances.userId })
    .from(callAttendances)
    .where(and(inArray(callAttendances.userId, userIds), inArray(callAttendances.status, ["admitted", "in_call"])));
  return new Set(rows.flatMap((row) => (row.userId ? [row.userId] : [])));
}

export function createChatsRequestsRepository(db: Database) {
  return {
    pendingFor: (userId: string, since: Date) => pendingFor(db, userId, since),
    previews: (rows: { conversationId: string; historyFrom: Date }[]) => previews(db, rows),
    setState: (conversationId: string, userId: string, change: StateChange) =>
      setState(db, conversationId, userId, change),
    blocksBetween: (userId: string, others: string[]) => blocksBetween(db, userId, others),
    block: (blockerId: string, blockedId: string) =>
      db.insert(chatBlocks).values({ blockerId, blockedId }).onConflictDoNothing(),
    unblock: (blockerId: string, blockedId: string) =>
      db.delete(chatBlocks).where(and(eq(chatBlocks.blockerId, blockerId), eq(chatBlocks.blockedId, blockedId))),
    blockedBy: (blockerId: string) => blockedBy(db, blockerId),
    sharedTeamWorkspaces: (a: string, b: string) => sharedTeamWorkspaces(db, a, b),
    reachableFromOutside: (userId: string) => reachableFromOutside(db, userId),
    allowsOutside: async (workspaceId: string) => {
      const [row] = await db
        .select({ allow: workspaces.allowOutsideChat })
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId));
      return row?.allow ?? false;
    },
    coolDown: (fromUser: string, toUser: string, until: Date) =>
      db
        .insert(chatRequestCooldowns)
        .values({ fromUser, toUser, until })
        .onConflictDoUpdate({
          target: [chatRequestCooldowns.fromUser, chatRequestCooldowns.toUser],
          set: { until, updatedAt: new Date() },
        }),
    statusAudience: (viewer: string) => statusAudience(db, viewer),
    inCall: (userIds: string[]) => inCall(db, userIds),
    exists: async (userId: string) =>
      (await db.select({ id: user.id }).from(user).where(eq(user.id, userId))).length > 0,
    coolingDown: (fromUser: string, toUser: string, now: Date) => coolingDown(db, fromUser, toUser, now),
    directsByKey: (directKey: string, userId: string) => directsByKey(db, directKey, userId),
  };
}

export type ChatsRequestsRepository = ReturnType<typeof createChatsRequestsRepository>;
