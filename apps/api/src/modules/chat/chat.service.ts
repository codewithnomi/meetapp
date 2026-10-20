// Sending, reading and delivering chat messages (F03 design.md 3.1–3.4). Every request is checked
// against the caller's place in this call (ticket, role, chat setting) on the server; the message is
// saved first, then the call server delivers the news to everyone in the room.
import { documentPlainText, type ChatEvent, type ChatMessageView, type MessageDocument } from "@meetapp/contracts";
import type { ChatMessage } from "@meetapp/db";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import { asTheyAreNow, notFound, roleOf, type CallsDeps } from "../calls/admission.ts";
import { IN_CALL_STATUSES } from "../calls/calls.repository.ts";
import { isUsable } from "../meetings/meetings.service.ts";
import { canChat, type ChatAction } from "./chat.permissions.ts";
import type { ChatRepository, Cursor } from "./chat.repository.ts";

/** Bigger news goes out as `{ type, id, seq }` only and apps fetch the message (design 3.4). */
export const MAX_PACKET_BYTES = 14 * 1024;

export interface ChatDeps {
  calls: CallsDeps;
  chat: ChatRepository;
}

const invalid = () => new AppError(400, "CHAT_INVALID", "This message can't be sent.");

/** The caller in this running call, allowed to do `action` in its chat; 404 or CHAT_OFF otherwise. */
async function chatActor({ calls }: ChatDeps, callId: string, ticketHash: string, action: ChatAction) {
  const attendance = await calls.attendances.byTicket(ticketHash);
  const present = (IN_CALL_STATUSES as readonly string[]).includes(attendance?.status ?? "");
  if (!attendance || attendance.callId !== callId || !present) throw notFound();
  const row = await calls.meetings.find(attendance.meetingId);
  if (!row || !isUsable(row, calls.now())) throw notFound();
  const person = await asTheyAreNow(calls, row, attendance);
  const facts = {
    role: roleOf(person, row),
    group: person.participantGroup,
    presence: "in_call" as const,
    mode: row.meeting.chatMode,
    callRunning: true,
  };
  if (!canChat(action, facts)) {
    if (canChat(action, { ...facts, mode: "on" })) throw new AppError(403, "CHAT_OFF", "Chat is turned off.");
    throw notFound();
  }
  return { attendance: person, row };
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export function cursorOf(message: Pick<ChatMessage, "createdAt" | "id">): string {
  return `${message.createdAt.toISOString()}_${message.id}`;
}

function parseCursor(value: string | undefined): Cursor | undefined {
  if (value === undefined) return undefined;
  const [time, id] = value.split("_");
  const createdAt = new Date(time ?? "");
  if (!id || Number.isNaN(createdAt.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) throw invalid();
  return { createdAt, id };
}

/** What apps see of a message; a deleted message keeps only who and when. */
export function viewOf(message: ChatMessage): ChatMessageView {
  return {
    id: message.id,
    cursor: cursorOf(message),
    kind: message.kind,
    sender: {
      attendanceId: message.senderAttendanceId,
      name: message.senderName,
      group: message.senderGroup,
      userId: message.senderUserId,
    },
    body: message.deletedAt ? null : (message.body as MessageDocument | null),
    createdAt: message.createdAt.toISOString(),
    editedAt: iso(message.editedAt),
    deletedAt: iso(message.deletedAt),
  };
}

/** Sends news to the room; a packet too big for the call server carries only the id (design 3.4). */
export async function broadcast(deps: ChatDeps, callId: string, event: ChatEvent): Promise<void> {
  const encoder = new TextEncoder();
  let packet = encoder.encode(JSON.stringify(event));
  if (packet.length > MAX_PACKET_BYTES) {
    packet = encoder.encode(JSON.stringify({ seq: event.seq, type: event.type, id: event.id }));
  }
  // The message is saved; a missed packet is caught up through the events list after a reconnect.
  await deps.calls.livekit.sendChat(callId, packet).catch(() => undefined);
}

async function takeMessageTurn(deps: ChatDeps, ticketHash: string): Promise<void> {
  const wait = await deps.calls.limiter.take(RATE_RULES.chatMessages, ticketHash);
  if (wait !== undefined) {
    throw new AppError(429, "CHAT_TOO_FAST", "You're sending messages too fast. Try again in a few seconds.", wait);
  }
}

export function createChatService(deps: ChatDeps) {
  return {
    send: async (callId: string, ticketHash: string, input: { clientId: string; body: MessageDocument }) => {
      const { attendance, row } = await chatActor(deps, callId, ticketHash, "send");
      const plainText = documentPlainText(input.body);
      if (plainText.trim() === "") throw invalid();
      await takeMessageTurn(deps, ticketHash);
      const saved = await deps.chat.insertMessage(
        {
          workspaceId: row.meeting.workspaceId,
          meetingId: row.meeting.id,
          callId,
          senderAttendanceId: attendance.id,
          senderUserId: attendance.userId,
          senderName: attendance.displayName,
          senderGroup: attendance.participantGroup,
          kind: "text",
          body: input.body,
          plainText,
          clientId: input.clientId,
        },
        "message_created",
      );
      const view = viewOf(saved.message);
      if (saved.created) {
        await broadcast(deps, callId, { seq: saved.seq, type: "message_created", id: view.id, message: view });
      }
      return view;
    },
    page: async (callId: string, ticketHash: string, query: { before?: string | undefined; limit: number }) => {
      const { row } = await chatActor(deps, callId, ticketHash, "read");
      const rows = await deps.chat.page(row.meeting.id, query.limit + 1, parseCursor(query.before));
      return { messages: rows.slice(0, query.limit).map(viewOf), hasMore: rows.length > query.limit };
    },
    one: async (callId: string, ticketHash: string, messageId: string) => {
      const { row } = await chatActor(deps, callId, ticketHash, "read");
      const message = await deps.chat.one(row.meeting.id, messageId);
      if (!message) throw notFound();
      return viewOf(message);
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
