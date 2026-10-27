// Writing and reading in one-to-one and group chats (F14 design.md 3.2, 3.3; AC-F14-12, 13, 18, 19,
// 21, 22, 24). The person's seat comes from their membership, checked on every request; F03's message,
// reaction and reply rules then apply as they are. A sender whose request is unanswered sends at most
// 10 messages; a blocked direct chat is read-only for both; left and removed people read only what they
// saw. Mentions of people outside the chat become plain text.
import { CHATS_LIMITS, type ChatEvent, type MessageDocument, type Status } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import type { ChatDeps } from "../chat/chat-access.ts";
import { deleteAs, editAs, reactAs, unreactAs } from "../chat/chat-actions.service.ts";
import { CHAT_FILE_BYTES, type ChatSeat } from "../chat/chat-seat.ts";
import { eventsFor, oneFor, pageFor, readable, sendFrom, type SendInput } from "../chat/chat.service.ts";
import { cleanMentions, seenApplies } from "./chats-mentions.ts";
import type { ChatsMessagesRepository } from "./chats-messages.repository.ts";
import type { Conversation, ConversationMember } from "./chats.repository.ts";
import { canChats, type ChatsAction } from "./chats.permissions.ts";
import { readOnlyReason } from "./chats-readonly.ts";
import type { RequestsDeps } from "./chats-requests.service.ts";

export interface MessagesDeps extends RequestsDeps {
  /** F03's chat pieces: messages, reactions, files, limits. */
  meetingChat: ChatDeps;
  messages: ChatsMessagesRepository;
  /** Statuses the viewer may see (AC-F14-26). */
  statuses: (viewer: string, userIds: string[]) => Promise<Map<string, Status>>;
  /** Delivers news to the members' live lines (T9); saved news is caught up meanwhile. */
  publish: (conversationId: string, event: ChatEvent) => Promise<void>;
}

const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");
const outsideOff = () => new AppError(403, "CHAT_OUTSIDE_OFF", "Chat with people outside the workspace is turned off.");
const readOnly = () => new AppError(403, "CHAT_READ_ONLY", "You can't send messages in this chat.");

interface Place {
  userId: string;
  conversation: Conversation;
  member: ConversationMember;
  people: Awaited<ReturnType<MessagesDeps["chats"]["peopleOf"]>>;
  other: Place["people"][number] | undefined;
}

/** The facts the rights table needs, with why a member's chat may be read-only (AC-F14-13, 27, 34). */
async function factsOf(deps: MessagesDeps, { userId, conversation, member, people, other }: Place) {
  const reason = readOnlyReason({
    kind: conversation.kind,
    userId,
    people,
    blocked: other ? (await deps.requests.blocksBetween(userId, [other.userId])).length > 0 : false,
    outsideAllowed: await deps.requests.allowsOutside(conversation.workspaceId),
  });
  return {
    kind: conversation.kind === "direct" ? ("direct" as const) : ("group" as const),
    state: member.state,
    outOfWorkspace: false,
    external: member.external,
    otherExternal: other?.external ?? false,
    blocked: reason === "blocked" || reason === "left_workspace",
    outsideOffWithExternal: reason === "outside_off",
    reason,
  };
}

/** The person's seat in the chat, if `action` is allowed; 404 for anyone outside it. */
export async function seatIn(deps: MessagesDeps, userId: string, conversationId: string, action: ChatsAction) {
  const row = await deps.chats.member(conversationId, userId);
  if (!row || row.conversation.kind === "meeting" || row.conversation.deletedAt) throw notFound();
  const { conversation, member } = row;
  const people = await deps.chats.peopleOf([conversationId]);
  const other = conversation.kind === "direct" ? people.find((p) => p.userId !== userId) : undefined;
  const facts = await factsOf(deps, { userId, conversation, member, people, other });
  if (!canChats(action, facts)) {
    const openChat = { ...facts, blocked: false, outsideOffWithExternal: false };
    if (member.state !== "accepted" || !canChats(action, openChat)) throw notFound();
    throw facts.reason === "outside_off" ? outsideOff() : readOnly();
  }
  const me = await deps.messages.person(userId);
  const ended = member.state === "left" || member.state === "removed";
  const seat: ChatSeat = {
    conversationId,
    workspaceId: conversation.workspaceId,
    meetingId: null,
    callId: null,
    who: { attendanceId: null, userId },
    userId,
    name: me?.name ?? "",
    group: member.external ? "external" : "member",
    limitKey: userId,
    allowGifs: await deps.messages.allowGifs(conversation.workspaceId),
    ownAnyTime: true,
    maxChatFileBytes: CHAT_FILE_BYTES,
    manager: false,
    mayDeleteAny: () => Promise.resolve(false),
    mayAttach: () => Promise.resolve(true),
    window: {
      from: member.historyFrom,
      until: ended ? member.leftAt : null,
      untilSeq: ended ? (member.leftSeq ?? 0) : null,
    },
    deliver: (event) => deps.publish(conversationId, event),
  };
  return { seat, conversation, people, other, readReceipts: me?.readReceipts ?? true };
}

/** At most 10 messages before the other person accepts (AC-F14-12). */
async function checkRequestLimit(deps: MessagesDeps, userId: string, place: Awaited<ReturnType<typeof seatIn>>) {
  const { other, seat } = place;
  if (!other || (other.state !== "pending" && other.state !== "declined")) return;
  const since = other.requestedAt ?? new Date(0);
  if ((await deps.messages.sentSince(seat.conversationId, userId, since)) >= CHATS_LIMITS.messagesWhilePending) {
    throw new AppError(403, "CHAT_REQUEST_LIMIT", `You can send more once ${other.name} accepts.`);
  }
}

