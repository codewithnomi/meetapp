// F13 calendar files (AC-F13-15, 18, 19, 28; TC-F13-06 to 09).
import { describe, expect, it } from "vitest";
import { calendarFile, type CalendarFileEvent } from "./scheduling.ics.ts";

const base: CalendarFileEvent = {
  method: "REQUEST",
  uid: "0b6f6c1e-4b8e-4e7e-9a55-9b3a3c1d2e3f",
  sequence: 0,
  title: "Weekly sync",
  description: "Agenda",
  link: "https://meetapp.test/m/abc",
  startsAt: new Date("2027-01-04T09:00:00Z"),
  endsAt: new Date("2027-01-04T09:30:00Z"),
  allDay: false,
  timeZone: "Europe/London",
  rrule: null,
  repeatUntil: null,
  skipped: [],
  moved: [],
  organizerName: "Aisha Khan",
  senderEmail: "no-reply@meetapp.test",
  recipient: "guest@example.test",
};
/** Unfolds RFC 5545 line folding (a line break followed by a space). */
const file = (change: Partial<CalendarFileEvent> = {}) => calendarFile({ ...base, ...change }).replace(/\r\n /g, "");
const lines = (text: string) => text.split("\r\n");

describe("calendar file", () => {
  it("TC-F13-06 [AC-F13-15, AC-F13-18] an invite: REQUEST, the meeting id as UID, SEQUENCE, TZID, organizer, one attendee", () => {
    const text = file({ sequence: 2 });
    expect(lines(text)).toEqual(
      expect.arrayContaining([
        "METHOD:REQUEST",
        `UID:${base.uid}`,
        "SEQUENCE:2",
        "DTSTART;TZID=Europe/London:20270104T090000",
        "SUMMARY:Weekly sync",
      ]),
    );
    expect(text).toMatch(/ORGANIZER;CN="Aisha Khan":mailto:no-reply@meetapp.test/);
    expect(text).toMatch(/ATTENDEE;[^\r]*RSVP=FALSE[^\r]*:MAILTO:guest@example.test/i);
    expect(text.match(/ATTENDEE/g)).toHaveLength(1);
    expect(text).toContain("https://meetapp.test/m/abc");
    expect(text).not.toContain("RRULE");
    expect(file({ rrule: "FREQ=WEEKLY;BYDAY=MO,WE" })).toMatch(/RRULE:FREQ=WEEKLY;BYDAY=MO,WE/);
    expect(file({ rrule: "FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1" })).toMatch(
      /RRULE:FREQ=MONTHLY;BYMONTHDAY=28,29,30,31;BYSETPOS=-1/,
    );
    expect(file({ rrule: "FREQ=DAILY", repeatUntil: new Date("2027-02-01T00:00:00Z") })).toMatch(
      /RRULE:FREQ=DAILY;UNTIL=/,
    );
  });

  it("TC-F13-07 [AC-F13-18, AC-F13-19] a skipped occurrence is an EXDATE, a moved one a RECURRENCE-ID event", () => {
    const text = file({
      rrule: "FREQ=DAILY",
      skipped: [new Date("2027-01-05T09:00:00Z")],
      moved: [
        {
          originalStart: new Date("2027-01-06T09:00:00Z"),
          startsAt: new Date("2027-01-06T14:00:00Z"),
          endsAt: new Date("2027-01-06T14:30:00Z"),
        },
      ],
    });
    expect(text).toMatch(/EXDATE[^\r]*20270105T090000/);
    expect(text.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(text).toMatch(/RECURRENCE-ID[^\r]*20270106T090000/);
    expect(text).toMatch(/DTSTART;TZID=Europe\/London:20270106T140000/);
  });

  it("TC-F13-08 [AC-F13-19] a cancellation: CANCEL with the same UID and a higher SEQUENCE; one occurrence only", () => {
    const series = file({ method: "CANCEL", sequence: 3, rrule: "FREQ=DAILY" });
    expect(lines(series)).toEqual(expect.arrayContaining(["METHOD:CANCEL", `UID:${base.uid}`, "SEQUENCE:3"]));
    const one = file({ method: "CANCEL", sequence: 4, rrule: "FREQ=DAILY", only: new Date("2027-01-07T09:00:00Z") });
    expect(one).toMatch(/RECURRENCE-ID[^\r]*20270107T090000/);
    expect(one).not.toContain("RRULE");
  });

  it("TC-F13-09 [AC-F13-28] text is escaped as RFC 5545 says", () => {
    const text = file({
      title: "Plan; budget, <script>x</script>",
      description: "Line one\nLine two, <img onerror=x>",
    });
    expect(text).toContain(String.raw`SUMMARY:Plan\; budget\, <script>x</script>`);
    expect(text).toContain(String.raw`Line one\nLine two\, <img onerror=x>`);
  });
});
