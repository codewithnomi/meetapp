// A meeting's record (F02 design.md section 3.7, AC-F02-41): its calls and who took part, with join and
// leave times. Database access only; the service decides who may read it.
import { callAttendances, calls, type Executor } from "@meetapp/db";
import { and, asc, eq, isNotNull, inArray } from "drizzle-orm";

export function createRecordRepository(executor: Executor) {
  return {
    /** Took part: got into one of the meeting's calls. */
    tookPart: async (meetingId: string, userId: string): Promise<boolean> => {
      const [row] = await executor
        .select({ id: callAttendances.id })
        .from(callAttendances)
        .where(
          and(
            eq(callAttendances.meetingId, meetingId),
            eq(callAttendances.userId, userId),
            isNotNull(callAttendances.joinedAt),
          ),
        )
        .limit(1);
      return row !== undefined;
    },
    calls: (meetingId: string) =>
      executor.select().from(calls).where(eq(calls.meetingId, meetingId)).orderBy(asc(calls.startedAt)),
    participants: (callIds: string[]) =>
      callIds.length === 0
        ? Promise.resolve([])
        : executor
            .select({
              callId: callAttendances.callId,
              name: callAttendances.displayName,
              group: callAttendances.participantGroup,
              joinedAt: callAttendances.joinedAt,
              leftAt: callAttendances.leftAt,
            })
            .from(callAttendances)
            .where(and(inArray(callAttendances.callId, callIds), isNotNull(callAttendances.joinedAt)))
            .orderBy(asc(callAttendances.joinedAt)),
  };
}

export type RecordRepository = ReturnType<typeof createRecordRepository>;
