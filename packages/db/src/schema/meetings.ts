// Meeting tables (F02 design.md section 4, D054). The rules that must never break are kept by the
// database itself: one running call per meeting, at most 10 co-organizers, one ticket per attendance,
// and the link and passcode stored only encrypted, with keyed hashes for lookups.
import { boolean, index, integer, pgEnum, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
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

/** Call-server events already handled, so a repeated one changes nothing; kept one day. */
export const livekitEvents = pgTable("livekit_events", {
  id: id(),
  eventId: text("event_id").notNull().unique(),
  ...timestamps(),
});

export type Meeting = typeof meetings.$inferSelect;
