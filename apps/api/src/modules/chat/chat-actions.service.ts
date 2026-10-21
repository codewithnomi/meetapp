// What people do to messages (F03 design.md 3.5 and 3.6; F14 AC-19, 21): edit and delete (own, or
// any for meeting organizers), react, pin and unpin. Rights are checked on every action by the seat
// (a call's join or a chat's account); each change is saved with its news, then delivered.
import { randomUUID } from "node:crypto";
import { documentPlainText, type MessageDocument } from "@meetapp/contracts";
import type { ChatMessage } from "./chat.repository.ts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import { notFound } from "../calls/admission.ts";
import { invalid, pinnedViews, viewOne, type ChatDeps } from "./chat-access.ts";
import { meetingSeat, seatSender, viewerOf, type ChatSeat } from "./chat-seat.ts";
import { readable } from "./chat.service.ts";
import type { ChatAction } from "./chat.permissions.ts";
import { knownEmoji } from "./emoji.ts";

/** One request about one message: which call, whose ticket, which message. */
export interface OnMessage {
  callId: string;
  ticketHash: string;
  messageId: string;
}

const editEnded = () => new AppError(409, "CHAT_EDIT_ENDED", "This message can no longer be changed.");

/** A message this seat may act on; 404 when it isn't there (or outside what they may read). */
async function messageFor(deps: ChatDeps, seat: ChatSeat, messageId: string) {
  const message = await readable(deps, seat, messageId);
  if (!message || message.deletedAt) throw notFound();
  return message;
}

/** The same person sent it: the same account (any of their joins), or the same guest join. */
function isOwn(seat: ChatSeat, message: ChatMessage): boolean {
  if (seat.who.attendanceId !== null && message.senderAttendanceId === seat.who.attendanceId) return true;
  return seat.userId !== null && message.senderUserId === seat.userId;
}

/** Own messages only; in meetings only during the call they were sent in (AC-F03-10, F14 AC-21). */
function ownNow(seat: ChatSeat, message: ChatMessage): void {
  if (!isOwn(seat, message)) throw notFound();
  if (!seat.ownAnyTime && message.callId !== seat.callId) throw editEnded();
}

async function takeReactionTurn(deps: ChatDeps, person: string): Promise<void> {
  const wait = await deps.calls.limiter.take(RATE_RULES.chatReactions, person);
  if (wait !== undefined) throw new AppError(429, "CHAT_TOO_FAST", "Too many reactions. Wait a moment.", wait);
}

interface News {
  seq: number;
  type: string;
  message: ChatMessage;
  /** With pins_changed: pinned or unpinned, so a repeated packet changes nothing. */
  pinned?: boolean;
}

/**
 * News to everyone carries no one person's view (no "mine"): each app works out its own from the
 * reactors' joins or accounts (verification round 1, bug 1). The actor gets their own view back.
 */
async function announce(deps: ChatDeps, seat: ChatSeat, news: News) {
  const everyone = await viewOne(deps, news.message, undefined);
  await seat.deliver({
    seq: news.seq,
    type: news.type,
    id: news.message.id,
    message: everyone,
    ...(news.pinned === undefined ? {} : { pinned: news.pinned }),
  });
  return viewOne(deps, news.message, viewerOf(seat));
}

/** "<name> pinned a message", saved as a system note and delivered like a message (AC-F03-19). */
async function pinnedNote(deps: ChatDeps, seat: ChatSeat): Promise<void> {
  const saved = await deps.chat.insertMessage(
    { ...seatSender(seat), kind: "system", system: { event: "pinned", name: seat.name }, clientId: randomUUID() },
    "message_created",
  );
  if (saved.created) await announce(deps, seat, { seq: saved.seq, type: "message_created", message: saved.message });
}

export async function editAs(deps: ChatDeps, seat: ChatSeat, messageId: string, body: MessageDocument) {
  const message = await messageFor(deps, seat, messageId);
  ownNow(seat, message);
  const plainText = documentPlainText(body);
  if (plainText.trim() === "") throw invalid();
  const change = await deps.actions.edit(seat.conversationId, messageId, { body, plainText });
  if (!change) throw notFound();
  return announce(deps, seat, { seq: change.seq, type: "message_edited", message: change.row });
}

