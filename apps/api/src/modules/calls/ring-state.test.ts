// The ring state machine (F15 TC-F15-17; AC-F15-06–09): only "ringing" changes; the first event wins.
import { describe, expect, it } from "vitest";
import { nextRingState, type RingEvent, type RingState } from "./ring-state.ts";

const EVENTS: RingEvent[] = ["accept", "decline", "cancel", "timeout", "ended"];
const FINAL: RingState[] = ["accepted", "declined", "missed", "cancelled"];

describe("ring state machine", () => {
  it("TC-F15-17 [AC-F15-06, AC-F15-07, AC-F15-08, AC-F15-09] a ringing ring takes each event's result", () => {
    expect(EVENTS.map((event) => nextRingState("ringing", event))).toEqual([
      "accepted",
      "declined",
      "cancelled",
      "missed",
      "missed",
    ]);
  });

  it("TC-F15-17 [AC-F15-06] every final state stays final: any later event is over", () => {
    for (const state of FINAL) for (const event of EVENTS) expect(nextRingState(state, event)).toBe("over");
  });

  it("TC-F15-17 [AC-F15-06] in any order, the first event decides", () => {
    for (const first of EVENTS) {
      const after = nextRingState("ringing", first);
      expect(after).not.toBe("over");
      for (const second of EVENTS) expect(nextRingState(after as RingState, second)).toBe("over");
    }
  });
});
