// Workspace tables (F01 design.md sections 5 and 7). The rules that must never break are kept by the
// database itself: one owner per workspace, one personal workspace per user, one pending invitation
// per email and one pending request per person, and invitations can't make anyone the owner.
import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgEnum, pgTable, text, unique, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { id, moment, timestamps } from "./columns.ts";

export const workspaceKind = pgEnum("workspace_kind", ["personal", "company"]);
export const memberRole = pgEnum("member_role", ["owner", "admin", "member"]);
export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "declined",
  "cancelled",
  "replaced",
]);
export const joinVia = pgEnum("join_via", ["link", "code"]);
export const joinRequestStatus = pgEnum("join_request_status", ["pending", "approved", "rejected", "expired"]);

/** The person a row is about: the row goes when their account goes. */
const userRef = (name: string) => uuid(name).references(() => user.id, { onDelete: "cascade" });
/** Who did something: the history stays (as "unknown") when their account goes. */
const actorRef = (name: string) => uuid(name).references(() => user.id, { onDelete: "set null" });

export const workspaces = pgTable(
  "workspaces",
  {
    id: id(),
    name: text("name").notNull(),
    kind: workspaceKind("kind").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    joinEnabled: boolean("join_enabled").notNull().default(false),
    /** The join link and code, encrypted (AES-256-GCM); members must be able to copy them again. */
    joinSecretEnc: text("join_secret_enc"),
    joinKeyVersion: integer("join_key_version"),
    /** Keyed hash used to look the join code up, so the database is never searched by the secret. */
    joinLookupHmac: text("join_lookup_hmac").unique(),
    /** The same for the join link (the column above is the code's). */
    joinLinkHmac: text("join_link_hmac").unique(),
    /** Guests (no account) may join this workspace's meetings (F02, AC-F02-40); owner and admins decide. */
    allowGuests: boolean("allow_guests").notNull().default(true),
    /** GIFs in meeting chat (AC-F03-27). */
    allowGifs: boolean("allow_gifs").notNull().default(true),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("workspaces_one_personal_per_user")
      .on(table.createdBy)
      .where(sql`${table.kind} = 'personal'`),
  ],
);

const workspaceRef = () =>
  uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" });

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: userRef("user_id").notNull(),
    role: memberRole("role").notNull(),
    ...timestamps(),
  },
  (table) => [
    unique("workspace_members_once").on(table.workspaceId, table.userId),
    uniqueIndex("workspace_members_one_owner")
      .on(table.workspaceId)
      .where(sql`${table.role} = 'owner'`),
    index("workspace_members_user_id_idx").on(table.userId),
  ],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    workspaceId: workspaceRef(),
    /** Trimmed and lower-cased. */
    email: text("email").notNull(),
    role: memberRole("role").notNull(),
    /** SHA-256 of the link's token; the token itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    invitedBy: actorRef("invited_by"),
    status: invitationStatus("status").notNull().default("pending"),
    expiresAt: moment("expires_at").notNull(),
    ...timestamps(),
  },
  (table) => [
    check("invitations_never_owner", sql`${table.role} <> 'owner'`),
    uniqueIndex("invitations_one_pending")
      .on(table.workspaceId, table.email)
      .where(sql`${table.status} = 'pending'`),
    index("invitations_email_idx").on(table.email),
  ],
);

export const joinRequests = pgTable(
  "join_requests",
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: userRef("user_id").notNull(),
    via: joinVia("via").notNull(),
    status: joinRequestStatus("status").notNull().default("pending"),
    decidedBy: actorRef("decided_by"),
    decidedAt: moment("decided_at"),
    ...timestamps(),
  },
  (table) => [
    uniqueIndex("join_requests_one_pending")
      .on(table.workspaceId, table.userId)
      .where(sql`${table.status} = 'pending'`),
    index("join_requests_user_id_idx").on(table.userId),
  ],
);

/** History of removals, used for the "removed earlier" badge on requests to join. */
export const memberRemovals = pgTable(
  "member_removals",
  {
    id: id(),
    workspaceId: workspaceRef(),
    userId: userRef("user_id").notNull(),
    removedBy: actorRef("removed_by"),
    ...timestamps(),
  },
  (table) => [index("member_removals_workspace_user_idx").on(table.workspaceId, table.userId)],
);

export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
