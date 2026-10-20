// The app shows only what the backend allows (AC-F02-36): the same table as calls.permissions.ts.
import { describe, expect, it } from "vitest";
import { can, canActOn } from "./permissions.ts";

describe("meeting permissions in the app", () => {
  it("TC-F02-67 [AC-F02-36] presenters run the meeting; options and End are for organizers", () => {
    expect([
      can("presenter", "admit"),
      can("attendee", "mute"),
      can("presenter", "end"),
      can("co_organizer", "options"),
    ]).toEqual([true, false, false, true]);
  });

  it("TC-F02-67 [AC-F02-36] the organizer can be muted but not removed or demoted", () => {
    expect(canActOn("co_organizer", "mute", "organizer")).toBe(true);
    expect(canActOn("co_organizer", "remove", "organizer")).toBe(false);
    expect(canActOn("organizer", "setRole", "co_organizer")).toBe(false);
    expect(canActOn("presenter", "setRole", "attendee")).toBe(true);
  });
});
