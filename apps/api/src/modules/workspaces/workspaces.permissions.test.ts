// TC-F01-56 (AC-F01-21, 32): the role table matches design.md section 5 exactly, for every action and
// every role, and an action added without a row fails here.
import { WORKSPACE_ACTIONS, type MemberRole, type WorkspaceAction } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import {
  ROLE_TABLE,
  allowedActions,
  can,
  ensureAllowed,
  removalAction,
  roleChangeAction,
  type Membership,
} from "./workspaces.permissions.ts";

/** design.md section 5, written out again on purpose: owner, admin, member. */
const DESIGN_TABLE: Record<WorkspaceAction, [boolean, boolean, boolean]> = {
  viewMembers: [true, true, true],
  copyJoinLink: [true, true, true],
  inviteMember: [true, true, true],
  inviteAdmin: [true, true, false],
  cancelAnyInvitation: [true, true, false],
  cancelOwnInvitation: [true, true, true],
  manageJoinLink: [true, true, false],
  decideRequests: [true, true, false],
  rename: [true, true, false],
  promoteMember: [true, true, false],
  removeMember: [true, true, false],
  demoteAdmin: [true, false, false],
  removeAdmin: [true, false, false],
  transfer: [true, false, false],
  leave: [false, true, true],
};

const ROLES: MemberRole[] = ["owner", "admin", "member"];
const company = (role: MemberRole): Membership => ({
  workspaceId: "w1",
  userId: "u1",
  name: "Team",
  kind: "company",
  role,
});

describe("TC-F01-56 [AC-F01-21] [AC-F01-32] role table", () => {
  it("TC-F01-56 [AC-F01-32] every action has a row, and no row is left over", () => {
    expect(Object.keys(ROLE_TABLE).sort()).toEqual([...WORKSPACE_ACTIONS].sort());
    expect(Object.keys(DESIGN_TABLE).sort()).toEqual([...WORKSPACE_ACTIONS].sort());
  });

  it.each(WORKSPACE_ACTIONS)("TC-F01-56 [AC-F01-32] %s follows the design table", (action) => {
    expect(ROLES.map((role) => can(role, action))).toEqual(DESIGN_TABLE[action]);
    expect(can(undefined, action)).toBe(false);
  });

  it("TC-F01-56 [AC-F01-21] nobody can change or remove the owner; an admin's fate is the owner's call", () => {
    expect(roleChangeAction("owner")).toBeUndefined();
    expect(removalAction("owner")).toBeUndefined();
    expect(roleChangeAction("admin")).toBe("demoteAdmin");
    expect(removalAction("admin")).toBe("removeAdmin");
    expect(roleChangeAction("member")).toBe("promoteMember");
    expect(removalAction("member")).toBe("removeMember");
  });

  it("TC-F01-56 [AC-F01-32] a refusal is 403 FORBIDDEN", () => {
    expect(() => ensureAllowed(company("member"), "rename")).toThrow(expect.objectContaining({ status: 403 }));
    expect(() => ensureAllowed(company("admin"), "transfer")).toThrow(expect.objectContaining({ code: "FORBIDDEN" }));
    expect(() => ensureAllowed(company("owner"), "transfer")).not.toThrow();
  });

  it("TC-F01-38 [AC-F01-14] the personal workspace allows only seeing itself (409 PERSONAL_WORKSPACE)", () => {
    const personal: Membership = { ...company("owner"), kind: "personal" };
    expect(allowedActions(personal)).toEqual(["viewMembers"]);
    for (const action of ["rename", "transfer", "inviteMember", "manageJoinLink"] as const) {
      expect(() => ensureAllowed(personal, action)).toThrow(expect.objectContaining({ code: "PERSONAL_WORKSPACE" }));
    }
  });

  it("TC-F01-55 [AC-F01-21] the app is offered exactly what the role allows", () => {
    for (const role of ROLES) {
      const expected = WORKSPACE_ACTIONS.filter((action) => DESIGN_TABLE[action][ROLES.indexOf(role)]);
      expect(allowedActions(company(role))).toEqual(expected);
    }
  });
});
