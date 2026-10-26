// Chats storage (F14 design.md 3.1, 3.5, 4): conversations and their members, the chat list's rows, last
// messages, unread counts, each person's list choices and read marks. Database access only; every query
// is limited to the conversations the service reached for this person (S2).
import {
  type Database,
  type Executor,
  chatMessages,
  conversationMembers,
  conversationReads,
  conversations,
  user,
  workspaceMembers,
  type Conversation,
  type ConversationMember,
} from "@meetapp/db";
import { and, desc, eq, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { inWindows, markRead, type ReadWindow } from "./chats-read-window.ts";

export type { Conversation, ConversationMember };

export interface NewMember {
  userId: string;
  external: boolean;
  state: ConversationMember["state"];
}

/** "a:b" with the two ids in order: one direct chat per pair per workspace (AC-F14-09). */
export const directKeyOf = (a: string, b: string) => [a, b].sort().join(":");

async function addMembers(executor: Executor, conversation: Conversation, members: NewMember[], by: string) {
  if (members.length === 0) return;
  const now = new Date();
  await executor
    .insert(conversationMembers)
    .values(
      members.map((member) => ({
        conversationId: conversation.id,
        workspaceId: conversation.workspaceId,
        userId: member.userId,
        state: member.state,
        external: member.external,
        addedBy: by,
        joinedAt: member.state === "accepted" ? now : null,
        requestedAt: member.state === "pending" ? now : null,
        historyFrom: conversation.createdAt,
      })),
    )
    .onConflictDoNothing();
}

/** The pair's direct chat in this workspace, made if needed; `created` is false when it existed. */
async function direct(db: Database, workspaceId: string, by: string, members: [NewMember, NewMember]) {
  return db.transaction(async (tx) => {
    const directKey = directKeyOf(members[0].userId, members[1].userId);
    const [made] = await tx
      .insert(conversations)
      .values({ workspaceId, kind: "direct", directKey, createdBy: by })
      .onConflictDoNothing({ target: [conversations.workspaceId, conversations.directKey] })
      .returning();
    if (made) await addMembers(tx, made, members, by);
    const [row] = await tx
      .select()
      .from(conversations)
      .where(and(eq(conversations.workspaceId, workspaceId), eq(conversations.directKey, directKey)));
    if (!row) throw new Error("no direct conversation");
    return { conversation: row, created: Boolean(made) };
  });
}

export interface NewGroup {
  workspaceId: string;
  by: string;
  name: string | undefined;
  members: NewMember[];
}

async function group(db: Database, { workspaceId, by, name, members }: NewGroup) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(conversations)
      .values({ workspaceId, kind: "group", name: name ?? null, createdBy: by })
      .returning();
    if (!row) throw new Error("no group conversation");
    await addMembers(tx, row, members, by);
    return row;
  });
}

/** The person's direct and group chats for a list: own workspace's, plus external ones in Personal. */
async function listRows(db: Database, userId: string, workspaceId: string, withExternal: boolean) {
  const inThisWorkspace = and(
    eq(conversations.workspaceId, workspaceId),
    eq(conversationMembers.external, false),
    inArray(conversationMembers.state, ["accepted", "left", "removed"]),
  );
  const externalAccepted = and(eq(conversationMembers.external, true), eq(conversationMembers.state, "accepted"));
  return db
    .select({ conversation: conversations, member: conversationMembers })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(
      and(
        eq(conversationMembers.userId, userId),
        eq(conversationMembers.hidden, false),
        isNull(conversations.deletedAt),
        inArray(conversations.kind, ["direct", "group"]),
        withExternal ? or(inThisWorkspace, externalAccepted) : inThisWorkspace,
      ),
    );
}

/** Each conversation's newest message the person may read (not system notes). */
async function lastMessages(db: Database, windows: ReadWindow[]) {
  if (windows.length === 0) return [];
  return db
    .selectDistinctOn([chatMessages.conversationId], {
      conversationId: chatMessages.conversationId,
      senderUserId: chatMessages.senderUserId,
      senderName: chatMessages.senderName,
      plainText: chatMessages.plainText,
      kind: chatMessages.kind,
      deletedAt: chatMessages.deletedAt,
      createdAt: chatMessages.createdAt,
    })
    .from(chatMessages)
    .where(and(inWindows(windows), ne(chatMessages.kind, "system")))
    .orderBy(chatMessages.conversationId, desc(chatMessages.createdAt));
}

/** Readable messages from others after the person's read mark, per conversation (AC-F14-02). */
async function unreadCounts(db: Database, userId: string, windows: ReadWindow[]) {
  if (windows.length === 0) return [];
  return db
    .select({
      conversationId: chatMessages.conversationId,
      unread: sql<number>`count(*)::int`,
      // Mentioned in an unread message: counted even when the chat is muted (AC-F14-22).
      mentioned: sql<boolean>`coalesce(bool_or(${userId} = any(${chatMessages.mentionedUserIds})), false)`,
    })
    .from(chatMessages)
    .leftJoin(
      conversationReads,
      and(eq(conversationReads.conversationId, chatMessages.conversationId), eq(conversationReads.userId, userId)),
    )
    .where(
      and(
        inWindows(windows),
        ne(chatMessages.kind, "system"),
        isNull(chatMessages.deletedAt),
        or(isNull(chatMessages.senderUserId), ne(chatMessages.senderUserId, userId)),
        or(isNull(conversationReads.lastReadAt), sql`${chatMessages.createdAt} > ${conversationReads.lastReadAt}`),
      ),
    )
    .groupBy(chatMessages.conversationId);
}

