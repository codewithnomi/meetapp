// F13 rights per role (AC-F13-20, AC-F13-26, TC-F13-12).
import { describe, expect, it } from "vitest";
import { decide, type ScheduleAction, type ScheduleFacts } from "./scheduling.permissions.ts";

const base: ScheduleFacts = { inWorkspace: true, organizer: false, coOrganizer: false, invitedMember: false };
const ACTIONS: ScheduleAction[] = ["see", "edit", "cancel", "answer", "seeEmails"];
const all = (facts: Partial<ScheduleFacts>) => ACTIONS.map((action) => decide(action, { ...base, ...facts }));

describe("scheduling rights", () => {
  it("TC-F13-12 [AC-F13-20, AC-F13-26] organizer and co-organizer may do everything except answer when not invited", () => {
    expect(all({ organizer: true })).toEqual(["allow", "allow", "allow", "forbidden", "allow"]);
    expect(all({ coOrganizer: true, invitedMember: true })).toEqual(["allow", "allow", "allow", "allow", "allow"]);
  });

  it("TC-F13-12 [AC-F13-20] an invited member may see and answer only", () => {
    expect(all({ invitedMember: true })).toEqual(["allow", "forbidden", "forbidden", "allow", "forbidden"]);
  });

  it("TC-F13-12 [AC-F13-26] everyone else gets not found", () => {
    expect(all({})).toEqual(Array(5).fill("notFound"));
    expect(all({ inWorkspace: false, organizer: true })).toEqual(Array(5).fill("notFound"));
    expect(all({ inWorkspace: false, invitedMember: true })).toEqual(Array(5).fill("notFound"));
  });
});
