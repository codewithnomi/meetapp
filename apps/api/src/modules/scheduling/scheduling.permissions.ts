// Who may do what with a scheduled meeting (F13 design.md "Security & privacy", AC-F13-20, 26, 27).
// The one place these rights live: every scheduling service asks here. Facts are read fresh per request.
// Anyone who may not see the meeting gets "not found", revealing nothing; an invitee who may see it but
// not change it gets "forbidden".

export type ScheduleAction = "see" | "edit" | "cancel" | "answer" | "seeEmails";
export type ScheduleDecision = "allow" | "forbidden" | "notFound";

export interface ScheduleFacts {
  /** A member of the meeting's workspace now (left or removed members see nothing, AC-F13-29). */
  inWorkspace: boolean;
  organizer: boolean;
  coOrganizer: boolean;
  /** Invited as a member (external invitees use the email and link only, AC-F13-26). */
  invitedMember: boolean;
}

const INVITEE_ACTIONS: ReadonlySet<ScheduleAction> = new Set(["see", "answer"]);

export function decide(action: ScheduleAction, facts: ScheduleFacts): ScheduleDecision {
  if (!facts.inWorkspace) return "notFound";
  if (facts.organizer || facts.coOrganizer) return action === "answer" && !facts.invitedMember ? "forbidden" : "allow";
  if (!facts.invitedMember) return "notFound";
  return INVITEE_ACTIONS.has(action) ? "allow" : "forbidden";
}
