// Who may do what in meeting chat (F03 design.md 3.1). The one place chat rights live: every chat
// service asks here. Roles come from the F02 role table (calls.permissions.ts), read fresh each time.
import type { ChatMode } from "@meetapp/contracts";
import type { Group, MeetingRole } from "../calls/calls.permissions.ts";

export type ChatAction =
  | "read"
  | "download"
  | "send"
  | "react"
  | "vote"
  | "attach"
  | "editOwn"
  | "deleteOwn"
  | "deleteAny"
  | "pin"
  | "createPoll"
  | "closeAnyPoll"
  | "setMode";

/** Where the person stands in this meeting. Lobby, left and removed people get nothing during the call. */
export type ChatPresence = "lobby" | "in_call" | "left" | "removed";

export interface ChatFacts {
  role: MeetingRole;
  group: Group;
  presence: ChatPresence;
  /** The meeting's chat setting now (during a call) or at the end of the latest call (afterwards). */
  mode: ChatMode;
  /** Whether a call of this meeting is running. */
  callRunning: boolean;
}

const ORGANIZERS: readonly MeetingRole[] = ["organizer", "co_organizer"];
const POLL_MAKERS: readonly MeetingRole[] = ["organizer", "co_organizer", "presenter"];
const WRITING: ReadonlySet<ChatAction> = new Set(["send", "react", "vote", "attach", "createPoll"]);

const isOrganizer = (role: MeetingRole) => ORGANIZERS.includes(role);

/** During a running call, for someone admitted or in it (design 3.1, first rows). */
function canDuringCall(action: ChatAction, facts: ChatFacts): boolean {
  if (WRITING.has(action) && facts.mode === "off") return false;
  switch (action) {
    case "read":
    case "send":
    case "react":
    case "vote":
    case "editOwn":
    case "deleteOwn":
      return true;
    case "attach":
    case "download":
      return facts.group !== "guest";
    case "createPoll":
      return POLL_MAKERS.includes(facts.role);
    case "deleteAny":
    case "pin":
    case "closeAnyPoll":
    case "setMode":
      return isOrganizer(facts.role);
  }
}

/**
 * After the meeting (no call running), for signed-in people who took part and weren't removed:
 * read-only, except organizer and co-organizer clean-up (AC-F03-11, 36, 42).
 */
function canAfterMeeting(action: ChatAction, facts: ChatFacts): boolean {
  if (facts.group === "guest") return false;
  const reads = facts.mode === "in_meeting" ? isOrganizer(facts.role) : true;
  if (action === "read" || action === "download") return reads;
  if (action === "deleteAny" || action === "pin") return reads && isOrganizer(facts.role);
  // The setting can be changed between calls; it applies to the next call (design 3.8).
  return action === "setMode" && isOrganizer(facts.role);
}

/**
 * Whether a person may do `action` in this meeting's chat. Own-message edits are further limited to
 * the call the message was sent in, which the service checks with the message's `call_id`.
 */
export function canChat(action: ChatAction, facts: ChatFacts): boolean {
  if (facts.presence === "removed" || facts.presence === "lobby") return false;
  if (facts.callRunning) return facts.presence === "in_call" && canDuringCall(action, facts);
  return facts.presence === "left" && canAfterMeeting(action, facts);
}
