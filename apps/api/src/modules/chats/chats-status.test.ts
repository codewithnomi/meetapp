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
    expect(statusOf({ ...none, lines: [line(1000)], inCall: true }, NOW)).toBe("in_call");
    expect(statusOf({ ...none, closedAt: NOW - 20_000 }, NOW)).toBe("away");
    expect(statusOf({ ...none, closedAt: NOW - 40_000 }, NOW)).toBe("offline");
    expect(statusOf(none, NOW)).toBe("offline");
    // A line its server never closed counts as gone after two missed pings (75 seconds).
    expect(statusOf({ ...none, lines: [{ activeAt: NOW, locked: false, seenAt: NOW - 80_000 }] }, NOW)).toBe("offline");
  });

  const at = (status: "available" | "busy" | "dnd" | "brb" | "away", untilMs: number | null = null) => ({
    status,
    until: untilMs === null ? null : new Date(NOW + untilMs),
  });
  it("TC-F04-42 [AC-F04-23, AC-F04-20] hand-set first, then In a call, then hand-set Available, then automatic", () => {
    const active = { ...none, lines: [line(1000)] };
    for (const status of ["busy", "dnd", "brb", "away"] as const) {
      expect(statusOf({ ...active, inCall: true, manual: at(status, 60_000) }, NOW)).toBe(status);
    }
    expect(statusOf({ ...active, inCall: true, manual: at("available") }, NOW)).toBe("in_call");
    expect(statusOf({ ...active, inCall: true }, NOW)).toBe("in_call");
    // A hand-set Available stays Available when idle or locked.
    expect(statusOf({ ...none, lines: [line(30 * 60_000)], manual: at("available") }, NOW)).toBe("available");
    expect(statusOf({ ...none, lines: [line(1000, true)], manual: at("available") }, NOW)).toBe("available");
    // Run out: ignored.
    expect(statusOf({ ...active, manual: at("busy", -1) }, NOW)).toBe("available");
    expect(statusOf({ ...none, lines: [line(30 * 60_000)], manual: at("available", 0) }, NOW)).toBe("away");
    // Signed out stays Offline.
    expect(statusOf({ ...none, manual: at("dnd") }, NOW)).toBe("offline");
  });
});
