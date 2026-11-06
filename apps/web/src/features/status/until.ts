// When a status set by hand ends (F04 design 3.3, AC-F04-21), worked out in the person's own time zone:
// minutes and hours add exactly; Today ends at 23:59:59 local; This week at Sunday 23:59:59 local (today,
// when today is Sunday); "until I change it" has no end. Sent to the server as an ISO time.
import type { StatusDuration } from "@meetapp/ui";

const ADD_MS: Partial<Record<StatusDuration, number>> = { "30m": 30 * 60_000, "1h": 60 * 60_000, "2h": 120 * 60_000 };

function endOfDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
}

export function untilFor(duration: StatusDuration, now: Date): string | null {
  const add = ADD_MS[duration];
  if (add !== undefined) return new Date(now.getTime() + add).toISOString();
  if (duration === "today") return endOfDay(now).toISOString();
  if (duration === "week") {
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((7 - now.getDay()) % 7));
    return endOfDay(sunday).toISOString();
  }
  return null;
}