/** The chat's accepted members: the only people a message may mention (AC-F14-22). */
const mentionable = (people: { userId: string; state: string }[]) =>
  new Set(people.filter((p) => p.state === "accepted").map((p) => p.userId));

/** An edit is cleaned like a new message: mentions of non-members become text (AC-F14-22). */
async function edit(deps: MessagesDeps, on: OnMessage, body: MessageDocument) {
  const place = await seatIn(deps, on.userId, on.conversationId, "editOwn");
  const cleaned = cleanMentions(body, mentionable(place.people));
  return editAs(deps.meetingChat, place.seat, on.messageId, {
    body: cleaned.document,
    mentionedUserIds: cleaned.mentioned,
  });
}

async function send(deps: MessagesDeps, userId: string, conversationId: string, input: SendInput) {
  const place = await seatIn(deps, userId, conversationId, "send");
  await checkRequestLimit(deps, userId, place);
  const members = mentionable(place.people);
  const cleaned = input.body ? cleanMentions(input.body, members) : undefined;
  const view = await sendFrom(deps.meetingChat, place.seat, {
    ...input,
    ...(cleaned ? { body: cleaned.document, mentionedUserIds: cleaned.mentioned } : {}),
  });
  // A hidden chat comes back with a new message (AC-F14-35).
  await deps.messages.unhide(conversationId);
  return view;
}

/** Who has seen a message (AC-F14-24); `null` when receipts don't apply. */
async function seen(deps: MessagesDeps, userId: string, conversationId: string, messageId: string) {
  const { seat, conversation, readReceipts } = await seatIn(deps, userId, conversationId, "read");
  const message = await readable(deps.meetingChat, seat, messageId);
  if (!message) throw notFound();
  const readers = await deps.messages.readers(conversationId);
  const kind = conversation.kind === "direct" ? "direct" : "group";
  const facts = { kind, members: readers.length, readerOn: true, senderOn: readReceipts } as const;
  if (!seenApplies(facts)) return { people: null };
  const people = readers
    .filter((r) => r.userId !== userId && r.readReceipts && r.lastReadAt && r.lastReadAt >= message.createdAt)
    .map((r) => ({ userId: r.userId, name: r.name }));
  return { people };
}

/** The people in a chat with their status and "(External)", for group details (AC-F14-14, 26). */
async function members(deps: MessagesDeps, userId: string, conversationId: string) {
  const { people } = await seatIn(deps, userId, conversationId, "read");
  const inChat = people.filter((p) => p.state === "accepted" || p.state === "pending");
  const statuses = await deps.statuses(
    userId,
    inChat.map((p) => p.userId),
  );
  return {
    people: inChat.map((p) => ({
      userId: p.userId,
      name: p.name,
      photoUrl: p.avatarKey ? `/api/v1/users/${p.userId}/avatar?v=${p.avatarKey}` : null,
      external: p.external,
      pending: p.state === "pending",
      status: statuses.get(p.userId) ?? null,
    })),
  };
}

type OnMessage = { userId: string; conversationId: string; messageId: string };

export function createChatsMessagesService(deps: MessagesDeps) {
  const seat = async (userId: string, conversationId: string, action: ChatsAction) =>
    (await seatIn(deps, userId, conversationId, action)).seat;
  const chat = deps.meetingChat;
  return {
    send: (userId: string, conversationId: string, input: SendInput) => send(deps, userId, conversationId, input),
    page: async (userId: string, conversationId: string, query: { before?: string | undefined; limit: number }) =>
      pageFor(chat, await seat(userId, conversationId, "read"), query),
    one: async ({ userId, conversationId, messageId }: OnMessage) =>
      oneFor(chat, await seat(userId, conversationId, "read"), messageId),
    events: async (userId: string, conversationId: string, after: number) =>
      eventsFor(chat, await seat(userId, conversationId, "read"), after),
    edit: (on: OnMessage, body: MessageDocument) => edit(deps, on, body),
    delete: async ({ userId, conversationId, messageId }: OnMessage) =>
      deleteAs(chat, await seat(userId, conversationId, "deleteOwn"), messageId),
    react: async ({ userId, conversationId, messageId }: OnMessage, emoji: string) =>
      reactAs(chat, await seat(userId, conversationId, "react"), messageId, emoji),
    unreact: async ({ userId, conversationId, messageId }: OnMessage, emoji: string) =>
      unreactAs(chat, await seat(userId, conversationId, "react"), messageId, emoji),
    seen: ({ userId, conversationId, messageId }: OnMessage) => seen(deps, userId, conversationId, messageId),
    setPrefs: async (userId: string, body: Partial<Record<"readReceipts" | "ringtone" | "ringVolume", unknown>>) => {
      const prefs = Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined)) as {
        readReceipts?: boolean;
        ringtone?: number;
        ringVolume?: number;
      };
      if (Object.keys(prefs).length === 0) return;
      await deps.messages.setPrefs(userId, prefs);
      // The person's own line now drops or passes "Seen" marks (AC-F14-24).
      if (prefs.readReceipts !== undefined) await deps.live.control(userId, { control: "refresh" });
    },
    /** Read receipts (F14) and the ringtone with its volume, kept with the account (F15 AC-F15-32). */
    prefs: async (userId: string) => {
      const me = await deps.messages.person(userId);
      return { readReceipts: me?.readReceipts ?? true, ringtone: me?.ringtone ?? 1, ringVolume: me?.ringVolume ?? 70 };
    },
    members: (userId: string, conversationId: string) => members(deps, userId, conversationId),
  };
}

export type ChatsMessagesService = ReturnType<typeof createChatsMessagesService>;
