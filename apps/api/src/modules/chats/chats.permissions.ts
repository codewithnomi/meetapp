// Who may do what in one-to-one and group chats (F14 design.md 3.2). The one place chat rights live:
// every chats service asks here. Membership and settings are read fresh on each request. Meeting chats
// keep F03's table (chat/chat.permissions.ts).
import type { MemberState } from "@meetapp/contracts";

export type ChatsAction =
  | "read"
  | "send"
  | "react"
  | "reply"
  | "pin"
  | "createPoll"
  | "editOwn"
  | "deleteOwn"
  | "addPeople"
  | "removePeople"
  | "rename"
  | "leave"
  | "preview"
  | "accept"
  | "decline"
  | "block"
  | "searchPeople";

export interface ChatsFacts {
  kind: "direct" | "group";
  state: MemberState;
  /** Removed from (or left) the conversation's workspace: that rule wins over everything (AC-F14-34). */
  outOfWorkspace: boolean;
  /** The person isn't a member of the conversation's workspace. */
  external: boolean;
  /** Direct chat only: the other person is external (only external people can be blocked, AC-F14-13). */
  otherExternal: boolean;
  /** Direct chat only: one of the two blocked the other (read-only for both, AC-F14-13). */
  blocked: boolean;
  /** The workspace turned outside chat off and this chat has an external member (read-only, AC-F14-27). */
  outsideOffWithExternal: boolean;
}

/** Actions that change the chat; refused while it is read-only. */
const WRITING: ReadonlySet<ChatsAction> = new Set([
  "send",
  "react",
  "reply",
  "pin",
  "createPoll",
  "editOwn",
  "deleteOwn",
  "addPeople",
  "rename",
]);
const GROUP_ONLY: ReadonlySet<ChatsAction> = new Set(["addPeople", "removePeople", "rename", "leave"]);
const REQUEST_ACTIONS: ReadonlySet<ChatsAction> = new Set(["preview", "accept", "decline", "block"]);

/** An accepted member (design 3.2, first rows; any member, as in Teams). */
function canAsMember(action: ChatsAction, facts: ChatsFacts): boolean {
  if (GROUP_ONLY.has(action) && facts.kind !== "group") return false;
  if (action === "searchPeople") return !facts.external;
  if (action === "block") return facts.kind === "direct" && facts.otherExternal;
  if (action === "preview" || action === "accept" || action === "decline") return false;
  if (WRITING.has(action) && (facts.blocked || facts.outsideOffWithExternal)) return false;
  return true;
}

/** Whether a person may do `action` in a one-to-one or group chat. Anything not allowed here is denied. */
export function canChats(action: ChatsAction, facts: ChatsFacts): boolean {
  if (facts.outOfWorkspace) return false;
  switch (facts.state) {
    case "accepted":
      return canAsMember(action, facts);
    case "pending":
      // Invited, not accepted: preview and decide only (AC-F14-10, 11, 13).
      return REQUEST_ACTIONS.has(action);
    case "left":
    case "removed":
      // Reads up to the moment they left (`left_seq`, checked by the service) (AC-F14-18).
      return action === "read";
    case "declined":
      return false;
  }
}
