// Statuses set by hand (F04 design 3.3, 4): `manual_status` and when it runs out, on the account.
// Database access only.
import { type Database, user } from "@meetapp/db";
import type { ManualStatus } from "@meetapp/contracts";
import { and, inArray, isNotNull, lte, eq } from "drizzle-orm";

export interface ManualStatusRow {
  status: ManualStatus;
  until: Date | null;
}

export function createManualStatusRepository(db: Database) {
  return {
    /** The hand-set statuses of these people (whether run out or not; the status rule decides). */
    read: async (userIds: string[]): Promise<Map<string, ManualStatusRow>> => {
      if (userIds.length === 0) return new Map();
      const rows = await db
        .select({ id: user.id, status: user.manualStatus, until: user.manualStatusUntil })
        .from(user)
        .where(and(inArray(user.id, userIds), isNotNull(user.manualStatus)));
      return new Map(rows.map((row) => [row.id, { status: row.status as ManualStatus, until: row.until }]));
    },
    set: (userId: string, row: ManualStatusRow | null) =>
      db
        .update(user)
        .set({ manualStatus: row?.status ?? null, manualStatusUntil: row?.until ?? null })
        .where(eq(user.id, userId)),
    /** Clears the person's status if it has run out by `now` (a later one set meanwhile stays). */
    clearIfOver: (userId: string, now: Date) =>
      db
        .update(user)
        .set({ manualStatus: null, manualStatusUntil: null })
        .where(and(eq(user.id, userId), lte(user.manualStatusUntil, now))),
  };
}

export type ManualStatusRepository = ReturnType<typeof createManualStatusRepository>;