/** Members of these conversations with their names and photos (titles and pictures). */
function peopleOf(db: Database, conversationIds: string[]) {
  if (conversationIds.length === 0) return Promise.resolve([]);
  return db
    .select({
      conversationId: conversationMembers.conversationId,
      userId: user.id,
      name: user.name,
      avatarKey: user.avatarKey,
      external: conversationMembers.external,
      state: conversationMembers.state,
      requestedAt: conversationMembers.requestedAt,
    })
    .from(conversationMembers)
    .innerJoin(user, eq(user.id, conversationMembers.userId))
    .where(inArray(conversationMembers.conversationId, conversationIds))
    .orderBy(conversationMembers.joinedAt);
}

/** Which of these people belong to the workspace (the rest are external). */
async function workspaceMemberIds(db: Database, workspaceId: string, userIds: string[]) {
  if (userIds.length === 0) return [];
  const rows = await db
    .select({ userId: workspaceMembers.userId })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.userId, userIds)));
  return rows.map((row) => row.userId);
}

async function member(db: Database, conversationId: string, userId: string) {
  const [row] = await db
    .select({ conversation: conversations, member: conversationMembers })
    .from(conversationMembers)
    .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
    .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId)));
  return row;
}

async function pinnedCount(db: Database, userId: string) {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(conversationMembers)
    .where(and(eq(conversationMembers.userId, userId), isNotNull(conversationMembers.pinnedAt)));
  return row?.n ?? 0;
}

type MyChoices = Partial<Pick<ConversationMember, "pinnedAt" | "muted" | "hidden">>;

/** The one account with exactly this email (case ignored), or nothing (D063). */
async function userByEmail(db: Database, email: string) {
  const [row] = await db
    .select({ userId: user.id, name: user.name, avatarKey: user.avatarKey })
    .from(user)
    .where(sql`lower(${user.email}) = lower(${email})`);
  return row;
}

/** The workspace's people with names and photos, for name suggestions (a workspace is small). */
function workspacePeople(db: Database, workspaceId: string) {
  return db
    .select({ userId: user.id, name: user.name, avatarKey: user.avatarKey })
    .from(workspaceMembers)
    .innerJoin(user, eq(user.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

export function createChatsRepository(db: Database) {
  return {
    direct: (workspaceId: string, by: string, members: [NewMember, NewMember]) => direct(db, workspaceId, by, members),
    group: (newGroup: NewGroup) => group(db, newGroup),
    listRows: (userId: string, workspaceId: string, withExternal: boolean) =>
      listRows(db, userId, workspaceId, withExternal),
    peopleOf: (conversationIds: string[]) => peopleOf(db, conversationIds),
    meetingConversations: (meetingIds: string[]) =>
      meetingIds.length === 0
        ? Promise.resolve([])
        : db.select().from(conversations).where(inArray(conversations.meetingId, meetingIds)),
    lastMessages: (windows: ReadWindow[]) => lastMessages(db, windows),
    unreadCounts: (userId: string, windows: ReadWindow[]) => unreadCounts(db, userId, windows),
    workspaceMemberIds: (workspaceId: string, userIds: string[]) => workspaceMemberIds(db, workspaceId, userIds),
    member: (conversationId: string, userId: string) => member(db, conversationId, userId),
    pinnedCount: (userId: string) => pinnedCount(db, userId),
    readReceipts: async (userId: string) =>
      (await db.select({ on: user.readReceipts }).from(user).where(eq(user.id, userId)))[0]?.on ?? false,
    /** The chats a person is in now, for their live line (D064). */
    activeConversationIds: async (userId: string) =>
      (
        await db
          .select({ id: conversations.id })
          .from(conversationMembers)
          .innerJoin(conversations, eq(conversations.id, conversationMembers.conversationId))
          .where(
            and(
              eq(conversationMembers.userId, userId),
              eq(conversationMembers.state, "accepted"),
              isNull(conversations.deletedAt),
            ),
          )
      ).map((row) => row.id),
    userByEmail: (email: string) => userByEmail(db, email),
    workspacePeople: (workspaceId: string) => workspacePeople(db, workspaceId),
    setMine: (conversationId: string, userId: string, change: MyChoices) =>
      db
        .update(conversationMembers)
        .set(change)
        .where(and(eq(conversationMembers.conversationId, conversationId), eq(conversationMembers.userId, userId))),
    markRead: (mark: { conversationId: string; workspaceId: string; userId: string; seq: number }) =>
      markRead(db, mark),
  };
}

export type ChatsRepository = ReturnType<typeof createChatsRepository>;
