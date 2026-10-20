// Chat requests during a call (F03 design.md section 8), each with the meeting ticket.
import type { ChatEvent, ChatMessageView, MessageDocument } from "@meetapp/contracts";
import { apiRequest } from "../../api/index.ts";
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
  message: { clientId: string; body: MessageDocument },
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
