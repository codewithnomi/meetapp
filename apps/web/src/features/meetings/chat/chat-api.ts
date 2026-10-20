// Chat requests during a call (F03 design.md section 8), each with the meeting ticket.
import type { ChatEvent, ChatMessageView, MessageDocument, PollView } from "@meetapp/contracts";
import { apiRequest } from "../../api/index.ts";
import type { Outgoing } from "./chat-state.ts";
import type { Joined } from "../visit.ts";

const base = (visit: Joined) => `/api/v1/calls/${visit.call?.callId ?? ""}/chat`;
const headers = (visit: Joined) => ({ "x-meeting-ticket": visit.ticket });

export interface MessagesPage {
  messages: ChatMessageView[];
  hasMore: boolean;
  pinned?: ChatMessageView[] | undefined;
}

export function messagesPage(visit: Joined, before?: string): Promise<MessagesPage> {
  const query = before ? `?before=${encodeURIComponent(before)}` : "";
  return apiRequest(`${base(visit)}/messages${query}`, { headers: headers(visit) });
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
export function setReaction(visit: Joined, messageId: string, emoji: string, on: boolean): Promise<undefined> {
  const url = `${base(visit)}/messages/${messageId}/reactions`;
  return on
    ? apiRequest(url, { method: "POST", body: { emoji }, headers: headers(visit) })
    : apiRequest(`${url}/${encodeURIComponent(emoji)}`, { method: "DELETE", headers: headers(visit) });
}

const json = (visit: Joined, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown) => ({
  method,
  headers: headers(visit),
  ...(body === undefined ? {} : { body }),
});

/** Edit or delete a message (AC-F03-10, 11). */
export function editMessage(visit: Joined, id: string, body: MessageDocument): Promise<ChatMessageView> {
  return apiRequest(`${base(visit)}/messages/${id}`, json(visit, "PATCH", { body }));
}
export function deleteMessage(visit: Joined, id: string): Promise<undefined> {
  return apiRequest(`${base(visit)}/messages/${id}`, json(visit, "DELETE"));
}

/** Pin for everyone, or unpin (AC-F03-19, 20). */
export function setPinned(visit: Joined, messageId: string, pinned: boolean): Promise<undefined> {
  return pinned
    ? apiRequest(`${base(visit)}/pins`, json(visit, "POST", { messageId }))
    : apiRequest(`${base(visit)}/pins/${messageId}`, json(visit, "DELETE"));
}

/** Polls (AC-F03-21–23). */
export function createPoll(visit: Joined, poll: NewPollInput): Promise<PollView> {
  return apiRequest(`${base(visit)}/polls`, json(visit, "POST", { clientId: crypto.randomUUID(), ...poll }));
}
export function pollOf(visit: Joined, pollId: string): Promise<PollView> {
  return apiRequest(`${base(visit)}/polls/${pollId}`, { headers: headers(visit) });
}
export function votePoll(visit: Joined, pollId: string, optionIds: string[]): Promise<PollView> {
  return apiRequest(`${base(visit)}/polls/${pollId}/vote`, json(visit, "PUT", { optionIds }));
}
export function closePoll(visit: Joined, pollId: string): Promise<undefined> {
  return apiRequest(`${base(visit)}/polls/${pollId}/close`, json(visit, "POST"));
}

export interface NewPollInput {
  question: string;
  options: string[];
  multiple: boolean;
  anonymous: boolean;
}
