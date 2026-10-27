// Meeting tables (F02 design.md section 4, D054). The rules that must never break are kept by the
// database itself: one running call per meeting, at most 10 co-organizers, one ticket per attendance,
// and the link and passcode stored only encrypted, with keyed hashes for lookups.
import { sql } from "drizzle-orm";
import {
  check,
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { conversations } from "./conversations.ts";
import { id, moment, timestamps } from "./columns.ts";
import { workspaces } from "./workspaces.ts";

export const meetingKind = pgEnum("meeting_kind", ["meet_now", "link"]);
/** Who skips the lobby, and who presents (AC-F02-16, AC-F02-36): the same three choices. */
export const meetingAudience = pgEnum("meeting_audience", ["everyone", "workspace", "organizers"]);
export const callEndReason = pgEnum("call_end_reason", ["last_left", "ended", "time_limit"]);
export const participantGroup = pgEnum("participant_group", ["member", "external", "guest"]);
export const roleOverride = pgEnum("role_override", ["presenter", "attendee"]);
export const attendanceStatus = pgEnum("attendance_status", [
  "waiting",
  "admitted",
  "in_call",
  "left",
  "denied",
  "removed",
  "timed_out",
  "turned_away",
]);
/** Meeting chat setting (AC-F03-35–38): on, only during the call, or off. */
export const chatMode = pgEnum("chat_mode", ["on", "in_meeting", "off"]);
export const leftReason = pgEnum("left_reason", ["leave", "dropped", "removed", "ended", "locked", "guests_off"]);

const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

export const meetings = pgTable(
  "meetings",
  {
    id: id(),
    workspaceId: workspaceRef(),
    organizerId: uuid("organizer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: meetingKind("kind").notNull(),
    title: text("title").notNull(),
    /** 12 digits, first not 0; shown to people, so it is not a secret on its own. */
    meetingNumber: text("meeting_number").notNull().unique(),
    /** Keyed hash of the link's secret part: lookups never search by the secret itself. */
    linkLookup: text("link_lookup").notNull().unique(),
    /** The link's secret part, encrypted (AES-256-GCM), so Meeting info can show it again. */
    linkSecretEnc: text("link_secret_enc").notNull(),
    /** Keyed hash of meeting number + passcode. */
    passcodeCheck: text("passcode_check").notNull(),
    passcodeEnc: text("passcode_enc").notNull(),
    keyVersion: integer("key_version").notNull(),
    lobbyBypass: meetingAudience("lobby_bypass").notNull().default("workspace"),
    whoCanPresent: meetingAudience("who_can_present").notNull().default("everyone"),
    allowAttendeeMic: boolean("allow_attendee_mic").notNull().default(true),
    allowAttendeeCamera: boolean("allow_attendee_camera").notNull().default(true),
    chatMode: chatMode("chat_mode").notNull().default("on"),
    expiresAt: moment("expires_at").notNull(),
    ...timestamps(),
  },
  (table) => [
    index("meetings_workspace_id_idx").on(table.workspaceId),
    index("meetings_organizer_id_idx").on(table.organizerId),
    index("meetings_expires_at_idx").on(table.expiresAt),
  ],
);

/** Named by the organizer; at most 10 per meeting (a trigger in migration 0003 keeps the limit). */
export const meetingCoOrganizers = pgTable(
  "meeting_co_organizers",
  {
    id: id(),
    meetingId: uuid("meeting_id")
      .notNull()
      .references(() => meetings.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps(),
  },
  (table) => [
    unique("meeting_co_organizers_once").on(table.meetingId, table.userId),
    index("meeting_co_organizers_user_id_idx").on(table.userId),
  ],
);

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

/** Call-server events already handled, so a repeated one changes nothing; kept one day. */
export const livekitEvents = pgTable("livekit_events", {
  id: id(),
  eventId: text("event_id").notNull().unique(),
  ...timestamps(),
});

export type Meeting = typeof meetings.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type CallAttendance = typeof callAttendances.$inferSelect;
