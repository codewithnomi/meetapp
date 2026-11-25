// The calendar file sent with invites, updates and cancellations (F13 design.md "Emails", AC-F13-15,
// 18, 19; RFC 5545, D094): METHOD REQUEST or CANCEL, the meeting id as UID, SEQUENCE raised by every
// change, the repeat rule with skipped occurrences (EXDATE), and one extra event per moved occurrence
// (RECURRENCE-ID). Google Calendar, Outlook and Apple Calendar add it in one click. The organizer is named
// but addressed through MeetApp's own sender, and the only attendee listed is the person it is sent to,
// so no one's address reaches anyone else (AC-F13-27). Answers aren't tracked by email (RSVP=FALSE).
import ical, { ICalAttendeeRole, ICalCalendarMethod } from "ical-generator";

export interface CalendarFileEvent {
  method: "REQUEST" | "CANCEL";
  uid: string;
  sequence: number;
  title: string;
  description: string;
  link: string;
  startsAt: Date;
  endsAt: Date;
  allDay: boolean;
  timeZone: string;
  rrule: string | null;
  repeatUntil: Date | null;
  /** Occurrences cancelled on their own. */
  skipped: Date[];
  /** Occurrences moved on their own. */
  moved: { originalStart: Date; startsAt: Date; endsAt: Date }[];
  /** For a one-occurrence cancellation: only that occurrence. */
  only?: Date | undefined;
  organizerName: string;
  /** MeetApp's own sending address. */
  senderEmail: string;
  recipient: string;
}

/**
 * The library writes a zoned time from a Date's local fields (the server's own zone), so each moment is
 * handed over as a Date whose local fields hold its wall-clock time in the meeting's zone.
 */
function wallClock(at: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(at);
  const n = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
}

const stamp = (at: Date) =>
  at
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const local = (at: Date) => stamp(new Date(at.getTime() - at.getTimezoneOffset() * 60_000)).replace("Z", "");

/** The stored rule with its end (UNTIL is always in UTC, RFC 5545 3.3.10). */
const ruleLine = (rrule: string, until: Date | null) => (until ? `${rrule};UNTIL=${stamp(until)}` : rrule);

/** Skipped occurrences as EXDATE lines right after the series' RRULE line. */
function withSkipped(text: string, skipped: Date[], timeZone: string, zoned: (at: Date) => Date): string {
  if (skipped.length === 0) return text;
  const lines = skipped.map((at) => `EXDATE;TZID=${timeZone}:${local(zoned(at))}`).join("\r\n");
  return text.replace(/(\r\nRRULE:[^\r]*)/, `$1\r\n${lines}`);
}

export function calendarFile(event: CalendarFileEvent): string {
  const zoned = (at: Date) => wallClock(at, event.timeZone);
  const calendar = ical({
    prodId: { company: "MeetApp", product: "MeetApp", language: "EN" },
    method: event.method === "CANCEL" ? ICalCalendarMethod.CANCEL : ICalCalendarMethod.REQUEST,
  });
  const common = {
    id: event.uid,
    sequence: event.sequence,
    summary: event.title,
    description: event.description ? `${event.description}\n\n${event.link}` : event.link,
    url: event.link,
    location: event.link,
    allDay: event.allDay,
    timezone: event.timeZone,
    organizer: { name: event.organizerName, email: event.senderEmail },
    attendees: [{ email: event.recipient, rsvp: false, role: ICalAttendeeRole.REQ }],
  };
  if (event.only) {
    const length = event.endsAt.getTime() - event.startsAt.getTime();
    calendar.createEvent({
      ...common,
      start: zoned(event.only),
      end: zoned(new Date(event.only.getTime() + length)),
      recurrenceId: zoned(event.only),
    });
    return calendar.toString();
  }
  calendar.createEvent({
    ...common,
    start: zoned(event.startsAt),
    end: zoned(event.endsAt),
    repeating: event.rrule ? ruleLine(event.rrule, event.repeatUntil) : null,
  });
  for (const moved of event.moved) {
    calendar.createEvent({
      ...common,
      start: zoned(moved.startsAt),
      end: zoned(moved.endsAt),
      recurrenceId: zoned(moved.originalStart),
    });
  }
  return withSkipped(calendar.toString(), event.skipped, event.timeZone, zoned);
}
