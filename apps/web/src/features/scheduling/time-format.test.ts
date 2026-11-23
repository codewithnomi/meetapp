// Calendar times follow the computer's zone, 12/24-hour setting, language and region (TC-F13-17).
import { describe, expect, it } from "vitest";
import { dayLabels, formatRange, formatTime, hourLabels, minuteOfDay } from "./time-format.ts";

const at = new Date("2026-11-25T15:30:00Z");
const clean = (s: string) => s.replace(/[\u202f\u2009\u00a0]/g, " ");

describe("time-format", () => {
  it("TC-F13-17 [AC-F13-02] times are shown in the computer's time zone", () => {
    expect(formatTime(at, { locale: "en-GB", timeZone: "Europe/London" })).toBe("15:30");
    expect(formatTime(at, { locale: "en-GB", timeZone: "Asia/Karachi" })).toBe("20:30");
    expect(minuteOfDay(at, { timeZone: "America/New_York" })).toBe(10 * 60 + 30);
  });

  it("TC-F13-17 [AC-F13-25] the 12/24-hour setting and the region decide the look", () => {
    expect(clean(formatTime(at, { locale: "en-US", timeZone: "UTC" }))).toBe("3:30 PM");
    expect(formatTime(at, { locale: "en-US", timeZone: "UTC", hour12: false })).toBe("15:30");
    expect(clean(formatTime(at, { locale: "de-DE", timeZone: "UTC", hour12: true }))).toMatch(/^3:30 PM$/i);
    expect(formatTime(at, { locale: "de-DE", timeZone: "UTC" })).toBe("15:30");
    expect(hourLabels({ locale: "en-US", timeZone: "UTC" }).map(clean).slice(0, 2)).toEqual(["12 AM", "1 AM"]);
    expect(hourLabels({ locale: "de-DE", timeZone: "UTC" })[8]).toBe("08 Uhr");
  });

  it("TC-F13-17 [AC-F13-25] ranges and day names follow the language", () => {
    const end = new Date("2026-11-25T16:00:00Z");
    expect(clean(formatRange(at, end, { locale: "en-GB", timeZone: "UTC" }))).toBe("15:30–16:00");
    expect(dayLabels(at, { locale: "en-GB", timeZone: "UTC" })).toEqual({
      short: "Wed 25",
      full: "Wednesday 25 November",
    });
    expect(dayLabels(at, { locale: "de-DE", timeZone: "UTC" }).full).toBe("Mittwoch, 25. November");
  });
});
