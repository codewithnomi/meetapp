// Sending, reading and delivering chat messages (F03 design.md 3.2–3.4). Every request is checked
// against the caller's place in this call (ticket, role, chat setting) on the server; the message is
// saved first, then the call server delivers the news to everyone in the room.
import { createHmac } from "node:crypto";
import { documentPlainText, type ChatMessageView, type MessageDocument, type StickerName } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import { notFound } from "../calls/admission.ts";
import { AttachmentsNotYoursError } from "./chat.repository.ts";
import {
  broadcast,
  chatActor,
  personKey,
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
  body?: MessageDocument | undefined;
  replyToId?: string | undefined;
  attachmentIds?: string[] | undefined;
  gif?: GifInput | undefined;
  sticker?: StickerName | undefined;
}

type GifInput = NonNullable<ChatMessageView["gif"]>;
const gifsOff = () => new AppError(403, "CHAT_GIFS_OFF", "GIFs are turned off in this workspace.");

/** What kind of message this is: text with files, a GIF, or a sticker; never two at once. */
function contentOf(input: SendInput, row: { allowGifs: boolean }) {
  const attachmentIds = [...new Set(input.attachmentIds ?? [])];
  const plainText = input.body ? documentPlainText(input.body) : "";
  const hasText = plainText.trim() !== "" || attachmentIds.length > 0;
  if ([hasText, input.gif !== undefined, input.sticker !== undefined].filter(Boolean).length !== 1) throw invalid();
  if (input.gif) {
    // KLIPY GIFs only while the workspace allows them (AC-F03-27).
    if (!row.allowGifs) throw gifsOff();
    return { kind: "gif" as const, gif: input.gif, plainText: input.gif.description, attachmentIds };
  }
  if (input.sticker) return { kind: "sticker" as const, sticker: input.sticker, plainText: "", attachmentIds };
  return { kind: "text" as const, body: input.body ?? null, plainText, attachmentIds };
}

async function takeMessageTurn(deps: ChatDeps, person: string): Promise<void> {
  const wait = await deps.calls.limiter.take(RATE_RULES.chatMessages, person);
  if (wait !== undefined) {
    throw new AppError(429, "CHAT_TOO_FAST", "You're sending messages too fast. Try again in a few seconds.", wait);
  }
}

async function send(deps: ChatDeps, callId: string, ticketHash: string, input: SendInput) {
  const { attendance, row } = await chatActor(deps, callId, ticketHash, "send");
  // Text, files, or both, or a GIF, or a sticker; an empty message is refused (AC-F03-03).
  const { attachmentIds, ...content } = contentOf(input, row);
  // Guests send no files (AC-F03-33).
  if (attachmentIds.length > 0) await chatActor(deps, callId, ticketHash, "attach");
  // A reply quotes a message of this meeting only (AC-F03-14).
  if (input.replyToId && !(await deps.chat.one(row.meeting.id, input.replyToId))) throw invalid();
  await takeMessageTurn(deps, personKey(attendance));
  const saved = await deps.chat
    .insertMessage(
      {
        ...sentBy({ attendance, row }, callId),
        ...content,
        replyToId: input.replyToId ?? null,
        clientId: input.clientId,
      },
      "message_created",
      attachmentIds,
    )
    .catch((error: unknown) => {
      if (error instanceof AttachmentsNotYoursError) throw invalid();
      throw error;
    });
  const view = await viewOne(deps, saved.message, attendance.id);
  if (saved.created) {
    await broadcast(deps, callId, { seq: saved.seq, type: "message_created", id: view.id, message: view });
  }
  return view;
}

/** What the app needs to search KLIPY itself (D059): the key and a random per-meeting id. */
async function gifSettings(deps: ChatDeps, callId: string, ticketHash: string) {
  const { row, attendance } = await chatActor(deps, callId, ticketHash, "send");
  if (!row.allowGifs) throw gifsOff();
  const customerId = createHmac("sha256", deps.voterSecret)
    .update(`gif:${row.meeting.id}:${attendance.id}`)
    .digest("hex")
    .slice(0, 32);
  const { apiUrl, key } = deps.gifService;
  return { available: key !== undefined, apiUrl, key: key ?? "", customerId };
}

export function createChatService(deps: ChatDeps) {
  return {
    gifSettings: (callId: string, ticketHash: string) => gifSettings(deps, callId, ticketHash),
    send: (callId: string, ticketHash: string, input: SendInput) => send(deps, callId, ticketHash, input),
    page: async (callId: string, ticketHash: string, query: { before?: string | undefined; limit: number }) => {
      const { row, attendance } = await chatActor(deps, callId, ticketHash, "read");
      const meetingId = row.meeting.id;
      // Read before the page: news after this number reaches the app live or by catching up (none is lost).
      const lastSeq = query.before ? undefined : await deps.chat.lastSeq(meetingId);
      const rows = await deps.chat.page(meetingId, query.limit + 1, parseCursor(query.before));
      const messages = await viewsOf(deps, meetingId, rows.slice(0, query.limit), attendance.id);
      if (query.before) return { messages, hasMore: rows.length > query.limit };
      const pinned = await pinnedViews(deps, meetingId, attendance.id);
      return { messages, hasMore: rows.length > query.limit, pinned, lastSeq };
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
      const events = rows.map((event) => ({
        seq: event.seq,
        type: event.type,
        ...(event.payload as { id?: string; pinned?: boolean; pollId?: string; version?: number }),
      }));
      return { events, gap };
    },
  };
}

export type ChatService = ReturnType<typeof createChatService>;
