// F13 link lifetime for scheduled meetings (D093, AC-F13-13).
import { describe, expect, it } from "vitest";
import { extendedExpiry, MEETING_LIFETIME_MS, NEVER, scheduledExpiry } from "../meetings/expiry.ts";

const DAY = 24 * 60 * 60 * 1000;

describe("scheduled meeting expiry", () => {
  it("TC-F13-05 [AC-F13-13] last occurrence end + 60 days; no end date never expires; adding an end recalculates", () => {
    const lastEnd = new Date("2026-12-01T10:30:00Z");
    expect(scheduledExpiry(lastEnd).getTime()).toBe(lastEnd.getTime() + 60 * DAY);
    expect(MEETING_LIFETIME_MS).toBe(60 * DAY);
    expect(scheduledExpiry(undefined)).toEqual(NEVER);
    const later = new Date("2027-03-01T10:30:00Z");
    expect(scheduledExpiry(later).getTime()).toBe(later.getTime() + 60 * DAY);
  });

  it("TC-F13-05 [AC-F13-13] joining a scheduled meeting does not move its expiry", () => {
    const current = new Date("2027-01-30T00:00:00Z");
    expect(extendedExpiry("scheduled", current, new Date("2027-01-29T00:00:00Z"))).toEqual(current);
    expect(extendedExpiry("link", current, new Date("2027-01-29T00:00:00Z")).getTime()).toBeGreaterThan(
      current.getTime(),
    );
  });
});
