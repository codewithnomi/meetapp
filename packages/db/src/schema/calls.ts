// Call tables (F02 design.md section 4; F15 D072): a call and each join belong to a meeting or a chat.
// In their own file so the meeting and chat tables don't depend on each other.
import { sql } from "drizzle-orm";
import { check, type AnyPgColumn, boolean, index, text, uniqueIndex, uuid, pgEnum, pgTable } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { id, moment, timestamps } from "./columns.ts";
import { conversations } from "./conversations.ts";
import {
  attendanceStatus,
  callEndReason,
  chatMode,
  leftReason,
  meetings,
  participantGroup,
  roleOverride,
} from "./meetings.ts";
import { workspaces } from "./workspaces.ts";

const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

/** F15: what a chat call's caller chose (the ring shows it; the camera starts on for video). */
export const callMedia = pgEnum("call_media", ["video", "audio"]);

/**
 * One call: from the first person in until it ends. Its id is the LiveKit room name. It belongs to a
 * meeting (F02) or, from F15, to a chat (D072): exactly one of `meeting_id` and `conversation_id`.
 */
export const calls = pgTable(
  "calls",
  {
    id: id(),
    workspaceId: workspaceRef(),
    meetingId: uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
    /** Chat calls only: video or audio. */
    media: callMedia("media"),
    startedAt: moment("started_at").notNull().defaultNow(),
    endedAt: moment("ended_at"),
    endReason: callEndReason("end_reason"),
    locked: boolean("locked").notNull().default(false),
    /** The chat setting when this call ended: decides who reads its chat afterwards (F03 design 3.8). */
    chatModeAtEnd: chatMode("chat_mode_at_end"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("calls_one_running_per_meeting")
      .on(table.meetingId)
      .where(sql`${table.endedAt} is null`),
    /** One running call per chat: starting again joins it (AC-F15-03, 26). */
    uniqueIndex("calls_one_running_per_conversation")
      .on(table.conversationId)
      .where(sql`${table.endedAt} is null`),
    index("calls_workspace_id_idx").on(table.workspaceId),
    check("calls_meeting_or_conversation", sql`num_nonnulls(${table.meetingId}, ${table.conversationId}) = 1`),
  ],
);

/** One join of one person (two computers = two rows). Its id is the LiveKit identity. */
export const callAttendances = pgTable(
  "call_attendances",
  {
    id: id(),
    workspaceId: workspaceRef(),
    /** A meeting's join (F02), or a chat call's (F15, `conversation_id`): exactly one. */
    meetingId: uuid("meeting_id").references(() => meetings.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id").references(() => conversations.id, { onDelete: "cascade" }),
    /** Empty while waiting before a call exists; set at admission. */
    callId: uuid("call_id").references(() => calls.id, { onDelete: "cascade" }),
    /** Empty for guests; the record keeps the name when an account is deleted. */
    userId: uuid("user_id").references(() => user.id, { onDelete: "set null" }),
    /** The name shown and kept in the record (for guests, the only thing kept). */
    displayName: text("display_name").notNull(),
    /** Guests: HMAC of the meeting id and the app's device key, so one guest's meetings can't be linked. */
    guestDeviceHash: text("guest_device_hash"),
    participantGroup: participantGroup("participant_group").notNull(),
    roleOverride: roleOverride("role_override"),
    status: attendanceStatus("status").notNull().default("waiting"),
    /** SHA-256 of the meeting ticket; the ticket itself is never stored. */
    ticketHash: text("ticket_hash").notNull().unique(),
    lobbyEnteredAt: moment("lobby_entered_at"),
    lastSeenAt: moment("last_seen_at"),
    admittedAt: moment("admitted_at"),
    joinedAt: moment("joined_at"),
    leftAt: moment("left_at"),
    leftReason: leftReason("left_reason"),
    /** The attendance (in this meeting) that admitted, denied or removed this one. */
    actedBy: uuid("acted_by").references((): AnyPgColumn => callAttendances.id, { onDelete: "set null" }),
    /** Time of the newest call-server event applied, so an older one arriving late is ignored. */
    lastEventAt: moment("last_event_at"),
    /** Rejoin after a dropped connection works once (design section 3.8). */
    rejoinedAt: moment("rejoined_at"),
    ...timestamps(),
  },
  (table) => [
    index("call_attendances_meeting_status_idx").on(table.meetingId, table.status),
    index("call_attendances_call_status_idx").on(table.callId, table.status),
    index("call_attendances_user_id_idx").on(table.userId),
    index("call_attendances_workspace_id_idx").on(table.workspaceId),
    index("call_attendances_conversation_id_idx").on(table.conversationId),
    check(
      "call_attendances_meeting_or_conversation",
      sql`num_nonnulls(${table.meetingId}, ${table.conversationId}) = 1`,
    ),
  ],
);

export type Call = typeof calls.$inferSelect;
export type CallAttendance = typeof callAttendances.$inferSelect;
