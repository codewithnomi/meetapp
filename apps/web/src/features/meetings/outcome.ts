// How a visit ended, in the words the screens use (F02 AC-F02-36–39; F17 AC-F17-06): the Ended screen and
// F17's banner for a call that ended while the person was on another screen say the same thing.
import type { Attendance } from "./visit.ts";

export type Outcome = "denied" | "timedOut" | "removed" | "ended" | "locked" | "noGuests" | "lost" | "left";

export function outcomeOf(outcome: Pick<Attendance, "status" | "leftReason"> | undefined): Outcome {
  if (!outcome) return "left";
  if (outcome.status === "denied") return "denied";
  if (outcome.status === "timed_out") return "timedOut";
  if (outcome.status === "removed") return "removed";
  if (outcome.leftReason === "ended") return "ended";
  if (outcome.leftReason === "locked") return "locked";
  if (outcome.leftReason === "guests_off") return "noGuests";
  if (outcome.leftReason === "dropped") return "lost";
  return "left";
}
