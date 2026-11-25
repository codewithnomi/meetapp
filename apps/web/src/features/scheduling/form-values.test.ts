// The form's values and the request they make (TC-F13-26, 27, AC-F13-07).
import { describe, expect, it } from "vitest";
import { blankForm, movesTime, toBody } from "./form-values.ts";

const NOW = new Date(2026, 10, 25, 10, 20);

describe("form values", () => {
  it("TC-F13-26 [AC-F13-07] a new form starts at the next half hour for 30 minutes; a dragged range fills it", () => {
    const blank = blankForm(undefined, NOW);
    expect([blank.start, blank.end]).toEqual([
      { date: "2026-11-25", time: "10:30" },
      { date: "2026-11-25", time: "11:00" },
    ]);
    const dragged = blankForm({ startsAt: new Date(2026, 10, 26, 14), endsAt: new Date(2026, 10, 26, 15, 30) }, NOW);
    expect([dragged.start.time, dragged.end.time, dragged.repeat.days]).toEqual(["14:00", "15:30", ["TH"]]);
  });

  it("TC-F13-27 [AC-F13-07] all day spans whole days in the organizer's zone", () => {
    const values = { ...blankForm(undefined, NOW), title: " Offsite ", allDay: true };
    const body = toBody(values, "Europe/London");
    expect(body.title).toBe("Offsite");
    expect(new Date(body.startsAt)).toEqual(new Date(2026, 10, 25));
    expect(new Date(body.endsAt)).toEqual(new Date(2026, 10, 26));
    expect(body.allDay).toBe(true);
  });

  it("TC-F13-27 [AC-F13-07] an all-day meeting on a clock-change day ends at the next midnight (T-fix-4)", () => {
    // Europe and the US change their clocks on these days; whichever zone runs the test, the end is midnight.
    for (const date of ["2026-03-29", "2026-03-08", "2026-10-25", "2026-11-01"]) {
      const values = { ...blankForm(undefined, NOW), title: "Offsite", allDay: true };
      const body = toBody({ ...values, start: { date, time: "" }, end: { date, time: "" } }, "UTC");
      const [y, m, d] = date.split("-").map(Number) as [number, number, number];
      expect(new Date(body.endsAt)).toEqual(new Date(y, m - 1, d + 1));
    }
  });

  it("TC-F13-30 [AC-F13-10] weekly sends its days; an end date is the end of that day; none sends neither", () => {
    const base = blankForm(undefined, NOW);
    const weekly = toBody({ ...base, repeat: { kind: "weekly", days: ["MO", "WE"], until: "2026-12-30" } }, "UTC");
    expect(weekly.repeat).toEqual({
      kind: "weekly",
      days: ["MO", "WE"],
      until: new Date(2026, 11, 30, 23, 59).toISOString(),
    });
    expect(toBody({ ...base, repeat: { kind: "none", days: ["MO"], until: "2026-12-30" } }, "UTC").repeat).toEqual({
      kind: "none",
    });
    expect(movesTime(base, { ...base, title: "x" })).toBe(false);
    expect(movesTime(base, { ...base, start: { ...base.start, time: "11:00" } })).toBe(true);
  });
});
