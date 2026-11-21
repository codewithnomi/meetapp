// When reminders are due (F13 design.md "Jobs"; AC-F13-07, 21, 22). Two per occurrence, as in Teams:
// 15 minutes before and at the start. An all-day meeting gets one, at 09:00 in the person's own zone,
// never 15 minutes before midnight. Declined and cancelled occurrences get none; a dismissed reminder
// stays away; a snoozed one comes back once when its snooze ends. Nothing for a meeting that has ended.

export type ReminderKind = "before" | "start";

export interface ReminderOccurrence {
  meetingId: string;
  originalStart: Date;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  /** The meeting's zone: its all-day date is read there. */
  timeZone: string;
}

export interface ReminderState {
  declined: boolean;
  /** Per kind: dismissed (null), or snoozed until a moment. Absent: never touched. */
  dismissals: Map<ReminderKind, Date | null>;
}

export interface DueReminder {
  meetingId: string;
  originalStart: Date;
  kind: ReminderKind;
  /** When it is due: its own time, or the end of a snooze. */
  at: Date;
}

export const BEFORE_MS = 15 * 60 * 1000;
const ALL_DAY_HOUR = 9;

/** The date (y, m, d) of a moment in a zone. */
function dateIn(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(at);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: n("year"), month: n("month"), day: n("day") };
}

/** The moment it is `hour`:00 on that date in the zone (found by correcting for the zone's offset twice). */
export function wallTime(date: { year: number; month: number; day: number }, hour: number, timeZone: string): Date {
  const guess = Date.UTC(date.year, date.month - 1, date.day, hour);
  const offsetAt = (ms: number) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).formatToParts(new Date(ms));
    const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute")) - ms;
  };
  const first = guess - offsetAt(guess);
  return new Date(guess - offsetAt(first));
}

/** The reminder times of one occurrence for a person in `personZone`. */
export function reminderTimes(occurrence: ReminderOccurrence, personZone: string): { kind: ReminderKind; at: Date }[] {
  if (occurrence.allDay) {
    const date = dateIn(occurrence.startsAt, occurrence.timeZone);
    return [{ kind: "start", at: wallTime(date, ALL_DAY_HOUR, personZone) }];
  }
  return [
    { kind: "before", at: new Date(occurrence.startsAt.getTime() - BEFORE_MS) },
    { kind: "start", at: occurrence.startsAt },
  ];
}

/**
 * The reminders that become due in (from, to] for one person: their own time in the window, or a snooze
 * that ends in it. Never for a declined occurrence, a dismissed kind, or once the occurrence has ended.
 */
export function dueBetween(
  occurrence: ReminderOccurrence,
  state: ReminderState,
  window: { from: Date; to: Date; personZone: string },
): DueReminder[] {
  if (state.declined || occurrence.endsAt <= window.to) return [];
  const inWindow = (at: Date) => at > window.from && at <= window.to;
  const due: DueReminder[] = [];
  for (const { kind, at } of reminderTimes(occurrence, window.personZone)) {
    const dismissal = state.dismissals.get(kind);
    const when = dismissal === undefined ? at : dismissal;
    if (when && inWindow(when)) {
      due.push({ meetingId: occurrence.meetingId, originalStart: occurrence.originalStart, kind, at: when });
    }
  }
  return due;
}

/**
 * The reminders that should be showing now (the app asks on start and reconnect, AC-F13-22): their time
 * has come, the occurrence hasn't ended, and they weren't dismissed or are no longer snoozed.
 */
export function showingNow(
  occurrence: ReminderOccurrence,
  state: ReminderState,
  now: Date,
  personZone: string,
): DueReminder[] {
  if (state.declined || occurrence.endsAt <= now) return [];
  return reminderTimes(occurrence, personZone).flatMap(({ kind, at }) => {
    const dismissal = state.dismissals.get(kind);
    const when = dismissal === undefined ? at : dismissal;
    return when && when <= now
      ? [{ meetingId: occurrence.meetingId, originalStart: occurrence.originalStart, kind, at: when }]
      : [];
  });
}
