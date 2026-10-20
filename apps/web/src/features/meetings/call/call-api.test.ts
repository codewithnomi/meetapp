// The requests inside a call carry the meeting ticket (AC-F02-15, 23, 33, 35, 37).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { VISIT } from "../fake-visit.ts";
import type { Joined } from "../visit.ts";
import * as api from "./call-api.ts";

const request = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../api/index.ts", () => ({ apiRequest: request }));

const visit = { ...VISIT, call: { callId: "c1", serverUrl: "wss://x", pass: "p" } } as Joined;
const headers = { "x-meeting-ticket": "ticket-1" };

beforeEach(() => request.mockClear());

describe("call requests", () => {
  it("TC-F02-47 [AC-F02-23] hand, end, info and lobby go to the call with the ticket", async () => {
    await api.raiseHand(visit, true);
    await api.endMeeting(visit);
    await api.meetingInfo(visit);
    await api.lobbyOf(visit);
    expect(request.mock.calls).toEqual([
      ["/api/v1/calls/c1/hand", { method: "POST", body: { raised: true }, headers }],
      ["/api/v1/calls/c1/end", { method: "POST", headers }],
      ["/api/v1/calls/c1/meeting", { headers }],
      ["/api/v1/calls/c1/lobby", { headers }],
    ]);
  });

  it("TC-F02-33 [AC-F02-15] admit or deny one, several or all", async () => {
    await api.decideLobby(visit, "admit", { attendanceIds: ["a"] });
    await api.decideLobby(visit, "deny", { all: true });
    expect(request.mock.calls).toEqual([
      ["/api/v1/calls/c1/lobby/admit", { method: "POST", body: { attendanceIds: ["a"] }, headers }],
      ["/api/v1/calls/c1/lobby/deny", { method: "POST", body: { all: true }, headers }],
    ]);
  });

  it("TC-F02-67 [AC-F02-35] acting on a person, roles, mute all and lock", async () => {
    await api.actOn(visit, "p1", "remove");
    await api.setRole(visit, "p1", "presenter");
    await api.muteAll(visit);
    await api.setLocked(visit, true);
    expect(request.mock.calls).toEqual([
      ["/api/v1/calls/c1/participants/p1/remove", { method: "POST", headers }],
      ["/api/v1/calls/c1/participants/p1/role", { method: "PATCH", body: { role: "presenter" }, headers }],
      ["/api/v1/calls/c1/mute-all", { method: "POST", headers }],
      ["/api/v1/calls/c1", { method: "PATCH", body: { locked: true }, headers }],
    ]);
  });

  it("TC-F02-67 [AC-F02-36] a visit without a call never reaches another call's address", async () => {
    await api.endMeeting(VISIT);
    expect(request).toHaveBeenCalledWith("/api/v1/calls//end", expect.anything());
  });
});
