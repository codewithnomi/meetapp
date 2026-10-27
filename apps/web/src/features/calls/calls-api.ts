// Calls from chats: the requests (F15 design.md section 5). The answers are F02's join answer, so the call
// screen connects the same way as for a meeting.
import type { ActiveCalls, CallMedia, RunningCall } from "./call-types.ts";
import type { Joined } from "../meetings/index.ts";
import { apiRequest } from "../api/index.ts";

export function startCall(conversationId: string, media: CallMedia): Promise<Joined> {
  return apiRequest(`/api/v1/conversations/${conversationId}/calls`, { method: "POST", body: { media } });
}

export function joinCall(callId: string): Promise<Joined> {
  return apiRequest(`/api/v1/calls/${callId}/join`, { method: "POST" });
}

export function runningCall(conversationId: string): Promise<RunningCall> {
  return apiRequest(`/api/v1/conversations/${conversationId}/call`);
}

export function cancelRing(callId: string): Promise<undefined> {
  return apiRequest(`/api/v1/calls/${callId}/ring`, { method: "DELETE" });
}

export function acceptCall(callId: string, media: CallMedia): Promise<Joined> {
  return apiRequest(`/api/v1/calls/${callId}/accept`, { method: "POST", body: { media } });
}

export function declineCall(callId: string): Promise<undefined> {
  return apiRequest(`/api/v1/calls/${callId}/decline`, { method: "POST" });
}

/** The person's ringtone and its volume (AC-F15-32), kept on the account. */
export function ringSettings(): Promise<{ ringtone: number; ringVolume: number }> {
  return apiRequest("/api/v1/me/settings");
}

/** Add people: rings chat members who aren't in the call (AC-F15-13). */
export function ringPeople(callId: string, userIds: string[]): Promise<undefined> {
  return apiRequest(`/api/v1/calls/${callId}/ring`, { method: "POST", body: { userIds } });
}

/** The person's running chat calls and which devices are in them (AC-F15-33). */
export function activeCalls(): Promise<ActiveCalls> {
  return apiRequest("/api/v1/me/calls/active");
}

/** Moves the call to this device: it connects first, then the old seat is taken out (AC-F15-33). */
export function transferCall(callId: string, fromAttendanceId: string): Promise<Joined> {
  return apiRequest(`/api/v1/calls/${callId}/transfer`, { method: "POST", body: { fromAttendanceId } });
}