export async function deleteAs(deps: ChatDeps, seat: ChatSeat, messageId: string) {
  const message = await messageFor(deps, seat, messageId);
  const own = isOwn(seat, message) && (seat.ownAnyTime || message.callId === seat.callId);
  // Someone else's message, or one's own from an earlier call: meeting organizers only.
  if (!own && !(await seat.mayDeleteAny())) ownNow(seat, message);
  const change = await deps.actions.delete(seat.conversationId, messageId, seat.who);
  if (!change) throw notFound();
  await announce(deps, seat, { seq: change.seq, type: "message_deleted", message: change.row });
}

export async function reactAs(deps: ChatDeps, seat: ChatSeat, messageId: string, value: string) {
  const emoji = knownEmoji(value);
  if (!emoji) throw invalid();
  const message = await messageFor(deps, seat, messageId);
  await takeReactionTurn(deps, seat.limitKey);
  const seq = await deps.actions.addReaction(message, { who: seat.who, name: seat.name }, emoji);
  if (seq !== undefined) await announce(deps, seat, { seq, type: "reactions_changed", message });
}

export async function unreactAs(deps: ChatDeps, seat: ChatSeat, messageId: string, value: string) {
  const message = await messageFor(deps, seat, messageId);
  const seq = await deps.actions.removeReaction(message, seat.who, knownEmoji(value) ?? value);
  if (seq !== undefined) await announce(deps, seat, { seq, type: "reactions_changed", message });
}

/** Pin (any member in chats, presenters and up in meetings); 3 at most per chat (AC-F03-19, F14 AC-19). */
export async function pinAs(deps: ChatDeps, seat: ChatSeat, messageId: string) {
  const message = await messageFor(deps, seat, messageId);
  if (message.kind === "system") throw invalid();
  const seq = await deps.actions.pin(message, seat.who);
  if (seq === "full") throw new AppError(409, "CHAT_PINS_FULL", "Up to 3 messages can be pinned. Unpin one first.");
  if (seq === undefined) return;
  await announce(deps, seat, { seq, type: "pins_changed", message, pinned: true });
  await pinnedNote(deps, seat);
}

export async function unpinAs(deps: ChatDeps, seat: ChatSeat, messageId: string) {
  const message = await deps.chat.one(seat.conversationId, messageId);
  if (!message) throw notFound();
  const seq = await deps.actions.unpin(message);
  if (seq !== undefined) await announce(deps, seat, { seq, type: "pins_changed", message, pinned: false });
}

const seatFor = (deps: ChatDeps, request: OnMessage, action: ChatAction) =>
  meetingSeat(deps, request.callId, request.ticketHash, action);

export function createChatActionsService(deps: ChatDeps) {
  return {
    edit: async (request: OnMessage, body: MessageDocument) =>
      editAs(deps, await seatFor(deps, request, "editOwn"), request.messageId, body),
    delete: async (request: OnMessage) => deleteAs(deps, await seatFor(deps, request, "deleteOwn"), request.messageId),
    react: async (request: OnMessage, emoji: string) =>
      reactAs(deps, await seatFor(deps, request, "react"), request.messageId, emoji),
    unreact: async (request: OnMessage, emoji: string) =>
      unreactAs(deps, await seatFor(deps, request, "react"), request.messageId, emoji),
    pin: async (request: OnMessage) => pinAs(deps, await seatFor(deps, request, "pin"), request.messageId),
    unpin: async (request: OnMessage) => unpinAs(deps, await seatFor(deps, request, "pin"), request.messageId),
    pinned: async (callId: string, ticketHash: string) => {
      const seat = await meetingSeat(deps, callId, ticketHash, "read");
      return { pinned: await pinnedViews(deps, seat.conversationId, viewerOf(seat)) };
    },
  };
}

export type ChatActionsService = ReturnType<typeof createChatActionsService>;
