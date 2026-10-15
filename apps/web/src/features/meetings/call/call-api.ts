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
