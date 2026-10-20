// Unit tests for the meeting-role table and its helpers (F02 requirements.md, design.md 3.5 and 3.6).
import { describe, expect, it } from "vitest";
import {
  CALL_ROLE_TABLE,
  MEETING_ROLES,
  can,
  canActOn,
  publishSources,
  resolveRole,
  skipsLobby,
  type CallAction,
  type MeetingRole,
} from "./calls.permissions.ts";

/** requirements.md "What each meeting role can do", written out again on purpose: organizer, co-organizer, presenter, attendee. */
const REQUIREMENTS: Record<CallAction, [boolean, boolean, boolean, boolean]> = {
  talk: [true, true, true, true],
  share: [true, true, true, false],
  admit: [true, true, true, false],
  mute: [true, true, true, false],
  remove: [true, true, true, false],
  setRole: [true, true, true, false],
  options: [true, true, false, false],
  end: [true, true, false, false],
  nameCoOrganizers: [true, false, false, false],
};

describe("TC-F02-65 role table", () => {
  it("TC-F02-65 [AC-F02-25] [AC-F02-33] [AC-F02-35] [AC-F02-36] [AC-F02-37] [AC-F02-38] equals the requirements cell by cell", () => {
    for (const action of Object.keys(CALL_ROLE_TABLE) as CallAction[]) {
      MEETING_ROLES.forEach((role, column) => {
        expect(can(role, action), `${role} ${action}`).toBe(REQUIREMENTS[action][column]);
      });
    }
  });

  it("TC-F02-65 [AC-F02-36] nobody removes the organizer or changes their role; co-organizers change only by naming", () => {
    for (const actor of MEETING_ROLES) {
      expect(canActOn(actor, "remove", "organizer")).toBe(false);
      expect(canActOn(actor, "setRole", "organizer")).toBe(false);
      expect(canActOn(actor, "setRole", "co_organizer")).toBe(false);
    }
    expect(canActOn("presenter", "mute", "organizer")).toBe(true);
    expect(canActOn("presenter", "remove", "co_organizer")).toBe(true);
    expect(canActOn("attendee", "mute", "presenter")).toBe(false);
  });
});

describe("TC-F02-66 role resolution", () => {
  const facts = { isOrganizer: false, isCoOrganizer: false, roleOverride: null, group: "member" as const };

  it("TC-F02-66 [AC-F02-36] organizer, co-organizer, a role given in the call, then Who can present", () => {
    expect(resolveRole({ ...facts, isOrganizer: true, isCoOrganizer: true, whoCanPresent: "organizers" })).toBe(
      "organizer",
    );
    expect(resolveRole({ ...facts, isCoOrganizer: true, roleOverride: "attendee", whoCanPresent: "everyone" })).toBe(
      "co_organizer",
    );
    expect(resolveRole({ ...facts, roleOverride: "attendee", whoCanPresent: "everyone" })).toBe("attendee");
    expect(resolveRole({ ...facts, roleOverride: "presenter", whoCanPresent: "organizers" })).toBe("presenter");
    const expected: [string, string, MeetingRole][] = [
      ["everyone", "guest", "presenter"],
      ["workspace", "member", "presenter"],
      ["workspace", "external", "attendee"],
      ["workspace", "guest", "attendee"],
      ["organizers", "member", "attendee"],
    ];
    for (const [whoCanPresent, group, role] of expected) {
      expect(
        resolveRole({ ...facts, group: group as "member", whoCanPresent: whoCanPresent as "everyone" }),
        `${whoCanPresent}/${group}`,
      ).toBe(role);
    }
  });

  it("TC-F02-96 [AC-F02-25] [AC-F02-34] presenters send everything; attendees never share and lose switched-off devices", () => {
    const on = { allowAttendeeMic: true, allowAttendeeCamera: true };
    expect(publishSources("presenter", { allowAttendeeMic: false, allowAttendeeCamera: false })).toEqual([
      "camera",
      "microphone",
      "screen_share",
    ]);
    expect(publishSources("attendee", on)).toEqual(["camera", "microphone"]);
    expect(publishSources("attendee", { ...on, allowAttendeeMic: false })).toEqual(["camera"]);
    expect(publishSources("attendee", { allowAttendeeMic: false, allowAttendeeCamera: false })).toEqual([]);
  });
});

describe("TC-F02-27 lobby rules", () => {
  const base = { role: "presenter" as MeetingRole, accountInCall: true };

  it("TC-F02-27 [AC-F02-14] [AC-F02-16] [AC-F02-17] who skips the lobby", () => {
    expect(skipsLobby({ ...base, group: "member", lobbyBypass: "workspace" })).toBe(true);
    expect(skipsLobby({ ...base, group: "external", lobbyBypass: "workspace" })).toBe(false);
    expect(skipsLobby({ ...base, group: "guest", lobbyBypass: "workspace" })).toBe(false);
    expect(skipsLobby({ ...base, group: "guest", lobbyBypass: "everyone" })).toBe(true);
    expect(skipsLobby({ ...base, group: "guest", lobbyBypass: "everyone", accountInCall: false })).toBe(false);
    expect(skipsLobby({ ...base, group: "member", lobbyBypass: "organizers" })).toBe(false);
    expect(skipsLobby({ ...base, role: "co_organizer", group: "member", lobbyBypass: "organizers" })).toBe(true);
    expect(
      skipsLobby({ ...base, role: "organizer", group: "member", lobbyBypass: "organizers", accountInCall: false }),
    ).toBe(true);
  });
});
