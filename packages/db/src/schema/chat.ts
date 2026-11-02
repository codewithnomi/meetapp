// In-meeting chat tables (F03 design.md section 4, D060). One chat per meeting; every row carries
// its workspace (S2). Message text, files, reactions and votes go when the meeting is deleted.
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { user } from "./auth.ts";
import { id, moment, timestamps } from "./columns.ts";
import { callAttendances, calls } from "./calls.ts";
import { meetings, participantGroup } from "./meetings.ts";
import { conversations } from "./conversations.ts";
import { workspaces } from "./workspaces.ts";

export const chatMessageKind = pgEnum("chat_message_kind", ["text", "gif", "sticker", "poll", "system"]);
export const chatAttachmentStatus = pgEnum("chat_attachment_status", ["uploading", "ready", "deleted"]);

const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });
/** Meeting chats only; optional since F14 (D065): chats outside meetings have no meeting. */
const meetingRef = () => uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" });
/** The conversation (F14, D065). Filled for every row by the F14 fill step; required in a later migration. */
const conversationRef = () => uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" });
/** F14 chats have no call: the person is their account (migration 0007). */
const personRef = (name: string) => uuid(name).references(() => user.id, { onDelete: "set null" });
const attendanceRef = (name: string) => uuid(name).references(() => callAttendances.id, { onDelete: "set null" });

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: id(),
    workspaceId: workspaceRef(),
    meetingId: meetingRef(),
    conversationId: conversationRef(),
    /** The call it was sent in: edits and own deletes work only while that call runs. */
    callId: uuid("call_id").references(() => calls.id, { onDelete: "set null" }),
    senderAttendanceId: attendanceRef("sender_attendance_id"),
    /** Empty for guests and after the sender's account is deleted. */
    senderUserId: uuid("sender_user_id").references(() => user.id, { onDelete: "set null" }),
    /** The name shown when it was sent; "Deleted user" after account deletion. */
    senderName: text("sender_name").notNull(),
    senderGroup: participantGroup("sender_group").notNull(),
    kind: chatMessageKind("kind").notNull(),
    /** The strict message document (design 5.2); empty when deleted. */
    body: jsonb("body"),
    /** The visible text, for limits, Copy text and later search; empty when deleted. */
    plainText: text("plain_text"),
    gif: jsonb("gif"),
    sticker: text("sticker"),
    system: jsonb("system"),
    replyToId: uuid("reply_to_id").references((): AnyPgColumn => chatMessages.id, { onDelete: "set null" }),
    /** Made by the app; a repeat send with the same one returns the saved message. */
    clientId: uuid("client_id").notNull(),
    editedAt: moment("edited_at"),
    deletedAt: moment("deleted_at"),
    deletedByAttendanceId: attendanceRef("deleted_by_attendance_id"),
    deletedByUserId: personRef("deleted_by_user_id"),
    /** Chats: people @mentioned in the message (AC-F14-22), for "mentioned" in the chat list. */
    mentionedUserIds: uuid("mentioned_user_ids").array(),
    ...timestamps(),
  },
  (table) => [
    index("chat_messages_meeting_order_idx").on(table.meetingId, table.createdAt, table.id),
    index("chat_messages_conversation_order_idx").on(table.conversationId, table.createdAt, table.id),
    unique("chat_messages_sent_once").on(table.senderAttendanceId, table.clientId),
    // Chats: the same account sends a client id once (meeting messages are kept once per join above).
    uniqueIndex("chat_messages_sent_once_by_user")
      .on(table.senderUserId, table.clientId)
      .where(sql`${table.senderAttendanceId} is null`),
    index("chat_messages_sender_user_id_idx").on(table.senderUserId),
    index("chat_messages_reply_to_id_idx").on(table.replyToId),
    index("chat_messages_workspace_id_idx").on(table.workspaceId),
  ],
);

