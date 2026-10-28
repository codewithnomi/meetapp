// When chat calls end (F15 design 3.3, 3.5; AC-F15-08, 09, 14, 19). A one-to-one call ends once both have
// joined and either leaves; a group call when the last person leaves; a call nobody answered when its
// rings stop (30 seconds, or the caller leaves first). Rings stop at 30 seconds through a job, and the
// every-minute clean-up stops any ring older than 35 seconds, so nothing rings for ever. Every person rung
// who never answered gets one "Missed call"; a call people talked in gets "Call ended".
import type { Call } from "./calls.repository.ts";
import { CHAT_CALL_LIMITS } from "@meetapp/contracts";
import type { CallsDeps } from "./admission.ts";
import type { ChatCallsRepository } from "./chat-calls.repository.ts";
import type { RingStopReason, RingTarget } from "./ring-targets.ts";

/** The safety net: the clean-up stops rings 5 seconds after their own job should have (TC-F15-62). */
const SWEEP_AFTER_MS = (CHAT_CALL_LIMITS.ringSeconds + 5) * 1000;

export interface CallEndDeps {
  calls: CallsDeps;
  chatCalls: ChatCallsRepository;
  targets: RingTarget;
  /** "Missed call from <caller>" for one person (AC-F15-15). */
  missed: (call: Call, callerId: string, forUserId: string) => Promise<void>;
  /** "Call ended · 12m 30s" with the people who talked (AC-F15-15). */
  endedNote: (call: Call, seconds: number, people: string[]) => Promise<void>;
}

/** Stops every listed ring as missed, telling each person's windows and noting it for them. */
async function missedRings(deps: CallEndDeps, call: Call, rings: { userId: string }[], reason: RingStopReason) {
  const starter = await deps.chatCalls.starterOf(call.id);
  for (const ring of rings) {
    await deps.targets.stop(ring.userId, call.id, reason);
    if (starter?.userId) await deps.missed(call, starter.userId, ring.userId);
  }
}

/** Ends the call now (the room goes) and does what an ended call needs. */
async function endNow(deps: CallEndDeps, call: Call) {
  if (!(await deps.calls.events.endCall(call.id, "ended", deps.calls.now()))) return;
  await deps.calls.livekit.deleteRoom(call.id).catch(() => undefined);
  await ended(deps, call.id);
}

/** After any end: rings still sounding stop, and a call people talked in gets its note (once). */
async function ended(deps: CallEndDeps, callId: string) {
  const call = await deps.chatCalls.byId(callId);
  if (!call?.conversationId) return;
  const now = deps.calls.now();
  await missedRings(deps, call, await deps.chatCalls.stopCallRings(callId, "missed", now), "ended");
  const people = await deps.chatCalls.joinedPeople(callId);
  if (people.length < 2 || !(await deps.calls.events.firstTime(`call-ended-note:${callId}`))) return;
  const seconds = Math.round(((call.endedAt ?? now).getTime() - call.startedAt.getTime()) / 1000);
  await deps.endedNote(call, seconds, people);
}

/** Someone's last window left (LiveKit report): the ending rules (AC-F15-09, 14). */
async function left(deps: CallEndDeps, callId: string) {
  const call = await deps.chatCalls.byId(callId);
  if (!call?.conversationId || call.endedAt) return;
  const present = await deps.chatCalls.peopleIn(callId);
  if (present.length === 0) {
    // Nobody left inside (the caller left before anyone answered, or the last one out).
    await missedRings(
      deps,
      call,
      await deps.chatCalls.stopCallRings(callId, "cancelled", deps.calls.now()),
      "cancelled",
    );
    await endNow(deps, call);
    return;
  }
  const oneToOne = (await deps.chatCalls.conversationKind(call.conversationId)) === "direct";
  if (oneToOne && present.length < 2 && (await deps.chatCalls.joinedPeople(callId)).length >= 2)
    await endNow(deps, call);
}

/** Rings at or past their time stop as missed; a call nobody answered ends ("No answer", AC-F15-08). */
async function expire(deps: CallEndDeps, olderThanMs: number, callId?: string) {
  const now = deps.calls.now();
  const stopped = await deps.chatCalls.stopRingsBefore(new Date(now.getTime() - olderThanMs), now, callId);
  for (const id of new Set(stopped.map((ring) => ring.callId))) {
    const call = await deps.chatCalls.byId(id);
    if (!call || call.endedAt) continue;
    await missedRings(
      deps,
      call,
      stopped.filter((ring) => ring.callId === id),
      "missed",
    );
    const answered = (await deps.chatCalls.peopleIn(id)).length >= 2;
    if (answered) continue;
    // Nobody answered: the caller's screen shows "No answer", and the call ends.
    const starter = await deps.chatCalls.starterOf(id);
    if (starter?.userId) await deps.targets.stop(starter.userId, id, "missed");
    await endNow(deps, call);
  }
}

export function createCallEndService(deps: CallEndDeps) {
  return {
    left: (callId: string) => left(deps, callId),
    ended: (callId: string) => ended(deps, callId),
    ringTimeout: (callId: string) => expire(deps, CHAT_CALL_LIMITS.ringSeconds * 1000, callId),
    sweep: () => expire(deps, SWEEP_AFTER_MS),
  };
}
