// What every chat service shares (F03 design.md 3.1–3.4): who the caller is in this call and what
// the chat rights allow, how news reaches the room, and what apps see of a message.
import type { ChatEvent, ChatMessageView, MessageDocument } from "@meetapp/contracts";
import type { ChatMessage } from "@meetapp/db";
import { AppError } from "../../plugins/errors.ts";
import { asTheyAreNow, notFound, roleOf, type CallsDeps } from "../calls/admission.ts";
import { IN_CALL_STATUSES } from "../calls/calls.repository.ts";
import { isUsable } from "../meetings/meetings.service.ts";
import type { ChatActionsRepository } from "./chat-actions.repository.ts";
import type { ChatFilesRepository } from "./chat-files.repository.ts";
import type { ChatPollsRepository } from "./chat-polls.repository.ts";
import { canChat, type ChatAction } from "./chat.permissions.ts";
import type { ChatRepository, Cursor } from "./chat.repository.ts";

/** Bigger news goes out as `{ type, id, seq }` only and apps fetch the message (design 3.4). */
export const MAX_PACKET_BYTES = 14 * 1024;
const DELETED_TEXT = "This message was deleted";

export interface ChatDeps {
  calls: CallsDeps;
  chat: ChatRepository;
  actions: ChatActionsRepository;
  polls: ChatPollsRepository;
  files: ChatFilesRepository;
  /** Signs the 5-minute download links (design section 6). */
  fileLinkSecret: string;
  /** KLIPY's address and key, handed to apps that search GIFs themselves (D059). */
  gifService: { apiUrl: string; key: string | undefined };
  /** Keys the poll voter hash (design 3.7): never stored with the votes. */
  voterSecret: string;
}

export const invalid = () => new AppError(400, "CHAT_INVALID", "This message can't be sent.");

