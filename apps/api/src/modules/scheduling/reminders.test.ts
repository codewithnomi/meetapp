// F13 reminder timing (AC-F13-07, 21, 22; TC-F13-13, 14, 15).
import { describe, expect, it } from "vitest";
import { dueBetween, showingNow, wallTime, type ReminderOccurrence, type ReminderState } from "./reminders.ts";

const MIN = 60 * 1000;
const start = new Date("2027-01-04T10:00:00Z");
const occurrence: ReminderOccurrence = {
  meetingId: "m1",
  originalStart: start,
  startsAt: start,
  endsAt: new Date(start.getTime() + 30 * MIN),
  allDay: false,
  timeZone: "UTC",
};
const fresh = (): ReminderState => ({ declined: false, dismissals: new Map() });
const due = (o: ReminderOccurrence, state: ReminderState, [fromMs, toMs]: [number, number], zone = "UTC") =>
  dueBetween(o, state, { from: new Date(fromMs), to: new Date(toMs), personZone: zone }).map((r) => r.kind);
const at = (offsetMin: number) => start.getTime() + offsetMin * MIN;

describe("reminder timing", () => {
  it("TC-F13-13 [AC-F13-21] 15 minutes before and at the start, each once across one-minute windows", () => {
    expect(due(occurrence, fresh(), [at(-16), at(-15)])).toEqual(["before"]);
    expect(due(occurrence, fresh(), [at(-15), at(-14)])).toEqual([]);
    expect(due(occurrence, fresh(), [at(-1), at(0)])).toEqual(["start"]);
    // A job restart that looks back over a longer gap still finds both, once.
    expect(due(occurrence, fresh(), [at(-20), at(1)])).toEqual(["before", "start"]);
  });

  it("TC-F13-13 [AC-F13-21, AC-F13-22] none when declined, dismissed, or ended", () => {
    expect(due(occurrence, { declined: true, dismissals: new Map() }, [at(-20), at(1)])).toEqual([]);
    const dismissed: ReminderState = { declined: false, dismissals: new Map([["before", null]]) };
    expect(due(occurrence, dismissed, [at(-20), at(1)])).toEqual(["start"]);
    expect(due(occurrence, fresh(), [at(29), at(31)])).toEqual([]);
    expect(showingNow(occurrence, fresh(), new Date(at(31)), "UTC")).toEqual([]);
    expect(showingNow(occurrence, fresh(), new Date(at(5)), "UTC").map((r) => r.kind)).toEqual(["before", "start"]);
    expect(showingNow(occurrence, dismissed, new Date(at(5)), "UTC").map((r) => r.kind)).toEqual(["start"]);
  });

  it("TC-F13-14 [AC-F13-07, AC-F13-21] an all-day meeting: one reminder at 09:00 in the person's own zone", () => {
    const allDay = {
      ...occurrence,
      allDay: true,
      startsAt: new Date("2027-01-04T00:00:00Z"),
      endsAt: new Date("2027-01-05T00:00:00Z"),
    };
    const midnight = new Date("2027-01-04T00:00:00Z").getTime();
    expect(due(allDay, fresh(), [midnight - 20 * MIN, midnight])).toEqual([]);
    expect(
      due(allDay, fresh(), [new Date("2027-01-04T08:59:00Z").getTime(), new Date("2027-01-04T09:00:00Z").getTime()]),
    ).toEqual(["start"]);
    // Karachi is UTC+5: 09:00 there is 04:00 UTC.
    expect(
      due(
        allDay,
        fresh(),
        [new Date("2027-01-04T03:59:00Z").getTime(), new Date("2027-01-04T04:00:00Z").getTime()],
        "Asia/Karachi",
      ),
    ).toEqual(["start"]);
    expect(wallTime({ year: 2027, month: 7, day: 1 }, 9, "Europe/London").toISOString()).toBe(
      "2027-07-01T08:00:00.000Z",
    );
  });

  it("TC-F13-15 [AC-F13-21] a snooze brings it back once after 5 minutes; Dismiss ends only that kind", () => {
    const snoozed: ReminderState = { declined: false, dismissals: new Map([["before", new Date(at(-10))]]) };
    expect(due(occurrence, snoozed, [at(-16), at(-14)])).toEqual([]);
    expect(due(occurrence, snoozed, [at(-11), at(-10)])).toEqual(["before"]);
    expect(due(occurrence, snoozed, [at(-10), at(-9)])).toEqual([]);
    expect(due(occurrence, snoozed, [at(-1), at(0)])).toEqual(["start"]);
  });
});
