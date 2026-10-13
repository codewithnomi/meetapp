// Actions per row (TC-F01-61, AC-F01-21, 22, 23): what the owner, an admin and a member are offered.
import type { WorkspaceAction } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import { actionsFor } from "./member-actions.ts";

const person = (userId: string, role: "owner" | "admin" | "member") => ({
  userId,
  role,
  name: userId,
  email: `${userId}@example.test`,
  joinedAt: "2026-10-01T00:00:00.000Z",
  photoUrl: null,
});
const OWNER: WorkspaceAction[] = ["promoteMember", "removeMember", "demoteAdmin", "removeAdmin", "transfer"];
const ADMIN: WorkspaceAction[] = ["promoteMember", "removeMember", "leave"];
const MEMBER: WorkspaceAction[] = ["leave"];

describe("actionsFor", () => {
  it("TC-F01-61 [AC-F01-21, AC-F01-22] the owner manages admins and members, and hands over", () => {
    const allowed = new Set(OWNER);
    expect(actionsFor(person("m", "member"), "o", allowed)).toEqual(["promote", "transfer", "remove"]);
    expect(actionsFor(person("a", "admin"), "o", allowed)).toEqual(["demote", "transfer", "remove"]);
    expect(actionsFor(person("o", "owner"), "o", allowed)).toEqual([]);
  });

  it("TC-F01-61 [AC-F01-21] an admin manages members only, never the owner or other admins", () => {
    const allowed = new Set(ADMIN);
    expect(actionsFor(person("m", "member"), "a", allowed)).toEqual(["promote", "remove"]);
    expect(actionsFor(person("a2", "admin"), "a", allowed)).toEqual([]);
    expect(actionsFor(person("o", "owner"), "a", allowed)).toEqual([]);
  });

  it("TC-F01-61 [AC-F01-23] members and admins can leave from their own row", () => {
    expect(actionsFor(person("m", "member"), "m", new Set(MEMBER))).toEqual(["leave"]);
    expect(actionsFor(person("m2", "member"), "m", new Set(MEMBER))).toEqual([]);
  });
});
