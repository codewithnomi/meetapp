// F13 repeat rules (AC-F13-02, AC-F13-11; design.md "Edge cases").
import { describe, expect, it } from "vitest";
import { expand, lastEnd, MAX_OCCURRENCES, ruleFor, type Repeat, type Series } from "./scheduling.recurrence.ts";

const NOW = new Date("2027-01-01T00:00:00Z");
const ZONE = "UTC";
const start = new Date("2027-01-04T09:00:00Z"); // a Monday
const series = (repeat: Repeat, extra: Partial<Series> = {}): Series => ({
  startsAt: start,
  endsAt: new Date(start.getTime() + 30 * 60 * 1000),
  timeZone: ZONE,
  rrule: ruleFor(repeat, start, ZONE),
  repeatUntil: null,
  ...extra,
});
const days = (s: Series, from: string, to: string) =>
  expand(s, { from: new Date(from), to: new Date(to), now: NOW }).occurrences.map((o) =>
    o.startsAt.toISOString().slice(0, 10),
  );

describe("repeat choices", () => {
  it("TC-F13-01 [AC-F13-11] each choice expands to the right dates", () => {
    const week = ["2027-01-04", "2027-01-11"] as const;
    expect(days(series({ kind: "none" }), ...week)).toEqual(["2027-01-04"]);
    expect(days(series({ kind: "daily" }), ...week)).toHaveLength(7);
    expect(days(series({ kind: "weekdays" }), ...week)).toEqual([
      "2027-01-04",
      "2027-01-05",
      "2027-01-06",
      "2027-01-07",
      "2027-01-08",
    ]);
    expect(days(series({ kind: "weekly", days: ["WE", "MO"] }), "2027-01-04", "2027-01-18")).toEqual([
      "2027-01-04",
      "2027-01-06",
      "2027-01-11",
      "2027-01-13",
    ]);
    expect(days(series({ kind: "weekly" }), "2027-01-04", "2027-01-19")).toEqual([
      "2027-01-04",
      "2027-01-11",
      "2027-01-18",
    ]);
    expect(days(series({ kind: "monthly" }), "2027-01-01", "2027-04-01")).toEqual([
      "2027-01-04",
      "2027-02-04",
      "2027-03-04",
    ]);
    expect(days(series({ kind: "yearly" }), "2027-01-01", "2027-12-31")).toEqual(["2027-01-04"]);
  });

  it("TC-F13-01 [AC-F13-11] an end date stops the series; no end date runs on", () => {
    const ended = series({ kind: "daily" }, { repeatUntil: new Date("2027-01-06T23:59:59Z") });
    expect(days(ended, "2027-01-01", "2027-02-01")).toEqual(["2027-01-04", "2027-01-05", "2027-01-06"]);
    expect(days(series({ kind: "daily" }), "2027-01-01", "2027-02-01")).toHaveLength(28);
    expect(lastEnd(ended)?.toISOString()).toBe("2027-01-06T09:30:00.000Z");
    expect(lastEnd(series({ kind: "daily" }))).toBeUndefined();
    expect(lastEnd(series({ kind: "none" }))?.toISOString()).toBe("2027-01-04T09:30:00.000Z");
  });

  it("TC-F13-01 [AC-F13-11] a cancelled occurrence is skipped and a moved one shows at its new time", () => {
    const daily = series({ kind: "daily" });
    const { occurrences } = expand(daily, { from: new Date("2027-01-04"), to: new Date("2027-01-07"), now: NOW }, [
      { originalStart: new Date("2027-01-05T09:00:00Z"), cancelled: true, startsAt: null, endsAt: null },
      {
        originalStart: new Date("2027-01-06T09:00:00Z"),
        cancelled: false,
        startsAt: new Date("2027-01-06T14:00:00Z"),
        endsAt: null,
      },
    ]);
    expect(occurrences.map((o) => o.startsAt.toISOString())).toEqual([
      "2027-01-04T09:00:00.000Z",
      "2027-01-06T14:00:00.000Z",
    ]);
    expect(occurrences[1]?.endsAt.toISOString()).toBe("2027-01-06T14:30:00.000Z");
  });

  it("TC-F13-01 [AC-F13-11] an occurrence moved into the range from outside it shows (T-fix-2)", () => {
    const weekly = series({ kind: "weekly" });
    const moved = {
      originalStart: new Date("2027-01-11T09:00:00Z"),
      cancelled: false,
      startsAt: new Date("2027-01-08T09:00:00Z"),
      endsAt: new Date("2027-01-08T09:30:00Z"),
    };
    const range = { from: new Date("2027-01-05"), to: new Date("2027-01-09"), now: NOW };
    expect(expand(weekly, range, [moved]).occurrences.map((o) => o.startsAt.toISOString())).toEqual([
      "2027-01-08T09:00:00.000Z",
    ]);
  });
});