export const chatAttachments = pgTable(
  "chat_attachments",
  {
    id: id(),
    workspaceId: workspaceRef(),
    meetingId: meetingRef(),
    conversationId: conversationRef(),
    /** Empty until the message is sent; unsent files are deleted after an hour. */
    messageId: uuid("message_id").references(() => chatMessages.id, { onDelete: "set null" }),
    uploaderAttendanceId: attendanceRef("uploader_attendance_id"),
    uploaderUserId: personRef("uploader_user_id"),
    fileName: text("file_name").notNull(),
    /** From the content check, never from the name. */
    mediaType: text("media_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    previewKey: text("preview_key"),
    width: integer("width"),
    height: integer("height"),
    status: chatAttachmentStatus("status").notNull().default("uploading"),
    ...timestamps(),
  },
  (table) => [
    index("chat_attachments_conversation_id_idx").on(table.conversationId),
    index("chat_attachments_meeting_id_idx").on(table.meetingId),
    index("chat_attachments_message_id_idx").on(table.messageId),
    index("chat_attachments_status_created_idx").on(table.status, table.createdAt),
    index("chat_attachments_workspace_id_idx").on(table.workspaceId),
  ],
);

export const chatReactions = pgTable(
  "chat_reactions",
  {
    id: id(),
    workspaceId: workspaceRef(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    /** Meeting chats: the join that reacted. Chats: empty, `user_id` instead. */
    attendanceId: uuid("attendance_id").references(() => callAttendances.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    reactorName: text("reactor_name").notNull(),
    ...timestamps(),
  },
  (table) => [
    unique("chat_reactions_once").on(table.messageId, table.attendanceId, table.emoji),
    uniqueIndex("chat_reactions_once_by_user").on(table.messageId, table.userId, table.emoji),
    index("chat_reactions_attendance_id_idx").on(table.attendanceId),
    index("chat_reactions_user_id_idx").on(table.userId),
    index("chat_reactions_workspace_id_idx").on(table.workspaceId),
  ],
);

/** At most 3 per meeting, checked with the meeting row locked (migration 0005). */
export const chatPins = pgTable(
  "chat_pins",
  {
    id: id(),
    workspaceId: workspaceRef(),
    meetingId: meetingRef(),
    conversationId: conversationRef(),
    messageId: uuid("message_id")
      .notNull()
      .unique()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    pinnedByAttendanceId: attendanceRef("pinned_by_attendance_id"),
    pinnedByUserId: personRef("pinned_by_user_id"),
    ...timestamps(),
  },
  (table) => [
    index("chat_pins_conversation_id_idx").on(table.conversationId),
    index("chat_pins_meeting_id_idx").on(table.meetingId),
    index("chat_pins_workspace_id_idx").on(table.workspaceId),
  ],
);

export const chatPolls = pgTable(
  "chat_polls",
  {
    id: id(),
    workspaceId: workspaceRef(),
    meetingId: meetingRef(),
    conversationId: conversationRef(),
    messageId: uuid("message_id")
      .notNull()
      .unique()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    multiple: boolean("multiple").notNull(),
    anonymous: boolean("anonymous").notNull(),
    creatorAttendanceId: attendanceRef("creator_attendance_id"),
    creatorUserId: personRef("creator_user_id"),
    closedAt: moment("closed_at"),
    /** Goes up with every vote, so apps know when to fetch the results again. */
    version: integer("version").notNull().default(0),
    ...timestamps(),
  },
  (table) => [
    index("chat_polls_conversation_id_idx").on(table.conversationId),
    index("chat_polls_meeting_id_idx").on(table.meetingId),
    index("chat_polls_workspace_id_idx").on(table.workspaceId),
  ],
);

export const chatPollOptions = pgTable(
  "chat_poll_options",
  {
    id: id(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => chatPolls.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    ...timestamps(),
  },
  (table) => [unique("chat_poll_options_position").on(table.pollId, table.position)],
);

/**
 * One row per chosen answer. `voter_key` is a keyed hash of the poll and the voter, never the person.
 * For anonymous polls `attendance_id` stays empty and no time is kept (the shared columns are set to
 * the poll's start by the service, so vote times can't be matched with join times).
 */
export const chatPollVotes = pgTable(
  "chat_poll_votes",
  {
    id: id(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => chatPolls.id, { onDelete: "cascade" }),
    optionId: uuid("option_id")
      .notNull()
      .references(() => chatPollOptions.id, { onDelete: "cascade" }),
    voterKey: text("voter_key").notNull(),
    attendanceId: uuid("attendance_id").references(() => callAttendances.id, { onDelete: "cascade" }),
    /** Chats: the voter's account, only for polls that show names (empty for anonymous ones). */
    voterUserId: uuid("voter_user_id").references(() => user.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (table) => [
    index("chat_poll_votes_voter_user_id_idx").on(table.voterUserId),
    unique("chat_poll_votes_once").on(table.pollId, table.optionId, table.voterKey),
    index("chat_poll_votes_voter_idx").on(table.pollId, table.voterKey),
    index("chat_poll_votes_attendance_id_idx").on(table.attendanceId),
  ],
);

/** Recent chat news, numbered per meeting, for catching up after a reconnect; kept one day. */
export const chatEvents = pgTable(
  "chat_events",
  {
    id: id(),
    workspaceId: workspaceRef(),
    meetingId: meetingRef(),
    conversationId: conversationRef(),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull(),
    ...timestamps(),
  },
  (table) => [
    unique("chat_events_seq").on(table.meetingId, table.seq),
    unique("chat_events_conversation_seq").on(table.conversationId, table.seq),
    index("chat_events_created_at_idx").on(table.createdAt),
    index("chat_events_workspace_id_idx").on(table.workspaceId),
  ],
);

export type ChatMessage = typeof chatMessages.$inferSelect;
export type ChatAttachment = typeof chatAttachments.$inferSelect;
export type ChatPoll = typeof chatPolls.$inferSelect;
