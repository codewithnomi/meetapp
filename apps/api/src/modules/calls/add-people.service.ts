// Add people during a chat call (F15 design 3.4; AC-F15-13, 14, 22): someone in the call rings members of
// the chat who aren't in it. Only accepted members may be rung (anyone else: 404, nothing rung); people
// already in the call or still ringing are skipped; duplicates ring once; the call holds 20 people; each
// person rung counts toward the caller's 10 a minute.
import { CHAT_CALL_LIMITS } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { notFound } from "./admission.ts";
import { takeCallUnits } from "./call-rate.ts";
import type { RingDeps, RingService } from "./ring.service.ts";

export async function addPeople(
  deps: RingDeps,
  rings: RingService,
  { userId, callId, userIds }: { userId: string; callId: string; userIds: string[] },
) {
  const call = await deps.chatCalls.byId(callId);
  if (!call?.conversationId) throw notFound();
  const place = await deps.place(userId, call.conversationId);
  if (call.endedAt) throw new AppError(409, "CALL_ENDED", "This call has ended.");
  const inCall = await deps.chatCalls.peopleIn(callId);
  if (!inCall.includes(userId)) throw notFound();
  const members = new Set(place.members.filter((m) => m.state === "accepted").map((m) => m.userId));
  const wanted = [...new Set(userIds)];
  if (wanted.some((id) => !members.has(id))) throw notFound();
  const ringing = new Set(await deps.chatCalls.ringingIn(callId));
  const toRing = wanted.filter((id) => !inCall.includes(id) && !ringing.has(id));
  if (toRing.length === 0) return;
  if (inCall.length + ringing.size + toRing.length > CHAT_CALL_LIMITS.people) {
    throw new AppError(409, "CALL_FULL", "This call is full.");
  }
  await takeCallUnits(deps.calls.limiter, userId, toRing.length);
  const made = await deps.chatCalls.ring(deps.chatCalls.reader, call, toRing);
  await rings.sendRings(place, call, made);
}
