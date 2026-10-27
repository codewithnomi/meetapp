// Puts calls from chats together (F15, D072, D075): F02's call pieces, F14's membership rules and notes,
// and ringing through the ring targets (today the live line).
import type { Database } from "@meetapp/db";
import type { CallsDeps } from "./modules/calls/admission.ts";
import { createChatCallsRepository, type ChatCallsRepository } from "./modules/calls/chat-calls.repository.ts";
import { createChatCallsService, type ChatPlace } from "./modules/calls/chat-calls.service.ts";
import { createCallEndService } from "./modules/calls/call-end.service.ts";
import { createCallRemovalService } from "./modules/calls/call-removal.service.ts";
import { createRingService } from "./modules/calls/ring.service.ts";
import { allTargets, liveLineTarget, type RingTarget } from "./modules/calls/ring-targets.ts";
import type { ChatRepository } from "./modules/chat/chat.repository.ts";
import { seatIn, type MessagesDeps } from "./modules/chats/chats-messages.service.ts";
import { saveNote } from "./modules/chats/chats-notes.ts";
import { AppError } from "./plugins/errors.ts";

const photoOf = (p: { userId: string; avatarKey: string | null }) =>
  p.avatarKey ? `/api/v1/users/${p.userId}/avatar?v=${p.avatarKey}` : null;

/** The chat as the person may call in it now: F14's sending rules, and never before a request is accepted. */
async function placeOf(messagesDeps: MessagesDeps, userId: string, conversationId: string): Promise<ChatPlace> {
  const { conversation, people, seat, other } = await seatIn(messagesDeps, userId, conversationId, "send");
  // A one-to-one chat whose request isn't accepted yet allows a few messages, never a call (AC-F15-02).
  if (other && other.state !== "accepted") {
    throw new AppError(403, "CHAT_READ_ONLY", "You can call once they accept your chat request.");
  }
  const me = people.find((p) => p.userId === userId);
  const others = people.filter((p) => p.userId !== userId && p.state === "accepted");
  return {
    conversation: {
      id: conversation.id,
      workspaceId: conversation.workspaceId,
      kind: conversation.kind === "direct" ? "direct" : "group",
      name: conversation.name,
    },
    me: { id: userId, name: seat.name, external: seat.group === "external", photoUrl: me ? photoOf(me) : null },
    title: conversation.name ?? others.map((p) => p.name).join(", "),
    members: people.map((p) => ({ userId: p.userId, name: p.name, state: p.state })),
  };
}

/** Ending chat calls and their notes ("Missed call", "Call ended"). */
function endingFor(wiring: {
  calls: CallsDeps;
  chatCalls: ChatCallsRepository;
  targets: RingTarget;
  notes: { chat: ChatRepository; live: MessagesDeps["live"] };
  messagesDeps: MessagesDeps;
}) {
  const { calls, chatCalls, targets, notes, messagesDeps } = wiring;
  const nameOf = async (userId: string) => (await messagesDeps.messages.person(userId))?.name ?? "";
  const chatOf = (call: { conversationId: string | null; workspaceId: string }) => ({
    id: call.conversationId ?? "",
    workspaceId: call.workspaceId,
  });
  return createCallEndService({
    calls,
    chatCalls,
    targets,
    missed: async (call, callerId, forUserId) =>
      saveNote(
        notes,
        chatOf(call),
        { id: callerId, name: await nameOf(callerId) },
        {
          event: "call_missed",
          callId: call.id,
          forUserId,
        },
      ),
    endedNote: async (call, seconds, people) => {
      const starter = await chatCalls.starterOf(call.id);
      const names = await Promise.all(people.map(nameOf));
      await saveNote(
        notes,
        chatOf(call),
        { id: starter?.userId ?? people[0] ?? "", name: starter?.name ?? "" },
        {
          event: "call_ended",
          callId: call.id,
          seconds,
          names,
        },
      );
    },
  });
}

export function chatCallsFor(wiring: {
  db: Database;
  calls: CallsDeps;
  chat: ChatRepository;
  messagesDeps: MessagesDeps;
}) {
  const { db, calls, chat, messagesDeps } = wiring;
  const chatCalls = createChatCallsRepository(db);
  const place = (userId: string, conversationId: string) => placeOf(messagesDeps, userId, conversationId);
  const notes = { chat, live: messagesDeps.live };
  const targets = allTargets([liveLineTarget(messagesDeps.live)]);
  const rings = createRingService({
    calls,
    chatCalls,
    place,
    targets,
    missed: (conversation, caller, callId, forUserId) =>
      saveNote(notes, conversation, caller, { event: "call_missed", callId, forUserId }),
    join: (userId, callId) => service.join(userId, callId),
  });
  const service = createChatCallsService({
    calls,
    chatCalls,
    place,
    rang: (caller, call, made) => rings.sendRings(caller, call, made),
    note: (at, note) => saveNote(notes, at.conversation, { id: at.me.id, name: at.me.name }, note),
  });
  const ending = endingFor({ calls, chatCalls, targets, notes, messagesDeps });
  // The F02 webhook, jobs and clean-up tell chat calls what happened (meeting calls ignore it).
  calls.chatCallHooks = ending;
  const removal = createCallRemovalService({ calls, chatCalls, targets, left: (callId) => ending.left(callId) });
  return { chatCalls: service, rings, callEnd: ending, removal };
}
