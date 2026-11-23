// The Upcoming list's choice (TC-F13-68; AC-F13-23): today's and tomorrow's only, soonest first, not ended,
// not declined. Cancelled ones never reach it (the calendar leaves them out).
import type { CalendarOccurrence } from "@meetapp/contracts";
import { describe, expect, it } from "vitest";
import { upcomingOf } from "./upcoming.ts";

const NOW = new Date(2026, 10, 25, 10, 20);
const at = (day: number, hour: number) => new Date(2026, 10, day, hour).toISOString();
const one = (title: string, day: number, hour: number, extra: Partial<CalendarOccurrence> = {}) =>
  ({
    meetingId: "00000000-0000-4000-8000-0000000000b1",
    originalStart: at(day, hour),
    startsAt: at(day, hour),
    endsAt: at(day, hour + 1),
    allDay: false,
    title,
    organizer: { id: "00000000-0000-4000-8000-0000000000aa", name: "Olivia" },
    repeats: false,
    myAnswer: "accepted",
    canJoin: false,
    ...extra,
  }) as CalendarOccurrence;

describe("upcoming", () => {
  it("TC-F13-68 [AC-F13-23] only today's and tomorrow's, in order, without ended or declined ones", () => {
    const list = [
      one("Day after", 27, 9),
      one("Tomorrow", 26, 9),
      one("Ended", 25, 8),
      one("Declined", 25, 15, { myAnswer: "declined" }),
      one("Now", 25, 10, { canJoin: true }),
      one("Late today", 25, 16),
    ];
    expect(upcomingOf(list, NOW).map((o) => [o.title, o.canJoin])).toEqual([
      ["Now", true],
      ["Late today", false],
      ["Tomorrow", false],
    ]);
  });
});
