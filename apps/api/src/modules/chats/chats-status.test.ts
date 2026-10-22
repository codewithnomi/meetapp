// The status rules (F14 AC-F14-26).
import { describe, expect, it } from "vitest";
import { statusOf } from "./chats-status.ts";

const NOW = 10 * 60 * 60 * 1000;
const line = (activeAgoMs: number, locked = false) => ({ activeAt: NOW - activeAgoMs, locked, seenAt: NOW - 1000 });
const none = { lines: [], closedAt: null, inCall: false };

describe("status", () => {
  it("TC-F14-51 [AC-F14-26] available, away, locked, in a meeting, and offline after the grace", () => {
    expect(statusOf({ ...none, lines: [line(2 * 60_000)] }, NOW)).toBe("available");
    expect(statusOf({ ...none, lines: [line(6 * 60_000)] }, NOW)).toBe("away");
    expect(statusOf({ ...none, lines: [line(1000, true)] }, NOW)).toBe("away");
    expect(statusOf({ ...none, lines: [line(1000)], inCall: true }, NOW)).toBe("in_meeting");
    expect(statusOf({ ...none, closedAt: NOW - 20_000 }, NOW)).toBe("away");
    expect(statusOf({ ...none, closedAt: NOW - 40_000 }, NOW)).toBe("offline");
    expect(statusOf(none, NOW)).toBe("offline");
    // A line its server never closed counts as gone after two missed pings (75 seconds).
    expect(statusOf({ ...none, lines: [{ activeAt: NOW, locked: false, seenAt: NOW - 80_000 }] }, NOW)).toBe("offline");
  });
});
