// Chat requests (F03 design.md section 8): during a call each carries the meeting ticket; after the
// meeting, reading (and organizers' Delete) goes through the signed-in meeting routes.
import type { ChatEvent, ChatMessageView, MessageDocument, PollView, RecentMeetingChats } from "@meetapp/contracts";
import { apiRequest } from "../../api/index.ts";
import type { Outgoing } from "./chat-state.ts";
import type { Joined } from "../visit.ts";

const base = (visit: Joined) => `/api/v1/calls/${visit.call?.callId ?? ""}/chat`;
const headers = (visit: Joined) => ({ "x-meeting-ticket": visit.ticket });

/** Where reading requests go: a running call (with the ticket) or a past meeting (signed in). */
export interface ChatPlace {
  path: string;
  headers: Record<string, string>;
  /** The viewer's own join of this call, to show "You"; unknown after the meeting. */
  attendanceId?: string | undefined;
  /** The running call (during a call): own messages from it can be edited or deleted. */
  callId?: string | undefined;
}

export const callPlace = (visit: Joined): ChatPlace => ({
  path: base(visit),
  headers: headers(visit),
  attendanceId: visit.attendanceId,
  callId: visit.call?.callId,
});
export const pastPlace = (meetingId: string): ChatPlace => ({
  path: `/api/v1/meetings/${meetingId}/chat`,
  headers: {},
});

/** Past meetings whose chat the viewer may open (AC-F03-42). */
export function recentMeetingChats(): Promise<RecentMeetingChats> {
  return apiRequest("/api/v1/me/meeting-chats");
}

export interface MessagesPage {
  messages: ChatMessageView[];
  hasMore: boolean;
  pinned?: ChatMessageView[] | undefined;
  lastSeq?: number | undefined;
}

export function messagesPage(place: ChatPlace, before?: string): Promise<MessagesPage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiRequest(`${place.path}/messages${query}`, { headers: place.headers });
}

export function oneMessage(visit: Joined, id: string): Promise<ChatMessageView> {
  return apiRequest(`${base(visit)}/messages/${id}`, { headers: headers(visit) });
}

/** Missed news after a reconnect (design 3.4). */
export function eventsAfter(visit: Joined, after: number): Promise<{ events: ChatEvent[]; gap: boolean }> {
  return apiRequest(`${base(visit)}/events?after=${String(after)}`, { headers: headers(visit) });
}

/** Sends a message; the same `clientId` again never makes a second one (AC-F03-05). */
export function sendMessage(
  visit: Joined,
  message: Outgoing & { clientId: string; replyToId?: string | undefined },
): Promise<ChatMessageView> {
  return apiRequest(`${base(visit)}/messages`, { method: "POST", body: message, headers: headers(visit) });
}

/** Adds or takes back the viewer's reaction (AC-F03-13). */
export function setReaction(place: ChatPlace, messageId: string, emoji: string, on: boolean): Promise<undefined> {
  const url = `${place.path}/messages/${messageId}/reactions`;
  return on
    ? apiRequest(url, { method: "POST", body: { emoji }, headers: place.headers })
    : apiRequest(`${url}/${encodeURIComponent(emoji)}`, { method: "DELETE", headers: place.headers });
}

const json = (visit: Joined | ChatPlace, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) => ({
  method,
  headers: "path" in visit ? visit.headers : headers(visit),
  ...(body === undefined ? {} : { body }),
});

/** Edit or delete a message (AC-F03-10, 11). */
export function editMessage(visit: Joined, id: string, body: MessageDocument): Promise<ChatMessageView> {
  return apiRequest(`${base(visit)}/messages/${id}`, json(visit, "PATCH", { body }));
}
export function deleteMessage(place: ChatPlace, id: string): Promise<undefined> {
  return apiRequest(`${place.path}/messages/${id}`, json(place, "DELETE"));
}

/** Pin for everyone, or unpin (AC-F03-19, 20). */
export function setPinned(place: ChatPlace, messageId: string, pinned: boolean): Promise<undefined> {
  return pinned
    ? apiRequest(`${place.path}/pins`, json(place, "POST", { messageId }))
    : apiRequest(`${place.path}/pins/${messageId}`, json(place, "DELETE"));
}

/** Polls (AC-F03-21–23). */
export function createPoll(visit: Joined, poll: NewPollInput): Promise<PollView> {
  return apiRequest(`${base(visit)}/polls`, json(visit, "POST", { clientId: crypto.randomUUID(), ...poll }));
}
export function pollOf(place: ChatPlace, pollId: string): Promise<PollView> {
  return apiRequest(`${place.path}/polls/${pollId}`, { headers: place.headers });
}
export function votePoll(place: ChatPlace, pollId: string, optionIds: string[]): Promise<PollView> {
  return apiRequest(`${place.path}/polls/${pollId}/vote`, json(place, "PUT", { optionIds }));
}
export function closePoll(place: ChatPlace, pollId: string): Promise<undefined> {
  return apiRequest(`${place.path}/polls/${pollId}/close`, json(place, "POST"));
}

export interface NewPollInput {
  question: string;
  options: string[];
  multiple: boolean;
  anonymous: boolean;
}