describe("month ends", () => {
  it.each([29, 30, 31])(
    "TC-F13-02 [AC-F13-11] monthly on the %ith: the day, or the last day of a shorter month",
    (day) => {
      const first = new Date(`2028-01-${day}T10:00:00Z`); // 2028 is a leap year
      const rule = ruleFor({ kind: "monthly" }, first, ZONE);
      expect(rule).toBe(
        `FREQ=MONTHLY;BYMONTHDAY=${Array.from({ length: day - 27 }, (_, i) => 28 + i).join(",")};BYSETPOS=-1`,
      );
      const s: Series = {
        startsAt: first,
        endsAt: new Date(first.getTime() + 1_800_000),
        timeZone: ZONE,
        rrule: rule,
        repeatUntil: null,
      };
      const got = expand(s, {
        from: new Date("2028-01-01"),
        to: new Date("2029-01-01"),
        now: new Date("2028-01-01"),
      }).occurrences.map((o) => o.startsAt.toISOString().slice(0, 10));
      expect(got).toHaveLength(12);
      const lastDay = (month: number) => new Date(Date.UTC(2028, month + 1, 0)).getUTCDate();
      got.forEach((date, month) => expect(Number(date.slice(8, 10))).toBe(Math.min(day, lastDay(month))));
    },
  );
});

describe("time zones", () => {
  it("TC-F13-03 [AC-F13-02, AC-F13-11] a weekly 09:00 Berlin meeting stays 09:00 Berlin across summer time", () => {
    const zone = "Europe/Berlin";
    const first = new Date("2027-03-22T08:00:00Z"); // 09:00 Berlin, winter
    const s: Series = {
      startsAt: first,
      endsAt: new Date(first.getTime() + 1_800_000),
      timeZone: zone,
      rrule: ruleFor({ kind: "weekly" }, first, zone),
      repeatUntil: null,
    };
    const got = expand(s, { from: new Date("2027-03-20"), to: new Date("2027-04-06"), now: new Date("2027-03-01") });
    expect(got.occurrences.map((o) => o.startsAt.toISOString())).toEqual([
      "2027-03-22T08:00:00.000Z",
      "2027-03-29T07:00:00.000Z",
      "2027-04-05T07:00:00.000Z",
    ]);
    const berlin = (d: Date) => d.toLocaleTimeString("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit" });
    const karachi = (d: Date) =>
      d.toLocaleTimeString("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" });
    expect(got.occurrences.map((o) => berlin(o.startsAt))).toEqual(["09:00", "09:00", "09:00"]);
    expect(got.occurrences.map((o) => karachi(o.startsAt))).toEqual(["13:00", "12:00", "12:00"]);
  });
});

describe("caps", () => {
  it("TC-F13-04 [AC-F13-11] nothing later than one year ahead", () => {
    const got = expand(series({ kind: "weekly" }), {
      from: new Date("2027-01-01"),
      to: new Date("2030-01-01"),
      now: NOW,
    });
    const latest = got.occurrences.at(-1)?.startsAt.getTime() ?? 0;
    expect(latest).toBeLessThanOrEqual(NOW.getTime() + 366 * 86_400_000);
    expect(latest).toBeGreaterThan(NOW.getTime() + 350 * 86_400_000);
  });

  it("TC-F13-04 [AC-F13-11] more than 500 occurrences gives truncated", () => {
    const hourly: Series = { ...series({ kind: "none" }), rrule: "FREQ=HOURLY" };
    const got = expand(hourly, { from: new Date("2027-01-04"), to: new Date("2027-02-04"), now: NOW });
    expect(got.occurrences).toHaveLength(MAX_OCCURRENCES);
    expect(got.truncated).toBe(true);
    expect(
      expand(series({ kind: "daily" }), { from: new Date("2027-01-04"), to: new Date("2027-02-04"), now: NOW })
        .truncated,
    ).toBe(false);
  });
});
