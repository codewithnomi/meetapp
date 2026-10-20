// What the after-meeting chat needs to know (F03 design.md 3.1 and 3.8): who took part in a meeting,
// whether anyone was removed, and the chat setting at the end of its latest call. Database access only.
import { callAttendances, calls, type CallAttendance, type Database } from "@meetapp/db";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";

export function createChatAfterRepository(db: Database) {
  return {
    /** The person's joins of this meeting's calls: let in, not lobby-only visits. */
    joinsOf: (meetingId: string, userId: string): Promise<CallAttendance[]> =>
      db
        .select()
        .from(callAttendances)
        .where(
          and(
            eq(callAttendances.meetingId, meetingId),
            eq(callAttendances.userId, userId),
            isNotNull(callAttendances.admittedAt),
          ),
        )
        .orderBy(desc(callAttendances.admittedAt)),
    /** The latest ended call's setting, or undefined while a call runs or before any ended. */
    afterState: async (meetingId: string) => {
      const [running] = await db
        .select({ id: calls.id })
        .from(calls)
        .where(and(eq(calls.meetingId, meetingId), isNull(calls.endedAt)));
      if (running) return undefined;
      const [last] = await db
        .select({ mode: calls.chatModeAtEnd })
        .from(calls)
        .where(and(eq(calls.meetingId, meetingId), isNotNull(calls.endedAt)))
        .orderBy(desc(calls.endedAt))
        .limit(1);
      return last ? { mode: last.mode ?? "on" } : undefined;
    },
  };
}

export type ChatAfterRepository = ReturnType<typeof createChatAfterRepository>;
