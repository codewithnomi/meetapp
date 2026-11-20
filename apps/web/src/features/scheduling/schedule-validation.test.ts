// F13 form checks (AC-F13-07, 08, 10; TC-F13-10).
import type { ScheduleBody } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import { checkSchedule, defaultTimes } from "./schedule-validation.ts";

const NOW = new Date("2027-01-04T08:47:00Z");
const valid: ScheduleBody = {
  title: "Weekly sync",
  invitees: [{ email: "guest@example.test" }],
  startsAt: "2027-01-04T09:00:00Z",
  endsAt: "2027-01-04T09:30:00Z",
  allDay: false,
  timeZone: "Europe/London",
  repeat: { kind: "none" },
  description: "",
};
const errors = (change: Partial<ScheduleBody>) => checkSchedule({ ...valid, ...change }, NOW).errors;
const people = (n: number) => Array.from({ length: n }, (_, i) => ({ email: `p${i}@example.test` }));

describe("schedule form checks", () => {
  it("TC-F13-10 [AC-F13-10] a valid form has no errors", () => {
    expect(checkSchedule(valid, NOW)).toEqual({ errors: {}, overCallSize: false });
  });

  it("TC-F13-10 [AC-F13-10] each wrong field gets its own error", () => {
    expect(errors({ title: "" })).toEqual({ title: "required" });
    expect(errors({ title: "x".repeat(101) })).toEqual({ title: "tooLong" });
    expect(errors({ endsAt: valid.startsAt })).toEqual({ endsAt: "endBeforeStart" });
    expect(errors({ startsAt: "2027-01-04T08:41:00Z" })).toEqual({ startsAt: "inPast" });
    expect(errors({ startsAt: "2027-01-04T08:43:00Z" })).toEqual({});
    expect(errors({ description: "x".repeat(2001) })).toEqual({ description: "tooLong" });
    expect(errors({ invitees: [{ email: "nope" }] })).toEqual({ invitees: "badEmail" });
    expect(errors({ invitees: people(251) })).toEqual({ invitees: "tooMany" });
  });

  it("TC-F13-10 [AC-F13-08] above 100 invitees the form notes the call size", () => {
    expect(checkSchedule({ ...valid, invitees: people(101) }, NOW).overCallSize).toBe(true);
    expect(checkSchedule({ ...valid, invitees: people(100) }, NOW).overCallSize).toBe(false);
  });

  it("TC-F13-10 [AC-F13-07] the form starts at the next half hour, 30 minutes long", () => {
    expect(defaultTimes(NOW)).toEqual({
      startsAt: new Date("2027-01-04T09:00:00Z"),
      endsAt: new Date("2027-01-04T09:30:00Z"),
    });
    expect(defaultTimes(new Date("2027-01-04T09:00:00Z")).startsAt).toEqual(new Date("2027-01-04T09:30:00Z"));
  });
});
