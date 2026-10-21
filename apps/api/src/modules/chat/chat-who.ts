// Who did something in a chat (F14 migration 0007): a join of a call in meeting chats, an account in
// one-to-one and group chats. Rows keep one or the other.
import { eq, type Column } from "drizzle-orm";

export type Who = { attendanceId: string; userId: null } | { attendanceId: null; userId: string };

/** The row's person column that matches `who`. */
export const isWho = (columns: { attendanceId: Column; userId: Column }, who: Who) =>
  who.attendanceId !== null ? eq(columns.attendanceId, who.attendanceId) : eq(columns.userId, who.userId);
