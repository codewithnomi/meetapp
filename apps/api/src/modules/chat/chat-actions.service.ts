// What people do to messages during a call (F03 design.md 3.5 and 3.6): edit and delete (own, or
// any for organizers), react, pin and unpin. Rights are checked on every action; each change is
// saved with its news, then delivered to the room.
import { randomUUID } from "node:crypto";
import { documentPlainText, type MessageDocument } from "@meetapp/contracts";
import type { ChatMessage } from "./chat.repository.ts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import { notFound } from "../calls/admission.ts";
import {
  broadcast,
  chatActor,
  personKey,
  sentBy,
  invalid,
  pinnedViews,
  viewOne,
  type ChatDeps,
} from "./chat-access.ts";
import type { ChatAction } from "./chat.permissions.ts";
import { knownEmoji } from "./emoji.ts";

type Actor = Awaited<ReturnType<typeof chatActor>>;
/** One request about one message: which call, whose ticket, which message. */
export interface OnMessage {
  callId: string;
  ticketHash: string;
  messageId: string;
}

const editEnded = () => new AppError(409, "CHAT_EDIT_ENDED", "This message can no longer be changed.");

/** The caller and a message of their meeting; 404 when the message isn't there. */
async function onMessage(deps: ChatDeps, { callId, ticketHash, messageId }: OnMessage, action: ChatAction) {
  const actor = await chatActor(deps, callId, ticketHash, action);
  const message = await deps.chat.one(actor.row.meeting.id, messageId);
  if (!message || message.deletedAt) throw notFound();
  return { ...actor, message };
}

/** The same person sent it: the same account (any of their joins), or the same guest join. */
function isOwn(actor: Actor & { message: ChatMessage }): boolean {
  const { message, attendance } = actor;
  if (message.senderAttendanceId === attendance.id) return true;
  return attendance.userId !== null && message.senderUserId === attendance.userId;
}

/** Own messages only, and only during the call they were sent in (AC-F03-10). */
function ownInThisCall(actor: Actor & { message: ChatMessage }, callId: string): void {
  if (!isOwn(actor)) throw notFound();
  if (actor.message.callId !== callId) throw editEnded();
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
 * News to the whole room carries no one person's view (no "mine"): each app works out its own from the
 * reactors' joins (verification round 1, bug 1). The actor gets their own view back.
 */
async function announce(deps: ChatDeps, callId: string, news: News, viewer: string) {
  const everyone = await viewOne(deps, news.message, undefined);
  await broadcast(deps, callId, {
    seq: news.seq,
    type: news.type,
    id: news.message.id,
    message: everyone,
    ...(news.pinned === undefined ? {} : { pinned: news.pinned }),
  });
  return viewOne(deps, news.message, viewer);
}

/** "<name> pinned a message", saved as a system note and delivered like a message (AC-F03-19). */
async function pinnedNote(deps: ChatDeps, callId: string, actor: Actor): Promise<void> {
  const { attendance, row } = actor;
  const saved = await deps.chat.insertMessage(
    {
      ...sentBy({ attendance, row }, callId),
      kind: "system",
      system: { event: "pinned", name: attendance.displayName },
      clientId: randomUUID(),
    },
    "message_created",
  );
  if (saved.created) {
    await announce(deps, callId, { seq: saved.seq, type: "message_created", message: saved.message }, attendance.id);
  }
}

const reactionsChanged = (deps: ChatDeps, callId: string, seq: number, actor: Actor & { message: ChatMessage }) =>
  announce(deps, callId, { seq, type: "reactions_changed", message: actor.message }, actor.attendance.id);

async function remove(deps: ChatDeps, request: OnMessage) {
  const { callId, ticketHash, messageId } = request;
  const actor = await onMessage(deps, request, "deleteOwn");
  const ownNow = isOwn(actor) && actor.message.callId === callId;
  if (!ownNow) {
    // Someone else's message, or one's own from an earlier call: organizers and co-organizers only.
    // Not an organizer is an answer, not an error: the next line then refuses as "not found".
    const organizer = await chatActor(deps, callId, ticketHash, "deleteAny").catch(() => undefined);
    if (!organizer) ownInThisCall(actor, callId);
  }
  const change = await deps.actions.delete(actor.row.meeting.id, messageId, actor.attendance.id);
  if (!change) throw notFound();
  const news = { seq: change.seq, type: "message_deleted", message: change.row };
  await announce(deps, callId, news, actor.attendance.id);
}

async function react(deps: ChatDeps, request: OnMessage, value: string) {
  const emoji = knownEmoji(value);
  if (!emoji) throw invalid();
  const actor = await onMessage(deps, request, "react");
  await takeReactionTurn(deps, personKey(actor.attendance));
  const person = { attendanceId: actor.attendance.id, name: actor.attendance.displayName };
  const seq = await deps.actions.addReaction(actor.message, person, emoji);
  if (seq !== undefined) await reactionsChanged(deps, request.callId, seq, actor);
}

async function unreact(deps: ChatDeps, request: OnMessage, value: string) {
  const actor = await onMessage(deps, request, "react");
  const seq = await deps.actions.removeReaction(actor.message, actor.attendance.id, knownEmoji(value) ?? value);
  if (seq !== undefined) await reactionsChanged(deps, request.callId, seq, actor);
}

async function pin(deps: ChatDeps, request: OnMessage) {
  const { callId } = request;
  const actor = await onMessage(deps, request, "pin");
  if (actor.message.kind === "system") throw invalid();
  const seq = await deps.actions.pin(actor.message, actor.attendance.id);
  if (seq === "full") throw new AppError(409, "CHAT_PINS_FULL", "Up to 3 messages can be pinned. Unpin one first.");
  if (seq === undefined) return;
  await announce(
    deps,
    callId,
    { seq, type: "pins_changed", message: actor.message, pinned: true },
    actor.attendance.id,
  );
  await pinnedNote(deps, callId, actor);
}

export function createChatActionsService(deps: ChatDeps) {
  return {
    edit: async (request: OnMessage, body: MessageDocument) => {
      const actor = await onMessage(deps, request, "editOwn");
      ownInThisCall(actor, request.callId);
      const plainText = documentPlainText(body);
      if (plainText.trim() === "") throw invalid();
      const change = await deps.actions.edit(actor.row.meeting.id, request.messageId, { body, plainText });
      if (!change) throw notFound();
      const news = { seq: change.seq, type: "message_edited", message: change.row };
      return announce(deps, request.callId, news, actor.attendance.id);
    },
    delete: (request: OnMessage) => remove(deps, request),
    react: (request: OnMessage, emoji: string) => react(deps, request, emoji),
    unreact: (request: OnMessage, emoji: string) => unreact(deps, request, emoji),
    pin: (request: OnMessage) => pin(deps, request),
    unpin: async ({ callId, ticketHash, messageId }: OnMessage) => {
      const actor = await chatActor(deps, callId, ticketHash, "pin");
      const message = await deps.chat.one(actor.row.meeting.id, messageId);
      if (!message) throw notFound();
      const seq = await deps.actions.unpin(message);
      if (seq !== undefined)
        await announce(deps, callId, { seq, type: "pins_changed", message, pinned: false }, actor.attendance.id);
    },
    pinned: async (callId: string, ticketHash: string) => {
      const { row, attendance } = await chatActor(deps, callId, ticketHash, "read");
      return { pinned: await pinnedViews(deps, row.meeting.id, attendance.id) };
    },
  };
}

export type ChatActionsService = ReturnType<typeof createChatActionsService>;
