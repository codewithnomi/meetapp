// Repeat rules (F13 design.md "Edge cases", AC-F13-11, D094/D095): a series is stored as one RFC 5545
// rule and expanded when read, in the organizer's time zone, so a 09:00 meeting stays 09:00 there across
// summer time. Expansion never reaches past one year from now and returns at most 500 occurrences.
import { RRuleTemporal } from "rrule-temporal";

type RepeatKind = "none" | "weekdays" | "daily" | "weekly" | "monthly" | "yearly";
type Weekday = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

export interface Repeat {
  kind: RepeatKind;
  /** Weekly only; the start's weekday when empty. */
  days?: Weekday[] | undefined;
}

export interface Series {
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  rrule: string | null;
  /** Null = no end date. */
  repeatUntil: Date | null;
}

/** One occurrence moved, renamed or cancelled (meeting_occurrence_changes). */
export interface OccurrenceChange {
  originalStart: Date;
  cancelled: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

export interface Occurrence {
  originalStart: Date;
  startsAt: Date;
  endsAt: Date;
}

export const MAX_OCCURRENCES = 500;
const YEAR_MS = 366 * 24 * 60 * 60 * 1000;
const WEEKDAYS: Weekday[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** The start's weekday and day of month in the organizer's zone. */
function localParts(start: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", day: "numeric" }).formatToParts(start);
  const weekday = parts
    .find((part) => part.type === "weekday")
    ?.value.slice(0, 2)
    .toUpperCase() as Weekday;
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { weekday: WEEKDAYS.includes(weekday) ? weekday : "MO", day };
}

/**
 * The rule for a repeat choice, or null for "does not repeat". Monthly on the 29th–31st takes the chosen
 * day, or the month's last day when the month is shorter (`BYMONTHDAY=28,…,<day>;BYSETPOS=-1`).
 */
export function ruleFor(repeat: Repeat, start: Date, timeZone: string): string | null {
  const { weekday, day } = localParts(start, timeZone);
  switch (repeat.kind) {
    case "none":
      return null;
    case "weekdays":
      return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    case "daily":
      return "FREQ=DAILY";
    case "weekly": {
      const days = repeat.days?.length ? WEEKDAYS.filter((d) => repeat.days?.includes(d)) : [weekday];
      return `FREQ=WEEKLY;BYDAY=${days.join(",")}`;
    }
    case "monthly": {
      if (day < 29) return `FREQ=MONTHLY;BYMONTHDAY=${day}`;
      const days = Array.from({ length: day - 27 }, (_, i) => 28 + i);
      return `FREQ=MONTHLY;BYMONTHDAY=${days.join(",")};BYSETPOS=-1`;
    }
    case "yearly":
      return "FREQ=YEARLY";
  }
}

/** `YYYYMMDDTHHMMSS` of the moment in the zone, for the rule's DTSTART line. */
function localStamp(at: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${part("year")}${part("month")}${part("day")}T${part("hour")}${part("minute")}${part("second")}`;
}

function ruleOf(series: Series & { rrule: string }) {
  return new RRuleTemporal({
    rruleString: `DTSTART;TZID=${series.timeZone}:${localStamp(series.startsAt, series.timeZone)}\nRRULE:${series.rrule}`,
  });
}

/** Rule starts in [from, to), as Dates; at most `limit`. */
function starts(series: Series, from: Date, to: Date, limit: number): Date[] {
  if (!series.rrule) return series.startsAt >= from && series.startsAt < to ? [series.startsAt] : [];
  const out: Date[] = [];
  for (const zoned of ruleOf({ ...series, rrule: series.rrule }).between(from, to, true)) {
    const at = new Date(zoned.epochMilliseconds);
    if (at >= to) break;
    if (series.repeatUntil && at > series.repeatUntil) break;
    out.push(at);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * The occurrences that overlap [from, to), with single-occurrence changes applied, never later than
 * one year from now; `truncated` when more than 500 would be returned.
 */
export function expand(
  series: Series,
  range: { from: Date; to: Date; now: Date },
  changes: OccurrenceChange[] = [],
): { occurrences: Occurrence[]; truncated: boolean } {
  const duration = series.endsAt.getTime() - series.startsAt.getTime();
  const cap = new Date(Math.min(range.to.getTime(), range.now.getTime() + YEAR_MS));
  // An occurrence that started before `from` may still be under way.
  const from = new Date(range.from.getTime() - duration);
  const byStart = new Map(changes.map((change) => [change.originalStart.getTime(), change]));
  // Cancelled ones don't count toward the 500.
  const cancelled = new Set(changes.filter((c) => c.cancelled).map((c) => c.originalStart.getTime()));
  const found = starts(series, from, cap, MAX_OCCURRENCES + 1 + cancelled.size).filter(
    (start) => !cancelled.has(start.getTime()),
  );
  const seen = new Set(found.map((start) => start.getTime()));
  // An occurrence moved into the range from outside it shows too.
  const movedIn = changes
    .filter((change) => !change.cancelled && change.startsAt && !seen.has(change.originalStart.getTime()))
    .map((change) => change.originalStart);
  const occurrences: Occurrence[] = [];
  for (const originalStart of [...found.slice(0, MAX_OCCURRENCES), ...movedIn]) {
    const change = byStart.get(originalStart.getTime());
    if (change?.cancelled) continue;
    const startsAt = change?.startsAt ?? originalStart;
    const endsAt = change?.endsAt ?? new Date(startsAt.getTime() + duration);
    if (endsAt > range.from && startsAt < range.to) occurrences.push({ originalStart, startsAt, endsAt });
  }
  occurrences.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  return { occurrences, truncated: found.length > MAX_OCCURRENCES };
}

/** When the last occurrence ends (for the link's lifetime, D093); undefined = repeats with no end. */
export function lastEnd(series: Series): Date | undefined {
  const duration = series.endsAt.getTime() - series.startsAt.getTime();
  if (!series.rrule) return series.endsAt;
  if (!series.repeatUntil) return undefined;
  const last = ruleOf({ ...series, rrule: series.rrule }).previous(series.repeatUntil, true);
  return last ? new Date(last.epochMilliseconds + duration) : series.endsAt;
}
