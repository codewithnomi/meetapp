// Poll storage (F03 design.md 3.7). A poll is a chat message with its question and answers; votes
// are kept under a keyed hash of the voter. Anonymous votes keep no person and no time (AC-F03-22).
import {
  chatMessages,
  chatPollOptions,
  chatPolls,
  chatPollVotes,
  user,
  type ChatPoll,
  type Database,
  type Executor,
} from "@meetapp/db";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { recordEvent } from "./chat.repository.ts";
import type { NewChatMessage } from "./chat.repository.ts";
import { meetingConversation, meetingOf } from "./meeting-conversation.repository.ts";
import type { Who } from "./chat-who.ts";

export interface NewPoll {
  message: NewChatMessage;
  question: string;
  options: string[];
  multiple: boolean;
  anonymous: boolean;
  creator: Who;
}

export interface Ballot {
  voterKey: string;
  /** Who voted, kept only for polls that show names; null for anonymous polls. */
  voter: Who | null;
  optionIds: string[];
}

/** The same poll sent again (same sender and clientId): the saved one, with nothing new to announce. */
async function repeated(tx: Executor, message: NewChatMessage) {
  const [saved] = await tx
    .select({ message: chatMessages, poll: chatPolls })
    .from(chatMessages)
    .innerJoin(chatPolls, eq(chatPolls.messageId, chatMessages.id))
    .where(
      and(
        message.senderAttendanceId
          ? eq(chatMessages.senderAttendanceId, message.senderAttendanceId)
          : and(isNull(chatMessages.senderAttendanceId), eq(chatMessages.senderUserId, message.senderUserId ?? "")),
        eq(chatMessages.clientId, message.clientId),
      ),
    );
  if (!saved) throw new Error("poll neither saved nor found");
  return { ...saved, seq: undefined };
}

async function create(db: Database, poll: NewPoll) {
  return db.transaction(async (tx) => {
    const conversationId =
      poll.message.conversationId ??
      (await meetingConversation(
        tx,
        poll.message.workspaceId,
        meetingOf({ meetingId: poll.message.meetingId ?? null }),
      ));
    const [message] = await tx
      .insert(chatMessages)
      .values({ ...poll.message, conversationId })
      .onConflictDoNothing()
      .returning();
    if (!message) return repeated(tx, poll.message);
    const [row] = await tx
      .insert(chatPolls)
      .values({
        workspaceId: message.workspaceId,
        meetingId: message.meetingId,
        conversationId: message.conversationId,
        messageId: message.id,
        question: poll.question,
        multiple: poll.multiple,
        anonymous: poll.anonymous,
        creatorAttendanceId: poll.creator.attendanceId,
        creatorUserId: poll.creator.userId,
      })
      .returning();
    if (!row) throw new Error("no poll row");
    await tx.insert(chatPollOptions).values(poll.options.map((text, position) => ({ pollId: row.id, position, text })));
    const seq = await recordEvent(tx, message, "message_created", { id: message.id });
    return { message, poll: row, seq };
  });
}

/** Replaces the voter's earlier choice; refused once closed (the poll row is locked meanwhile). */
async function vote(db: Database, poll: ChatPoll, ballot: Ballot): Promise<PollChange | "closed"> {
  return db.transaction(async (tx) => {
    const [open] = await tx
      .select()
      .from(chatPolls)
      .where(and(eq(chatPolls.id, poll.id), isNull(chatPolls.closedAt)))
      .for("update");
    if (!open) return "closed";
    await tx
      .delete(chatPollVotes)
      .where(and(eq(chatPollVotes.pollId, poll.id), eq(chatPollVotes.voterKey, ballot.voterKey)));
    // Anonymous: the shared time columns get the poll's start, so a vote can't be matched with a join time.
    const times = poll.anonymous ? { createdAt: poll.createdAt, updatedAt: poll.createdAt } : {};
    await tx.insert(chatPollVotes).values(
      ballot.optionIds.map((optionId) => ({
        pollId: poll.id,
        optionId,
        voterKey: ballot.voterKey,
        attendanceId: ballot.voter?.attendanceId ?? null,
        voterUserId: ballot.voter?.userId ?? null,
        ...times,
      })),
    );
    return bump(tx, poll);
  });
}

/** A poll's change: its news number and its new version, read back from the database (two votes at once get two). */
export interface PollChange {
  seq: number;
  version: number;
}

async function bump(tx: Executor, poll: ChatPoll): Promise<PollChange> {
  const [row] = await tx
    .update(chatPolls)
    .set({ version: sql`${chatPolls.version} + 1` })
    .where(eq(chatPolls.id, poll.id))
    .returning({ version: chatPolls.version });
  const version = row?.version ?? poll.version + 1;
  const seq = await recordEvent(tx, poll, "poll_changed", { id: poll.messageId, pollId: poll.id, version });
  return { seq, version };
}

export function createChatPollsRepository(db: Database) {
  return {
    create: (poll: NewPoll) => create(db, poll),
    vote: (poll: ChatPoll, ballot: Ballot) => vote(db, poll, ballot),
    byId: async (conversationId: string, pollId: string): Promise<ChatPoll | undefined> => {
      const [row] = await db
        .select()
        .from(chatPolls)
        .where(and(eq(chatPolls.conversationId, conversationId), eq(chatPolls.id, pollId)));
      return row;
    },
    /** Closes an open poll; undefined when it was already closed. */
    close: (poll: ChatPoll) =>
      db.transaction(async (tx) => {
        const closed = await tx
          .update(chatPolls)
          .set({ closedAt: new Date() })
          .where(and(eq(chatPolls.id, poll.id), isNull(chatPolls.closedAt)))
          .returning();
        return closed.length === 0 ? undefined : bump(tx, poll);
      }),
    options: (pollId: string) =>
      db
        .select()
        .from(chatPollOptions)
        .where(eq(chatPollOptions.pollId, pollId))
        .orderBy(asc(chatPollOptions.position)),
    /** Names of chat voters and creators (accounts), for polls that show names. */
    userNames: async (userIds: string[]) =>
      userIds.length === 0
        ? new Map<string, string>()
        : new Map(
            (await db.select({ id: user.id, name: user.name }).from(user).where(inArray(user.id, userIds))).map(
              (row) => [row.id, row.name] as const,
            ),
          ),
    votes: (pollId: string) => db.select().from(chatPollVotes).where(eq(chatPollVotes.pollId, pollId)),
    /** The poll of each poll message, for message views. */
    byMessages: (messageIds: string[]) =>
      messageIds.length === 0
        ? Promise.resolve([])
        : db
            .select({ id: chatPolls.id, messageId: chatPolls.messageId })
            .from(chatPolls)
            .where(inArray(chatPolls.messageId, messageIds)),
  };
}

export type ChatPollsRepository = ReturnType<typeof createChatPollsRepository>;

export type { ChatPoll } from "@meetapp/db";
