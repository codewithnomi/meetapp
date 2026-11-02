// Leaving a chat ends one's place in its call (F15 design 3.7; AC-F15-25). When someone leaves or is
// removed from a chat or its workspace, or deletes their account, their seats leave the running call at
// once (the call server is told) and their ring stops; if they started the call, everyone's ring stops.
// The ending rules then run as for anyone who left.
import type { Call } from "./calls.repository.ts";
import type { CallsDeps } from "./admission.ts";
import type { ChatCallsRepository } from "./chat-calls.repository.ts";
import type { RingTarget } from "./ring-targets.ts";

export interface RemovalDeps {
  calls: CallsDeps;
  chatCalls: ChatCallsRepository;
  targets: RingTarget;
  /** The ending rules (call-end.service.ts). */
  left: (callId: string) => Promise<void>;
}

async function takeOut(deps: RemovalDeps, call: Call, userId: string) {
  const now = deps.calls.now();
  const change = { status: "removed" as const, leftReason: "removed" as const, actedBy: null, leftAt: now };
  for (const seat of await deps.calls.attendances.presentIn(call.id)) {
    if (seat.userId !== userId) continue;
    if (await deps.calls.attendances.move(seat.id, ["admitted", "in_call"], change)) {
      await deps.calls.livekit.remove(call.id, seat.id).catch(() => undefined);
    }
  }
  const ring = await deps.chatCalls.ringOf(call.id, userId);
  if (ring && (await deps.chatCalls.stopRing(ring.id, "cancelled", now)).length > 0) {
    await deps.targets.stop(userId, call.id, "cancelled");
  }
  // The caller is gone: nobody is rung on their behalf any more.
  if ((await deps.chatCalls.starterOf(call.id))?.userId === userId) {
    for (const stopped of await deps.chatCalls.stopCallRings(call.id, "cancelled", now)) {
      await deps.targets.stop(stopped.userId, call.id, "cancelled");
    }
  }
  await deps.left(call.id);
}

/** Someone left or was removed from this chat. */
async function leftChat(deps: RemovalDeps, conversationId: string, userId: string) {
  const call = await deps.chatCalls.running(conversationId);
  if (call) await takeOut(deps, call, userId);
}

/** An account is being deleted: out of every running chat call it is in or rung for. */
async function forgetPerson(deps: RemovalDeps, userId: string) {
  for (const call of await deps.chatCalls.runningCallsOf(userId)) await takeOut(deps, call, userId);
}

export function createCallRemovalService(deps: RemovalDeps) {
  return {
    leftChat: (conversationId: string, userId: string) => leftChat(deps, conversationId, userId),
    forgetPerson: (userId: string) => forgetPerson(deps, userId),
  };
}
