// Who may do what in a meeting (F02 requirements.md "What each meeting role can do", design.md 3.5 and
// 3.6). The one place meeting-role checks live: every call service asks here.
import type { MediaSource } from "../../providers/livekit.ts";

export const MEETING_ROLES = ["organizer", "co_organizer", "presenter", "attendee"] as const;
export type MeetingRole = (typeof MEETING_ROLES)[number];
export type Audience = "everyone" | "workspace" | "organizers";
export type Group = "member" | "external" | "guest";

export type CallAction =
  "talk" | "share" | "admit" | "mute" | "remove" | "setRole" | "options" | "end" | "nameCoOrganizers";

const ALL: readonly MeetingRole[] = MEETING_ROLES;
const RUNS_THE_MEETING: readonly MeetingRole[] = ["organizer", "co_organizer", "presenter"];
const ORGANIZERS: readonly MeetingRole[] = ["organizer", "co_organizer"];

/** The requirements' table, row by row. Every action has a row (the type makes a missing one an error). */
export const CALL_ROLE_TABLE: Record<CallAction, readonly MeetingRole[]> = {
  // Talk, video, raise a hand, react, pin for themselves.
  talk: ALL,
  share: RUNS_THE_MEETING,
  // Let people in from the lobby, or deny them.
  admit: RUNS_THE_MEETING,
  // Mute someone or everyone; lower someone's hand.
  mute: RUNS_THE_MEETING,
  remove: RUNS_THE_MEETING,
  // Make someone a presenter or attendee.
  setRole: RUNS_THE_MEETING,
  // Meeting options (lobby, who can present, attendees' mic and camera) and the lock.
  options: ORGANIZERS,
  end: ORGANIZERS,
  nameCoOrganizers: ["organizer"],
};

export const can = (role: MeetingRole, action: CallAction) => CALL_ROLE_TABLE[action].includes(role);

/**
 * Whether `actor` may do `action` to someone with `target`'s role. Nobody can remove the organizer or
 * change their role; a co-organizer's role is changed only by the organizer naming or un-naming them.
 */
export function canActOn(actor: MeetingRole, action: "remove" | "setRole" | "mute", target: MeetingRole): boolean {
  if (!can(actor, action)) return false;
  if (target === "organizer") return action === "mute";
  if (target === "co_organizer" && action === "setRole") return false;
  return true;
}

export interface RoleFacts {
  isOrganizer: boolean;
  isCoOrganizer: boolean;
  /** Set when someone made this person a presenter or attendee during the call. */
  roleOverride: "presenter" | "attendee" | null;
  group: Group;
  whoCanPresent: Audience;
}

/** A person's role (design.md 3.6): organizer, named co-organizer, a role given in the call, or the default. */
export function resolveRole(facts: RoleFacts): MeetingRole {
  if (facts.isOrganizer) return "organizer";
  if (facts.isCoOrganizer) return "co_organizer";
  if (facts.roleOverride) return facts.roleOverride;
  if (facts.whoCanPresent === "everyone") return "presenter";
  if (facts.whoCanPresent === "workspace" && facts.group === "member") return "presenter";
  return "attendee";
}

/** What a role may send (AC-F02-25, AC-F02-34): attendees never share, and lose mic or camera when switched off. */
export function publishSources(
  role: MeetingRole,
  options: { allowAttendeeMic: boolean; allowAttendeeCamera: boolean },
): MediaSource[] {
  if (can(role, "share")) return ["camera", "microphone", "screen_share"];
  return [
    ...(options.allowAttendeeCamera ? (["camera"] as const) : []),
    ...(options.allowAttendeeMic ? (["microphone"] as const) : []),
  ];
}

/** Who skips the lobby (AC-F02-14, 16, 17): guests only when someone with an account is in the call. */
export function skipsLobby(facts: {
  role: MeetingRole;
  group: Group;
  lobbyBypass: Audience;
  accountInCall: boolean;
}): boolean {
  if (facts.role === "organizer" || facts.role === "co_organizer") return true;
  if (facts.group === "guest" && !facts.accountInCall) return false;
  if (facts.lobbyBypass === "everyone") return true;
  return facts.lobbyBypass === "workspace" && facts.group === "member";
}
