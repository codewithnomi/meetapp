// "Upcoming" on Meetings (F13 AC-F13-23): today's and tomorrow's scheduled meetings that haven't ended
// and weren't declined, soonest first. The calendar's own list leaves out cancelled ones already.
import type { CalendarOccurrence } from "@meetapp/contracts";

/** From the start of today to the end of tomorrow, on this computer's clock. */
export function upcomingRange(now: Date): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { from, to: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2) };
}

export function upcomingOf(occurrences: CalendarOccurrence[], now: Date): CalendarOccurrence[] {
  const { to } = upcomingRange(now);
  return occurrences
    .filter((o) => o.myAnswer !== "declined" && Date.parse(o.endsAt) > now.getTime() && Date.parse(o.startsAt) < +to)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}
