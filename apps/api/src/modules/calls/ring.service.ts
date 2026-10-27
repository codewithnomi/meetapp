// Ringing for calls from chats (F15 design 3.3, 3.4; AC-F15-05–09, 34, D075). The backend owns each ring:
// it is sent to every ring target of the person, the first answer wins (only a ringing row changes), and
// every window stops together. A person may answer only their own ring, and only while still in the chat.
import type { Call, CallRing } from "@meetapp/db";
import { CHAT_CALL_LIMITS, type RingMessage } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { notFound, type CallsDeps } from "./admission.ts";
import type { ChatCallsRepository } from "./chat-calls.repository.ts";
import type { ChatCallsService, ChatPlace } from "./chat-calls.service.ts";
import type { RingTarget } from "./ring-targets.ts";
import { addPeople } from "./add-people.service.ts";

export interface RingDeps {
  calls: CallsDeps;
  chatCalls: ChatCallsRepository;
  place: (userId: string, conversationId: string) => Promise<ChatPlace>;
  targets: RingTarget;
  /** "Missed call from <caller>", for the person who missed it (AC-F15-15). */
  missed: (
    conversation: { id: string; workspaceId: string },
    caller: { id: string; name: string },
    callId: string,
    forUserId: string,
  ) => Promise<void>;
  /** Joins the chat's running call (the chat-calls service). */
  join: ChatCallsService["join"];
}

const over = () => new AppError(409, "RING_OVER", "This call has ended.");

/** What every window of a called person shows (TC-F15-10). */
export function ringMessage(caller: ChatPlace, call: Call, ring: CallRing): RingMessage {
  const group = caller.conversation.kind === "group";
  return {
    t: "ring",
    callId: call.id,
    conversationId: caller.conversation.id,
    from: { userId: caller.me.id, name: caller.me.name, photoUrl: caller.me.photoUrl },
    media: call.media ?? "video",
    groupName: group ? (caller.conversation.name ?? caller.title) : null,
    expiresAt: new Date(ring.rangAt.getTime() + CHAT_CALL_LIMITS.ringSeconds * 1000).toISOString(),
  };
}

/** The person's ring in a chat call, with the chat checked now (removed people get 404, AC-F15-20). */
async function ownRing(deps: RingDeps, userId: string, callId: string) {
  const call = await deps.chatCalls.byId(callId);
  const ring = call ? await deps.chatCalls.ringOf(callId, userId) : undefined;
  if (!call?.conversationId || !ring) throw notFound();
  const place = await deps.place(userId, call.conversationId);
  return { call, ring, place };
}

async function accept(deps: RingDeps, userId: string, callId: string) {
  const { ring } = await ownRing(deps, userId, callId);
  const [won] = await deps.chatCalls.stopRing(ring.id, "accepted", deps.calls.now());
  if (!won) throw over();
  await deps.targets.stop(userId, callId, "accepted");
  // The caller's "Calling…" screen moves into the call (F15 design 2.2).
  const starter = await deps.chatCalls.starterOf(callId);
  if (starter?.userId && starter.userId !== userId) await deps.targets.stop(starter.userId, callId, "accepted");
  return deps.join(userId, callId);
}

/** Ends a one-to-one call nobody else is in (decline or no answer, AC-F15-07, 08). */
async function endCall(deps: RingDeps, call: Call) {
  if (await deps.calls.events.endCall(call.id, "ended", deps.calls.now())) {
    await deps.calls.livekit.deleteRoom(call.id).catch(() => undefined);
  }
}

async function decline(deps: RingDeps, userId: string, callId: string) {
  const { call, ring, place } = await ownRing(deps, userId, callId);
  const [stopped] = await deps.chatCalls.stopRing(ring.id, "declined", deps.calls.now());
  if (!stopped) throw over();
  await deps.targets.stop(userId, callId, "declined");
  const starter = await deps.chatCalls.starterOf(callId);
  if (starter?.userId)
    await deps.missed(place.conversation, { id: starter.userId, name: starter.name }, callId, userId);
  if (place.conversation.kind !== "direct") return;
  // One-to-one: the call ends, and the caller's screen shows "declined".
  await endCall(deps, call);
  if (starter?.userId) await deps.targets.stop(starter.userId, callId, "declined");
}

/** The caller's **Cancel**: every ring stops and counts as missed (AC-F15-09). Only the starter may. */
async function cancel(deps: RingDeps, userId: string, callId: string) {
  const call = await deps.chatCalls.byId(callId);
  const starter = await deps.chatCalls.starterOf(callId);
  if (!call?.conversationId || starter?.userId !== userId) throw notFound();
  const place = await deps.place(userId, call.conversationId);
  const stopped = await deps.chatCalls.stopCallRings(callId, "cancelled", deps.calls.now());
  for (const row of stopped) {
    await deps.targets.stop(row.userId, callId, "cancelled");
    await deps.missed(place.conversation, { id: userId, name: place.me.name }, callId, row.userId);
  }
}

/** Sends a new call's rings to every target of each person rung. */
async function sendRings(deps: RingDeps, caller: ChatPlace, call: Call, rings: CallRing[]) {
  await Promise.all(rings.map((ring) => deps.targets.ring(ring.userId, ringMessage(caller, call, ring))));
}

/** Rings still sounding for a person, for a window that opens meanwhile (TC-F15-44). */
async function ringingFor(deps: RingDeps, userId: string): Promise<RingMessage[]> {
  const messages: RingMessage[] = [];
  const now = deps.calls.now().getTime();
  for (const ring of await deps.chatCalls.ringingFor(userId)) {
    if (now - ring.rangAt.getTime() >= CHAT_CALL_LIMITS.ringSeconds * 1000) continue;
    const call = await deps.chatCalls.byId(ring.callId);
    const starter = await deps.chatCalls.starterOf(ring.callId);
    if (!call?.conversationId || !starter?.userId) continue;
    const caller = await deps.place(starter.userId, call.conversationId).catch(() => undefined);
    if (caller) messages.push(ringMessage(caller, call, ring));
  }
  return messages;
}

export function createRingService(deps: RingDeps) {
  const service = {
    accept: (userId: string, callId: string) => accept(deps, userId, callId),
    decline: (userId: string, callId: string) => decline(deps, userId, callId),
    cancel: (userId: string, callId: string) => cancel(deps, userId, callId),
    sendRings: (caller: ChatPlace, call: Call, rings: CallRing[]) => sendRings(deps, caller, call, rings),
    ringingFor: (userId: string) => ringingFor(deps, userId),
    /** Add people (add-people.service.ts). */
    addPeople: (userId: string, callId: string, userIds: string[]) =>
      addPeople(deps, service, { userId, callId, userIds }),
  };
  return service;
}

export type RingService = ReturnType<typeof createRingService>;
