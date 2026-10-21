// Sending, reading and delivering chat messages (F03 design.md 3.2–3.4). Every request is checked
// against the caller's place in this call (ticket, role, chat setting) on the server; the message is
// saved first, then the call server delivers the news to everyone in the room.
import { createHmac } from "node:crypto";
import { documentPlainText, type ChatMessageView, type MessageDocument, type StickerName } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES } from "../../plugins/rate-limit.ts";
import { notFound } from "../calls/admission.ts";
import { AttachmentsNotYoursError } from "./chat.repository.ts";
import { invalid, parseCursor, pinnedViews, viewOne, viewsOf, type ChatDeps } from "./chat-access.ts";
import { meetingSeat, seatSender, viewerOf, type ChatSeat } from "./chat-seat.ts";

export { MAX_PACKET_BYTES, type ChatDeps } from "./chat-access.ts";

export interface SendInput {
  clientId: string;
  body?: MessageDocument | undefined;
  replyToId?: string | undefined;
  attachmentIds?: string[] | undefined;
  gif?: GifInput | undefined;
  sticker?: StickerName | undefined;
  /** Chats: members mentioned in `body` (worked out by the chats service, F14 AC-22). */
  mentionedUserIds?: string[] | undefined;
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

/** Saves and delivers a message from this seat: text, files, a GIF or a sticker (F03 AC-03; F14 AC-19). */
export async function sendFrom(deps: ChatDeps, seat: ChatSeat, input: SendInput) {
  // Text, files, or both, or a GIF, or a sticker; an empty message is refused (AC-F03-03).
  const { attachmentIds, ...content } = contentOf(input, seat);
  // Guests send no files (AC-F03-33).
  if (attachmentIds.length > 0 && !(await seat.mayAttach())) throw notFound();
  // A reply quotes a message of this chat only (AC-F03-14).
  if (input.replyToId && !(await readable(deps, seat, input.replyToId))) throw invalid();
  await takeMessageTurn(deps, seat.limitKey);
  const saved = await deps.chat
    .insertMessage(
      {
        ...seatSender(seat),
        ...content,
        replyToId: input.replyToId ?? null,
        clientId: input.clientId,
        mentionedUserIds: input.mentionedUserIds ?? null,
      },
      "message_created",
      attachmentIds,
    )
    .catch((error: unknown) => {
      if (error instanceof AttachmentsNotYoursError) throw invalid();
      throw error;
    });
  const view = await viewOne(deps, saved.message, viewerOf(seat));
  if (saved.created) {
    await seat.deliver({ seq: saved.seq, type: "message_created", id: view.id, message: view });
  }
  return view;
}

/** A message this seat may read (inside its reading window), or nothing. */
export async function readable(deps: ChatDeps, seat: ChatSeat, messageId: string) {
  const message = await deps.chat.one(seat.conversationId, messageId);
  if (!message) return undefined;
  const { window } = seat;
  if (window.from && message.createdAt < window.from) return undefined;
  if (window.until && message.createdAt > window.until) return undefined;
  return message;
}

/** A page of history, newest first; the first page also brings the pins and the newest news number. */
export async function pageFor(deps: ChatDeps, seat: ChatSeat, query: { before?: string | undefined; limit: number }) {
  const { conversationId } = seat;
  // Read before the page: news after this number reaches the app live or by catching up (none is lost).
  const newest = query.before ? undefined : await deps.chat.lastSeq(conversationId);
  const lastSeq =
    newest === undefined || seat.window.untilSeq === null ? newest : Math.min(newest, seat.window.untilSeq);
  const { window } = seat;
  const rows = await deps.chat.page(conversationId, query.limit + 1, parseCursor(query.before), window);
  const messages = await viewsOf(deps, conversationId, rows.slice(0, query.limit), viewerOf(seat));
  if (query.before) return { messages, hasMore: rows.length > query.limit };
  const pinned = await pinnedViews(deps, conversationId, viewerOf(seat));
  return { messages, hasMore: rows.length > query.limit, pinned, lastSeq };
}

/** Missed news after a reconnect; `gap` when older news was already cleaned (design 3.4). */
export async function eventsFor(deps: ChatDeps, seat: ChatSeat, after: number) {
  const { rows, oldestKept } = await deps.chat.eventsAfter(seat.conversationId, after);
  const gap = oldestKept !== null && oldestKept > after + 1;
  const untilSeq = seat.window.untilSeq;
  const events = rows
    .filter((event) => untilSeq === null || event.seq <= untilSeq)
    .map((event) => ({
      seq: event.seq,
      type: event.type,
      ...(event.payload as { id?: string; pinned?: boolean; pollId?: string; version?: number }),
    }));
  return { events, gap };
}

/** One message, as this seat sees it. */
export async function oneFor(deps: ChatDeps, seat: ChatSeat, messageId: string) {
  const message = await readable(deps, seat, messageId);
  if (!message) throw notFound();
  return viewOne(deps, message, viewerOf(seat));
}

/** What the app needs to search KLIPY itself (D059): the key and a random per-chat id. */
export function gifSettingsFor(deps: ChatDeps, seat: ChatSeat) {
  if (!seat.allowGifs) throw gifsOff();
  // Meetings keep F03's id (meeting and join); chats use the conversation and the account.
  const place = seat.meetingId ?? seat.conversationId;
  const customerId = createHmac("sha256", deps.voterSecret)
    .update(`gif:${place}:${viewerOf(seat) ?? ""}`)
    .digest("hex")
    .slice(0, 32);
  const { apiUrl, key } = deps.gifService;
  return { available: key !== undefined, apiUrl, key: key ?? "", customerId };
}

export function createChatService(deps: ChatDeps) {
  return {
    gifSettings: async (callId: string, ticketHash: string) =>
      gifSettingsFor(deps, await meetingSeat(deps, callId, ticketHash, "send")),
    send: async (callId: string, ticketHash: string, input: SendInput) =>
      sendFrom(deps, await meetingSeat(deps, callId, ticketHash, "send"), input),
    page: async (callId: string, ticketHash: string, query: { before?: string | undefined; limit: number }) =>
      pageFor(deps, await meetingSeat(deps, callId, ticketHash, "read"), query),
    one: async (callId: string, ticketHash: string, messageId: string) =>
      oneFor(deps, await meetingSeat(deps, callId, ticketHash, "read"), messageId),
    events: async (callId: string, ticketHash: string, after: number) =>
      eventsFor(deps, await meetingSeat(deps, callId, ticketHash, "read"), after),
  };
}

export type ChatService = ReturnType<typeof createChatService>;
