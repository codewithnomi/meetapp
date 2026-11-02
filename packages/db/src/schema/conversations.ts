// Chats (F14 design.md section 4, D065): one conversation model for one-to-one, group and meeting chats.
// Every row carries its workspace (S2). A conversation's messages, reactions, pins, polls and files are
// F03's tables, which point here with `conversation_id`.
import { boolean, index, integer, pgEnum, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { id, moment, timestamps } from "./columns.ts";
import { meetings } from "./meetings.ts";
import { workspaces } from "./workspaces.ts";

export const conversationKind = pgEnum("conversation_kind", ["direct", "group", "meeting"]);
export const conversationMemberState = pgEnum("conversation_member_state", [
  "accepted",
  "pending",
  "declined",
  "left",
  "removed",
]);

const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });
const userRef = (name: string) =>
  uuid(name)
    .notNull()
    .references(() => user.id, { onDelete: "cascade" });

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    workspaceId: workspaceRef(),
    kind: conversationKind("kind").notNull(),
    /** Meeting chats: the meeting (one conversation per meeting). */
    meetingId: uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" }),
    /** Group chats: the name (1–80), or empty to show the members' names. */
    name: text("name"),
    /** Direct chats: the two user ids in order ("a:b"), unique per workspace (AC-F14-09). */
    directKey: text("direct_key"),
    createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
    /** Orders the chat list (AC-F14-01). */
    lastMessageAt: moment("last_message_at"),
    /** A group whose last member left: removed with its files by the daily job (AC-F14-18). */
    deletedAt: moment("deleted_at"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("conversations_meeting_unique").on(table.meetingId),
    uniqueIndex("conversations_direct_unique").on(table.workspaceId, table.directKey),
    index("conversations_workspace_order_idx").on(table.workspaceId, table.lastMessageAt),
  ],
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    workspaceId: workspaceRef(),
    state: conversationMemberState("state").notNull(),
    /** Not a member of the conversation's workspace: shown "(External)", listed in their Personal. */
    external: boolean("external").notNull().default(false),
    /** What they may read: messages from this time on (AC-F14-17). */
    historyFrom: moment("history_from"),
    /** After leaving or removal: the last news number they may still read (AC-F14-18). */
    leftSeq: integer("left_seq"),
    /** When they left or were removed: they read messages up to this moment (AC-F14-18). */
    leftAt: moment("left_at"),
    addedBy: uuid("added_by").references(() => user.id, { onDelete: "set null" }),
    joinedAt: moment("joined_at"),
    /** When a chat request was sent (pending; 30-day expiry, AC-F14-12). */
    requestedAt: moment("requested_at"),
    pinnedAt: moment("pinned_at"),
    muted: boolean("muted").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("conversation_members_unique").on(table.conversationId, table.userId),
    index("conversation_members_user_idx").on(table.userId, table.state),
    index("conversation_members_workspace_id_idx").on(table.workspaceId),
  ],
);

/** Each person's "read up to here" mark (unread counts and "Seen", AC-F14-02, 24). */
export const conversationReads = pgTable(
  "conversation_reads",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    userId: userRef("user_id"),
    workspaceId: workspaceRef(),
    lastReadSeq: integer("last_read_seq").notNull().default(0),
    lastReadAt: moment("last_read_at"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("conversation_reads_unique").on(table.conversationId, table.userId),
    index("conversation_reads_user_idx").on(table.userId),
    index("conversation_reads_workspace_id_idx").on(table.workspaceId),
  ],
);

/** Blocked external people (AC-F14-13). Belongs to people, not to a workspace. */
export const chatBlocks = pgTable(
  "chat_blocks",
  {
    id: id(),
    blockerId: userRef("blocker_id"),
    blockedId: userRef("blocked_id"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("chat_blocks_unique").on(table.blockerId, table.blockedId),
    index("chat_blocks_blocked_idx").on(table.blockedId),
  ],
);

/** After a deleted request: no new request to the same person for 30 days (AC-F14-11). */
export const chatRequestCooldowns = pgTable(
  "chat_request_cooldowns",
  {
    id: id(),
    fromUser: userRef("from_user"),
    toUser: userRef("to_user"),
    until: moment("until").notNull(),
    ...timestamps(),
  },
  (table) => [uniqueIndex("chat_request_cooldowns_unique").on(table.fromUser, table.toUser)],
);

export type Conversation = typeof conversations.$inferSelect;
export type ConversationMember = typeof conversationMembers.$inferSelect;
