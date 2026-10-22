// The Chat screen's requests (F14 design.md section 5): the list, starting chats, finding people, chat
// requests, read marks and each person's own choices. Messages go through the shared chat place
// (features/meetings/chat, `conversationPlace`).
import type { ConversationList, ConversationListItem } from "@meetapp/contracts";
import { apiRequest } from "../api/index.ts";

export type ChatFilter = "all" | "unread" | "chats" | "meetings";
export type ChatItem = ConversationListItem;

export function chatList(workspaceId: string, filter: ChatFilter, q: string): Promise<ConversationList> {
  const query = new URLSearchParams({ filter, ...(q.trim() ? { q: q.trim() } : {}) });
  return apiRequest(`/api/v1/workspaces/${workspaceId}/conversations?${query.toString()}`);
}

/** One person opens the pair's chat (existing or new); two or more start a group (AC-F14-07, 09, 15). */
export function startChat(
  workspaceId: string,
  userIds: string[],
  name?: string,
): Promise<{ id: string; created: boolean }> {
  return apiRequest(`/api/v1/workspaces/${workspaceId}/conversations`, {
    method: "POST",
    body: { userIds, ...(name?.trim() ? { name: name.trim() } : {}) },
  });
}

export interface FoundPeople {
  people: {
    userId: string;
    name: string;
    photoUrl: string | null;
    external: boolean;
    status: "available" | "away" | "in_meeting" | "offline" | null;
  }[];
  noAccount: boolean;
}

export function findPeople(workspaceId: string, q: string): Promise<FoundPeople> {
  return apiRequest(`/api/v1/workspaces/${workspaceId}/people?q=${encodeURIComponent(q)}`);
}

/** "Join me on MeetApp" from Personal (AC-F14-08). */
export function inviteToMeetApp(email: string): Promise<undefined> {
  return apiRequest("/api/v1/me/invitations", { method: "POST", body: { email } });
}

/** "Read up to here", at most every 2 seconds (design 3.5). */
export function markRead(conversationId: string, seq: number): Promise<undefined> {
  return apiRequest(`/api/v1/conversations/${conversationId}/read`, { method: "PUT", body: { seq } });
}

/** Pin, mute or hide for oneself (AC-F14-05, 35). */
export function setMine(
  conversationId: string,
  change: { pinned?: boolean; muted?: boolean; hidden?: boolean },
): Promise<undefined> {
  return apiRequest(`/api/v1/conversations/${conversationId}/me`, { method: "PATCH", body: change });
}

// Chat requests (AC-F14-10–13).
export interface ChatRequest {
  conversationId: string;
  kind: "direct" | "group";
  from: { userId: string; name: string; photoUrl: string | null; email: string };
  groupName: string | null;
  requestedAt: string;
  preview: { senderName: string; text: string; at: string }[];
}

export function chatRequests(): Promise<{ requests: ChatRequest[] }> {
  return apiRequest("/api/v1/me/chat-requests");
}
export function acceptRequest(conversationId: string): Promise<undefined> {
  return apiRequest(`/api/v1/conversations/${conversationId}/accept`, { method: "POST" });
}
export function declineRequest(conversationId: string, block: boolean): Promise<undefined> {
  return apiRequest(`/api/v1/conversations/${conversationId}/decline`, { method: "POST", body: { block } });
}

// Groups (AC-F14-14–18).
export type History = { from: "none" } | { from: "days"; days: number } | { from: "all" };

export function renameGroup(conversationId: string, name: string): Promise<undefined> {
  return apiRequest(`/api/v1/conversations/${conversationId}`, { method: "PATCH", body: { name } });
}
export function addToGroup(conversationId: string, userIds: string[], history: History): Promise<undefined> {
  return apiRequest(`/api/v1/conversations/${conversationId}/members`, { method: "POST", body: { userIds, history } });
}
export function removeFromGroup(conversationId: string, userId: string): Promise<undefined> {
  return apiRequest(`/api/v1/conversations/${conversationId}/members/${userId}`, { method: "DELETE" });
}
export function leaveGroup(conversationId: string): Promise<undefined> {
  return apiRequest(`/api/v1/conversations/${conversationId}/leave`, { method: "POST" });
}

// Seen, read receipts and blocking (AC-F14-13, 24).
export function seenBy(
  conversationId: string,
  messageId: string,
): Promise<{ people: { userId: string; name: string }[] | null }> {
  return apiRequest(`/api/v1/conversations/${conversationId}/messages/${messageId}/seen`);
}
export function setReadReceipts(on: boolean): Promise<undefined> {
  return apiRequest("/api/v1/me/settings", { method: "PATCH", body: { readReceipts: on } });
}
export function blockedPeople(): Promise<{ people: { userId: string; name: string; photoUrl: string | null }[] }> {
  return apiRequest("/api/v1/me/blocked");
}
export function blockPerson(userId: string): Promise<undefined> {
  return apiRequest("/api/v1/me/blocked", { method: "POST", body: { userId } });
}
export function unblockPerson(userId: string): Promise<undefined> {
  return apiRequest(`/api/v1/me/blocked/${userId}`, { method: "DELETE" });
}
