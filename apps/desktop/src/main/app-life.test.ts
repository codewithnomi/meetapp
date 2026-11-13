import { describe, expect, it, vi } from "vitest";
import { AppLife } from "./app-life.ts";

function life(inCall: boolean, answer = true) {
  const confirmQuitDuringCall = vi.fn(() => answer);
  return { rules: new AppLife({ inCall: () => inCall, confirmQuitDuringCall }), confirmQuitDuringCall };
}

describe("app life (F04 T3)", () => {
  it("TC-F04-08 [AC-F04-04] closing a window hides it while MeetApp isn't quitting", () => {
    const { rules } = life(false);
    expect(rules.closeHides()).toBe(true);
    expect(rules.closeHides()).toBe(true);
    rules.mayQuit("person");
    expect(rules.closeHides()).toBe(false);
  });

  it("TC-F04-14 [AC-F04-06] Quit with no call goes ahead without a question", () => {
    const { rules, confirmQuitDuringCall } = life(false);
    expect(rules.mayQuit("person")).toBe(true);
    expect(confirmQuitDuringCall).not.toHaveBeenCalled();
  });

  it("TC-F04-15 [AC-F04-06] Quit during a call asks; Cancel keeps MeetApp running, Quit goes ahead once", () => {
    const cancelled = life(true, false);
    expect(cancelled.rules.mayQuit("person")).toBe(false);
    expect(cancelled.rules.closeHides()).toBe(true);
    const confirmed = life(true, true);
    expect(confirmed.rules.mayQuit("person")).toBe(true);
    expect(confirmed.rules.mayQuit("person")).toBe(true);
    expect(confirmed.confirmQuitDuringCall).toHaveBeenCalledTimes(1);
  });

  it("TC-F04-17 [AC-F04-06] a shutdown or logout during a call never asks", () => {
    const { rules, confirmQuitDuringCall } = life(true, false);
    expect(rules.mayQuit("system")).toBe(true);
    expect(rules.closeHides()).toBe(false);
    expect(confirmQuitDuringCall).not.toHaveBeenCalled();
  });
});
