// Rings of chat calls: database access only (F15 design 3.3, 3.4). Only a row still ringing changes, so
// the first answer wins (TC-F15-13); everything else reads or adds rows.
import { callRings, type Call, type Executor } from "@meetapp/db";
export type { CallRing } from "@meetapp/db";
import { and, asc, eq, lte, type SQL } from "drizzle-orm";

type RingEnd = "accepted" | "declined" | "missed" | "cancelled";

/** Ends ringing rows that match: only rows still ringing change, so the first answer wins (TC-F15-13). */
function stopRinging(executor: Executor, where: SQL | undefined, state: RingEnd, at: Date) {
  return executor
    .update(callRings)
    .set({ state, answeredAt: at })
    .where(and(eq(callRings.state, "ringing"), where))
    .returning();
}

/** One person's ring in a call: only they may answer it (TC-F15-74). */
async function ringOf(executor: Executor, callId: string, userId: string) {
  const [row] = await executor
    .select()
    .from(callRings)
    .where(and(eq(callRings.callId, callId), eq(callRings.userId, userId)))
    .orderBy(asc(callRings.rangAt));
  return row;
}

async function latestRings(executor: Executor, callId: string) {
  const rows = await executor
    .select({ userId: callRings.userId, state: callRings.state })
    .from(callRings)
    .where(eq(callRings.callId, callId))
    .orderBy(asc(callRings.rangAt));
  return new Map(rows.map((row) => [row.userId, row.state]));
}

function ringingFor(executor: Executor, userId: string) {
  return executor
    .select()
    .from(callRings)
    .where(and(eq(callRings.userId, userId), eq(callRings.state, "ringing")));
}

function reopenRing(executor: Executor, ringId: string) {
  return executor
    .update(callRings)
    .set({ state: "ringing", answeredAt: null })
    .where(and(eq(callRings.id, ringId), eq(callRings.state, "accepted")));
}

export function createCallRingsRepository(executor: Executor) {
  return {
    /** One ringing row per person rung (F15 design 3.3); delivery is the ring targets' job (T4). */
    ring: async (tx: Executor, call: Call, userIds: string[]) => {
      if (userIds.length === 0) return [];
      return tx
        .insert(callRings)
        .values(userIds.map((userId) => ({ workspaceId: call.workspaceId, callId: call.id, userId })))
        .returning();
    },
    ringOf: (callId: string, userId: string) => ringOf(executor, callId, userId),
    /** One ring's answer, if it is still ringing. */
    stopRing: (ringId: string, state: RingEnd, at: Date) => stopRinging(executor, eq(callRings.id, ringId), state, at),
    /** An accept whose join failed: the ring sounds again, so the person can try again (T-fix-3). */
    reopenRing: (ringId: string) => reopenRing(executor, ringId),
    /** Every ring of a call still ringing (cancel, end, timeout). */
    stopCallRings: (callId: string, state: RingEnd, at: Date) =>
      stopRinging(executor, eq(callRings.callId, callId), state, at),
    /** Ringing rows of a call (or any call) rung at or before `before`: they stop as missed (AC-F15-08, 19). */
    stopRingsBefore: (before: Date, at: Date, callId?: string) =>
      stopRinging(
        executor,
        and(lte(callRings.rangAt, before), callId ? eq(callRings.callId, callId) : undefined),
        "missed",
        at,
      ),
    /** The rings still sounding for a person (a window opened while ringing gets them, TC-F15-44). */
    ringingFor: (userId: string) => ringingFor(executor, userId),
    /** A person rung who starts or joins the call themselves has answered (AC-F15-26). */
    answeredByJoining: (tx: Executor, callId: string, userId: string, at: Date) =>
      tx
        .update(callRings)
        .set({ state: "accepted", answeredAt: at })
        .where(and(eq(callRings.callId, callId), eq(callRings.userId, userId), eq(callRings.state, "ringing")))
        .returning(),
    /** Each person's latest ring in this call (the Add people panel: ringing, declined, …). */
    latestRings: (callId: string) => latestRings(executor, callId),
    /** People still being rung in this call. */
    ringingIn: async (callId: string) =>
      (
        await executor
          .select({ userId: callRings.userId })
          .from(callRings)
          .where(and(eq(callRings.callId, callId), eq(callRings.state, "ringing")))
      ).map((row) => row.userId),
  };
}
