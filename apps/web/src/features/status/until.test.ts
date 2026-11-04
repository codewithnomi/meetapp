// The end of a hand-set status in the person's own time zone (TC-F04-38, AC-F04-21).
import { afterEach, describe, expect, it } from "vitest";
import { untilFor } from "./until.ts";

const zone = process.env["TZ"];
afterEach(() => {
  process.env["TZ"] = zone;
});
const inZone = (tz: string, local: string) => {
  process.env["TZ"] = tz;
  return new Date(local);
};

describe("until", () => {
  it.each([
    ["Asia/Karachi", "2026-11-04T10:15:00", "2026-11-04T18:59:59.000Z", "2026-11-08T18:59:59.000Z"],
    ["America/Los_Angeles", "2026-11-04T10:15:00", "2026-11-05T07:59:59.000Z", "2026-11-09T07:59:59.000Z"],
  ])(
    "TC-F04-38 [AC-F04-21] in %s: minutes and hours add exactly; Today and This week end at 23:59:59 local",
    (tz, local, today, week) => {
      const now = inZone(tz, local);
      expect(untilFor("30m", now)).toBe(new Date(now.getTime() + 30 * 60_000).toISOString());
      expect(untilFor("1h", now)).toBe(new Date(now.getTime() + 60 * 60_000).toISOString());
      expect(untilFor("2h", now)).toBe(new Date(now.getTime() + 120 * 60_000).toISOString());
      expect(untilFor("today", now)).toBe(today);
      expect(untilFor("week", now)).toBe(week);
      expect(untilFor("forever", now)).toBeNull();
    },
  );

  it("TC-F04-38 [AC-F04-21] on Sunday, This week is today; across a clock change it stays 23:59:59 local", () => {
    // Sunday 1 November 2026: the US clocks go back an hour at 2:00.
    const sunday = inZone("America/Los_Angeles", "2026-11-01T09:00:00");
    expect(untilFor("week", sunday)).toBe("2026-11-02T07:59:59.000Z");
    expect(untilFor("today", sunday)).toBe("2026-11-02T07:59:59.000Z");
    const saturday = inZone("America/Los_Angeles", "2026-10-31T20:00:00");
    expect(untilFor("week", saturday)).toBe("2026-11-02T07:59:59.000Z");
    // 2 hours over the change add exactly 2 real hours.
    const early = inZone("America/Los_Angeles", "2026-11-01T00:30:00");
    expect(new Date(untilFor("2h", early) ?? "").getTime() - early.getTime()).toBe(2 * 60 * 60_000);
  });
});
