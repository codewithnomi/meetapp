// Sending, reading and delivering chat messages (F03 design.md 3.2–3.4). Every request is checked
// against the caller's place in this call (ticket, role, chat setting) on the server; the message is
// saved first, then the call server delivers the news to everyone in the room.
import { documentPlainText, type MessageDocument } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import { notFound } from "../calls/admission.ts";
import {
  broadcast,
  chatActor,
  invalid,
  parseCursor,
  pinnedViews,
  sentBy,
  viewOne,
  viewsOf,
  type ChatDeps,
} from "./chat-access.ts";

export { MAX_PACKET_BYTES, type ChatDeps } from "./chat-access.ts";

interface SendInput {
  clientId: string;
  body: MessageDocument;
  replyToId?: string | undefined;
}

async function takeMessageTurn(deps: ChatDeps, ticketHash: string): Promise<void> {
  const wait = await deps.calls.limiter.take(RATE_RULES.chatMessages, ticketHash);
  if (wait !== undefined) {
    throw new AppError(429, "CHAT_TOO_FAST", "You're sending messages too fast. Try again in a few seconds.", wait);
  }
}

async function send(deps: ChatDeps, callId: string, ticketHash: string, input: SendInput) {
  const { attendance, row } = await chatActor(deps, callId, ticketHash, "send");
  const plainText = documentPlainText(input.body);
  if (plainText.trim() === "") throw invalid();
  // A reply quotes a message of this meeting only (AC-F03-14).
  if (input.replyToId && !(await deps.chat.one(row.meeting.id, input.replyToId))) throw invalid();
  await takeMessageTurn(deps, ticketHash);
  const saved = await deps.chat.insertMessage(
    {
      ...sentBy({ attendance, row }, callId),
      kind: "text",
      body: input.body,
      plainText,
      replyToId: input.replyToId ?? null,
      clientId: input.clientId,
    },
    "message_created",
  );
  const view = await viewOne(deps, saved.message, attendance.id);
  if (saved.created) {
    await broadcast(deps, callId, { seq: saved.seq, type: "message_created", id: view.id, message: view });
  }
  return view;
}

export function createChatService(deps: ChatDeps) {
  return {
    send: (callId: string, ticketHash: string, input: SendInput) => send(deps, callId, ticketHash, input),
    page: async (callId: string, ticketHash: string, query: { before?: string | undefined; limit: number }) => {
      const { row, attendance } = await chatActor(deps, callId, ticketHash, "read");
      const meetingId = row.meeting.id;
      const rows = await deps.chat.page(meetingId, query.limit + 1, parseCursor(query.before));
      const messages = await viewsOf(deps, meetingId, rows.slice(0, query.limit), attendance.id);
      if (query.before) return { messages, hasMore: rows.length > query.limit };
      const pinned = await pinnedViews(deps, meetingId, attendance.id);
      return { messages, hasMore: rows.length > query.limit, pinned };
    },
    one: async (callId: string, ticketHash: string, messageId: string) => {
      const { row, attendance } = await chatActor(deps, callId, ticketHash, "read");
      const message = await deps.chat.one(row.meeting.id, messageId);
      if (!message) throw notFound();
      return viewOne(deps, message, attendance.id);
    },
    /** Missed news after a reconnect; `gap` when older news was already cleaned (design 3.4). */
    events: async (callId: string, ticketHash: string, after: number) => {
      const { row } = await chatActor(deps, callId, ticketHash, "read");
      const { rows, oldestKept } = await deps.chat.eventsAfter(row.meeting.id, after);
      const gap = oldestKept !== null && oldestKept > after + 1;
      const events = rows.map((event) => ({ seq: event.seq, type: event.type, ...(event.payload as { id?: string }) }));
      return { events, gap };
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