/** The caller in this running call, allowed to do `action` in its chat; 404 or CHAT_OFF otherwise. */
export async function chatActor({ calls }: ChatDeps, callId: string, ticketHash: string, action: ChatAction) {
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

/** Sends news to the room; a packet too big for the call server carries only the id (design 3.4). */
export async function broadcast(deps: ChatDeps, callId: string, event: ChatEvent): Promise<void> {
  const encoder = new TextEncoder();
  let packet = encoder.encode(JSON.stringify(event));
  if (packet.length > MAX_PACKET_BYTES) {
    packet = encoder.encode(JSON.stringify({ seq: event.seq, type: event.type, id: event.id }));
  }
  // The change is saved; a missed packet is caught up through the events list after a reconnect.
  await deps.calls.livekit.sendChat(callId, packet).catch(() => undefined);
}

function cursorOf(message: Pick<ChatMessage, "createdAt" | "id">): string {
  return `${message.createdAt.toISOString()}_${message.id}`;
}

export function parseCursor(value: string | undefined): Cursor | undefined {
  if (value === undefined) return undefined;
  const [time, id] = value.split("_");
  const createdAt = new Date(time ?? "");
  if (!id || Number.isNaN(createdAt.getTime()) || !/^[0-9a-f-]{36}$/.test(id)) throw invalid();
  return { createdAt, id };
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);
const firstLine = (message: ChatMessage) =>
  message.deletedAt ? DELETED_TEXT : ((message.plainText ?? "").split("\n")[0]?.slice(0, 200) ?? "");

type Reaction = { messageId: string; attendanceId: string; emoji: string; reactorName: string };

function reactionsFor(rows: Reaction[], messageId: string, viewer: string | undefined) {
  const byEmoji = new Map<string, { names: string[]; mine: boolean }>();
  for (const row of rows.filter((reaction) => reaction.messageId === messageId)) {
    const entry = byEmoji.get(row.emoji) ?? { names: [], mine: false };
    entry.names.push(row.reactorName);
    entry.mine ||= row.attendanceId === viewer;
    byEmoji.set(row.emoji, entry);
  }
  return [...byEmoji].map(([emoji, entry]) => ({ emoji, count: entry.names.length, ...entry }));
}

interface Extras {
  quoted?: ChatMessage;
  reactions: ChatMessageView["reactions"];
  pollId?: string | undefined;
  attachments: ChatMessageView["attachments"];
}

function viewOf(message: ChatMessage, extras: Extras) {
  const view: ChatMessageView = {
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
    replyTo: extras.quoted
      ? {
          id: extras.quoted.id,
          senderName: extras.quoted.senderName,
          firstLine: firstLine(extras.quoted),
          deleted: extras.quoted.deletedAt !== null,
        }
      : null,
    reactions: message.deletedAt ? [] : extras.reactions,
    gif: message.deletedAt ? null : ((message.gif as ChatMessageView["gif"]) ?? null),
    sticker: message.deletedAt ? null : ((message.sticker as ChatMessageView["sticker"]) ?? null),
    attachments: message.deletedAt ? [] : extras.attachments,
    pollId: message.deletedAt ? null : (extras.pollId ?? null),
    system: (message.system as ChatMessageView["system"]) ?? null,
  };
  return view;
}

/** What apps see of these messages, for one viewer: quotes and reactions are added (AC-F03-13, 14). */
export async function viewsOf(
  deps: ChatDeps,
  meetingId: string,
  messages: ChatMessage[],
  viewer?: string,
): Promise<ChatMessageView[]> {
  const replyIds = [...new Set(messages.flatMap((message) => (message.replyToId ? [message.replyToId] : [])))];
  const quoted = new Map((await deps.actions.quoted(meetingId, replyIds)).map((row) => [row.id, row]));
  const ids = messages.map((message) => message.id);
  const reactions = await deps.actions.reactionsOf(ids);
  const polls = new Map((await deps.polls.byMessages(ids)).map((poll) => [poll.messageId, poll.id]));
  const files = await deps.files.ofMessages(ids);
  return messages.map((message) => {
    const quote = message.replyToId ? quoted.get(message.replyToId) : undefined;
    return viewOf(message, {
      ...(quote ? { quoted: quote } : {}),
      reactions: reactionsFor(reactions, message.id, viewer),
      ...(polls.has(message.id) ? { pollId: polls.get(message.id) } : {}),
      attachments: files
        .filter((file) => file.messageId === message.id)
        .map((file) => ({
          id: file.id,
          fileName: file.fileName,
          mediaType: file.mediaType,
          sizeBytes: file.sizeBytes,
          width: file.width,
          height: file.height,
          hasPreview: file.previewKey !== null,
        })),
    });
  });
}

/** One message as apps see it. */
export async function viewOne(deps: ChatDeps, message: ChatMessage, viewer?: string): Promise<ChatMessageView> {
  const [view] = await viewsOf(deps, message.meetingId, [message], viewer);
  if (!view) throw notFound();
  return view;
}

/** The pinned messages of a meeting, oldest pin first (AC-F03-19). */
export async function pinnedViews(deps: ChatDeps, meetingId: string, viewer?: string): Promise<ChatMessageView[]> {
  const ids = await deps.actions.pinnedIds(meetingId);
  const rows = await Promise.all(ids.map((id) => deps.chat.one(meetingId, id)));
  return viewsOf(
    deps,
    meetingId,
    rows.flatMap((message) => (message ? [message] : [])),
    viewer,
  );
}

/** Where a new message belongs and who sent it, as kept in the record. */
export function sentBy({ attendance, row }: Awaited<ReturnType<typeof chatActor>>, callId: string) {
  return {
    workspaceId: row.meeting.workspaceId,
    meetingId: row.meeting.id,
    callId,
    senderAttendanceId: attendance.id,
    senderUserId: attendance.userId,
    senderName: attendance.displayName,
    senderGroup: attendance.participantGroup,
  };
}
