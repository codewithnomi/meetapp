// Sign-in tables used by Better Auth (F01 design.md sections 3 and 7). Their names and fields follow
// Better Auth's core schema (user, session, account, verification), with database-made UUIDs, times
// with time zone, and our own user fields. Better Auth reads and writes them; our code reads `user`.
import { boolean, integer, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { id, moment, timestamps } from "./columns.ts";

export const user = pgTable("user", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  /** Set by Better Auth from Google/Microsoft; never shown directly (design.md section 6). */
  image: text("image"),
  termsVersion: text("terms_version"),
  termsAcceptedAt: moment("terms_accepted_at"),
  ageConfirmedAt: moment("age_confirmed_at"),
  theme: text("theme"),
  accent: text("accent"),
  /** The workspace the app opens next time; checked against membership when read. */
  lastWorkspaceId: uuid("last_workspace_id"),
  /** Names the current photo in storage (avatars/<userId>/<avatarKey>.webp); empty means initials. */
  avatarKey: text("avatar_key"),
  /** Shares and sees "Seen" in chats (F14 AC-F14-24, as in Teams); a person can turn it off. */
  readReceipts: boolean("read_receipts").notNull().default(true),
  /** F15: the incoming-call ringtone (1–5) and its volume (0–100), kept with the account (AC-F15-32). */
  ringtone: integer("ringtone").notNull().default(1),
  ringVolume: integer("ring_volume").notNull().default(70),
  ...timestamps(),
});

export const session = pgTable(
  "session",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: moment("expires_at").notNull(),
    // Better Auth writes these; F01 keeps them empty (design.md section 3, privacy).
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** "credential" (email and password), "google" or "microsoft". */
    providerId: text("provider_id").notNull(),
    accountId: text("account_id").notNull(),
    /** scrypt hash, for "credential" only. */
    password: text("password"),
    // Google/Microsoft tokens, stored encrypted (security rule S8).
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: moment("access_token_expires_at"),
    refreshTokenExpiresAt: moment("refresh_token_expires_at"),
    scope: text("scope"),
    ...timestamps(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

/** Email codes (stored hashed) and other short-lived checks. */
export const verification = pgTable(
  "verification",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: moment("expires_at").notNull(),
    ...timestamps(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export type User = typeof user.$inferSelect;
