// The chats permission table (F14 TC-F14-65, design 3.2): every action in every state, kind and setting.
import { MEMBER_STATES } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import { canChats, type ChatsAction, type ChatsFacts } from "./chats.permissions.ts";

const ACTIONS: ChatsAction[] = [
  "read",
  "send",
  "react",
  "reply",
  "pin",
  "createPoll",
  "editOwn",
  "deleteOwn",
  "addPeople",
  "removePeople",
  "rename",
  "leave",
  "preview",
  "accept",
  "decline",
  "block",
  "searchPeople",
];
const WRITING: ChatsAction[] = [
  "send",
  "react",
  "reply",
  "pin",
  "createPoll",
  "editOwn",
  "deleteOwn",
  "addPeople",
  "rename",
];

const facts = (over: Partial<ChatsFacts> = {}): ChatsFacts => ({
  kind: "group",
  state: "accepted",
  outOfWorkspace: false,
  external: false,
  otherExternal: false,
  blocked: false,
  outsideOffWithExternal: false,
  ...over,
});
const allowed = (f: ChatsFacts) => ACTIONS.filter((action) => canChats(action, f));

describe("chats permissions", () => {
  it("TC-F14-65 [AC-F14-15] [AC-F14-16] [AC-F14-18] an accepted group member does everything a member does, as in Teams", () => {
    expect(allowed(facts())).toEqual([
      "read",
      "send",
      "react",
      "reply",
      "pin",
      "createPoll",
      "editOwn",
      "deleteOwn",
      "addPeople",
      "removePeople",
      "rename",
      "leave",
      "searchPeople",
    ]);
  });

  it("TC-F14-65 a direct chat has no group actions; only an external other person can be blocked (AC-F14-13)", () => {
    const direct = allowed(facts({ kind: "direct" }));
    for (const action of ["addPeople", "removePeople", "rename", "leave", "block"] as const)
      expect(direct).not.toContain(action);
    expect(canChats("block", facts({ kind: "direct", otherExternal: true }))).toBe(true);
    expect(canChats("block", facts({ kind: "group", otherExternal: true }))).toBe(false);
  });

  it("TC-F14-65 [AC-F14-10] [AC-F14-11] pending: preview and decide only", () => {
    expect(allowed(facts({ state: "pending", external: true }))).toEqual(["preview", "accept", "decline", "block"]);
  });

  it("TC-F14-65 [AC-F14-18] declined gets nothing; left and removed read only (up to left_seq)", () => {
    expect(allowed(facts({ state: "declined" }))).toEqual([]);
    expect(allowed(facts({ state: "left" }))).toEqual(["read"]);
    expect(allowed(facts({ state: "removed" }))).toEqual(["read"]);
  });

  it("TC-F14-65 [AC-F14-34] removed from the workspace: nothing, in every state", () => {
    for (const state of MEMBER_STATES) expect(allowed(facts({ state, outOfWorkspace: true }))).toEqual([]);
  });

  it("TC-F14-65 [AC-F14-13] [AC-F14-27] a blocked direct chat and outside chat off are read-only", () => {
    for (const f of [facts({ kind: "direct", blocked: true }), facts({ outsideOffWithExternal: true })]) {
      for (const action of WRITING) expect(canChats(action, f)).toBe(false);
      expect(canChats("read", f)).toBe(true);
    }
    // Leaving and removing people still work while read-only.
    expect(canChats("leave", facts({ outsideOffWithExternal: true }))).toBe(true);
  });

  it("TC-F14-65 an accepted external member chats like a member but can't search the workspace's people", () => {
    const external = facts({ external: true });
    expect(canChats("send", external)).toBe(true);
    expect(canChats("searchPeople", external)).toBe(false);
    expect(canChats("accept", facts())).toBe(false);
  });
});
