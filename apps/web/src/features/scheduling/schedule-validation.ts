// The new-meeting form's checks (F13 AC-F13-07, 08, 10): the shared schema's limits plus the one that
// needs the clock (a start more than 5 minutes ago). Each wrong field gets its own error key; nothing is
// sent while any remain. Also the form's starting values: the next half hour, 30 minutes long.
import { SCHEDULE_LIMITS, scheduleBodySchema, type ScheduleBody } from "@meetapp/contracts";

export type ScheduleField = "title" | "invitees" | "startsAt" | "endsAt" | "description";
type ScheduleError = "required" | "tooLong" | "endBeforeStart" | "inPast" | "badEmail" | "tooMany";

export interface ScheduleCheck {
  errors: Partial<Record<ScheduleField, ScheduleError>>;
  /** More invitees than one call holds (AC-F13-08): a note, not an error. */
  overCallSize: boolean;
}

const HALF_HOUR = 30 * 60 * 1000;

/** The next half hour from now, 30 minutes long. */
export function defaultTimes(now: Date): { startsAt: Date; endsAt: Date } {
  const startsAt = new Date(Math.ceil((now.getTime() + 1) / HALF_HOUR) * HALF_HOUR);
  return { startsAt, endsAt: new Date(startsAt.getTime() + HALF_HOUR) };
}

function errorFor(field: ScheduleField, code: string, value: ScheduleBody): ScheduleError {
  if (field === "title") return value.title.trim() === "" ? "required" : "tooLong";
  if (field === "endsAt") return "endBeforeStart";
  if (field === "invitees") return code === "too_big" ? "tooMany" : "badEmail";
  return "tooLong";
}

export function checkSchedule(value: ScheduleBody, now: Date): ScheduleCheck {
  const errors: ScheduleCheck["errors"] = {};
  const parsed = scheduleBodySchema.safeParse(value);
  for (const issue of parsed.success ? [] : parsed.error.issues) {
    const field = issue.path[0] as ScheduleField;
    errors[field] ??= errorFor(field, issue.code, value);
  }
  if (Date.parse(value.startsAt) < now.getTime() - SCHEDULE_LIMITS.pastGraceMs) errors.startsAt = "inPast";
  return { errors, overCallSize: value.invitees.length > SCHEDULE_LIMITS.callSize };
}
