// Which buttons the app shows (a copy of the backend's table, apps/api/src/modules/calls/
// calls.permissions.ts): the backend decides every action again, so this only hides what would be refused.
import type { CallRole } from "./people.ts";

export type CallAction = "share" | "admit" | "mute" | "remove" | "setRole" | "options" | "end";

const RUNS_THE_MEETING: readonly CallRole[] = ["organizer", "co_organizer", "presenter"];
const ORGANIZERS: readonly CallRole[] = ["organizer", "co_organizer"];
const TABLE: Record<CallAction, readonly CallRole[]> = {
  share: RUNS_THE_MEETING,
  admit: RUNS_THE_MEETING,
  mute: RUNS_THE_MEETING,
  remove: RUNS_THE_MEETING,
  setRole: RUNS_THE_MEETING,
  options: ORGANIZERS,
  end: ORGANIZERS,
};

export const can = (role: CallRole | undefined, action: CallAction) =>
  role !== undefined && TABLE[action].includes(role);

/** Nobody removes the organizer or changes their role; a co-organizer's role isn't changed in the call. */
export function canActOn(
  actor: CallRole | undefined,
  action: "mute" | "remove" | "setRole",
  target: CallRole,
): boolean {
  if (!can(actor, action)) return false;
  if (target === "organizer") return action === "mute";
  return !(target === "co_organizer" && action === "setRole");
}
