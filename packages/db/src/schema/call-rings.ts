// Ringing for calls from chats (F15 design 3.3, 3.4): one row per person rung per call. The backend owns
// the state and the 30-second clock; each device only shows it (D075).
import { index, pgEnum, pgTable, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth.ts";
import { id, moment, timestamps } from "./columns.ts";
import { calls } from "./meetings.ts";
import { workspaces } from "./workspaces.ts";

export const ringState = pgEnum("ring_state", ["ringing", "accepted", "declined", "missed", "cancelled"]);

export const callRings = pgTable(
  "call_rings",
  {
    id: id(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    callId: uuid("call_id")
      .notNull()
      .references(() => calls.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    state: ringState("state").notNull().default("ringing"),
    rangAt: moment("rang_at").notNull().defaultNow(),
    answeredAt: moment("answered_at"),
    ...timestamps(),
  },
  (table) => [
    index("call_rings_call_id_idx").on(table.callId),
    index("call_rings_user_state_idx").on(table.userId, table.state),
    index("call_rings_workspace_id_idx").on(table.workspaceId),
  ],
);

export type CallRing = typeof callRings.$inferSelect;
