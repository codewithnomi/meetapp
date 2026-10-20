// Requests inside a call (F02 design.md section 6), each with the meeting ticket: raise or lower your
// hand, end the meeting for everyone, and Meeting info.
import type { MeetingDetails } from "@meetapp/contracts";
import { apiRequest } from "../../api/index.ts";
import type { Joined } from "../visit.ts";

const call = (visit: Joined) => `/api/v1/calls/${visit.call?.callId ?? ""}`;
const headers = (visit: Joined) => ({ "x-meeting-ticket": visit.ticket });

export function raiseHand(visit: Joined, raised: boolean): Promise<undefined> {
  return apiRequest(`${call(visit)}/hand`, { method: "POST", body: { raised }, headers: headers(visit) });
}

export function endMeeting(visit: Joined): Promise<undefined> {
  return apiRequest(`${call(visit)}/end`, { method: "POST", headers: headers(visit) });
}

export function meetingInfo(visit: Joined): Promise<MeetingDetails> {
  return apiRequest(`${call(visit)}/meeting`, { headers: headers(visit) });
}

export interface Waiting {
  attendanceId: string;
  name: string;
  group: "member" | "external" | "guest";
  waitingSince: string;
}

/** The lobby, for those who may let people in (AC-F02-15). */
export function lobbyOf(visit: Joined): Promise<{ waiting: Waiting[] }> {
  return apiRequest(`${call(visit)}/lobby`, { headers: headers(visit) });
}

export function decideLobby(
  visit: Joined,
  decision: "admit" | "deny",
  who: { attendanceIds: string[] } | { all: true },
) {
  return apiRequest<{ decided: number; didNotFit: number }>(`${call(visit)}/lobby/${decision}`, {
    method: "POST",
    body: who,
    headers: headers(visit),
  });
}

/** Mute, lower the hand of, or remove one person (AC-F02-23, 33, 35). */
export function actOn(visit: Joined, personId: string, action: "mute" | "lower-hand" | "remove"): Promise<undefined> {
  return apiRequest(`${call(visit)}/participants/${personId}/${action}`, { method: "POST", headers: headers(visit) });
}

export function setRole(visit: Joined, personId: string, role: "presenter" | "attendee"): Promise<undefined> {
  return apiRequest(`${call(visit)}/participants/${personId}/role`, {
    method: "PATCH",
    body: { role },
    headers: headers(visit),
  });
}

export function muteAll(visit: Joined): Promise<undefined> {
  return apiRequest(`${call(visit)}/mute-all`, { method: "POST", headers: headers(visit) });
}

/** Lock or unlock (AC-F02-37). */
export function setLocked(visit: Joined, locked: boolean): Promise<undefined> {
  return apiRequest(call(visit), { method: "PATCH", body: { locked }, headers: headers(visit) });
}
