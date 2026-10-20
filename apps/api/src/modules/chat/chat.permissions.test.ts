// Unit tests for the chat rights table (F03 design.md 3.1), every combination of role, group,
// presence, chat setting and call state.
import { CHAT_MODES, type ChatMode } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import { MEETING_ROLES, type Group, type MeetingRole } from "../calls/calls.permissions.ts";
import { canChat, type ChatAction, type ChatPresence } from "./chat.permissions.ts";

const ACTIONS: ChatAction[] = [
  "read",
  "send",
  "react",
  "vote",
  "attach",
  "editOwn",
  "deleteOwn",
  "deleteAny",
  "pin",
  "createPoll",
  "closeAnyPoll",
  "setMode",
];
const GROUPS: Group[] = ["member", "external", "guest"];
const PRESENCES: ChatPresence[] = ["lobby", "in_call", "left", "removed"];

/** Design 3.1 written out again on purpose, for someone in a running call. */
function expectedDuringCall(action: ChatAction, role: MeetingRole, group: Group, mode: ChatMode): boolean {
  const organizer = role === "organizer" || role === "co_organizer";
  const writing = ["send", "react", "vote", "attach", "createPoll"].includes(action);
  if (writing && mode === "off") return false;
  if (action === "attach") return group !== "guest";
  if (action === "createPoll") return role !== "attendee";
  if (["deleteAny", "pin", "closeAnyPoll", "setMode"].includes(action)) return organizer;
  return true;
}

/** Design 3.1, after the meeting: signed-in people who took part, read-only except organizers' clean-up. */
function expectedAfter(action: ChatAction, role: MeetingRole, group: Group, mode: ChatMode): boolean {
  const organizer = role === "organizer" || role === "co_organizer";
  if (group === "guest") return false;
  if (action === "read") return mode === "in_meeting" ? organizer : true;
  if (action === "deleteAny" || action === "pin") return organizer;
  return action === "setMode" && organizer;
}

type Case = {
  action: ChatAction;
  role: MeetingRole;
  group: Group;
  presence: ChatPresence;
  mode: ChatMode;
  callRunning: boolean;
};

function everyCase(): Case[] {
  return ACTIONS.flatMap((action) =>
    MEETING_ROLES.flatMap((role) =>
      GROUPS.flatMap((group) =>
        PRESENCES.flatMap((presence) =>
          CHAT_MODES.flatMap((mode) =>
            [true, false].map((callRunning) => ({ action, role, group, presence, mode, callRunning })),
          ),
        ),
      ),
    ),
  );
}

function expected(c: Case): boolean {
  if (c.callRunning && c.presence === "in_call") return expectedDuringCall(c.action, c.role, c.group, c.mode);
  if (!c.callRunning && c.presence === "left") return expectedAfter(c.action, c.role, c.group, c.mode);
  return false;
}

describe("TC-F03-94 permissions table", () => {
  it("TC-F03-94 [AC-F03-10] [AC-F03-11] [AC-F03-19] [AC-F03-21] [AC-F03-33] [AC-F03-35] [AC-F03-36] [AC-F03-38] [AC-F03-42] matches design 3.1 for every combination", () => {
    const cases = everyCase();
    for (const facts of cases) expect(canChat(facts.action, facts), JSON.stringify(facts)).toBe(expected(facts));
    expect(cases).toHaveLength(ACTIONS.length * 4 * 3 * 4 * 3 * 2);
  });

  it("TC-F03-94 [AC-F03-39] [AC-F03-40] lobby and removed people get nothing, during or after", () => {
    for (const action of ACTIONS)
      for (const presence of ["lobby", "removed"] as const)
        for (const callRunning of [true, false])
          expect(canChat(action, { role: "organizer", group: "member", presence, mode: "on", callRunning })).toBe(
            false,
          );
  });

  it("TC-F03-94 [AC-F03-41] a guest who left can no longer read", () => {
    expect(
      canChat("read", { role: "presenter", group: "guest", presence: "left", mode: "on", callRunning: false }),
    ).toBe(false);
  });

  it("TC-F03-94 [AC-F03-35] chat Off blocks writing but keeps reading and organizer clean-up", () => {
    const facts = {
      role: "organizer" as const,
      group: "member" as const,
      presence: "in_call" as const,
      mode: "off" as const,
      callRunning: true,
    };
    for (const action of ["send", "react", "vote", "attach", "createPoll"] as const)
      expect(canChat(action, facts)).toBe(false);
    for (const action of ["read", "deleteAny", "pin", "setMode"] as const) expect(canChat(action, facts)).toBe(true);
  });
});
