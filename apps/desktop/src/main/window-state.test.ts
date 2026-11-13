// The main window's saved size and place (TC-F04-76, AC-F04-40).
import { describe, expect, it } from "vitest";
import { SAVE_AFTER_MS, restoreState, saveLater } from "./window-state.ts";

const MAIN = { id: 1, workArea: { x: 0, y: 25, width: 1440, height: 875 } };
const SIDE = { id: 2, workArea: { x: 1440, y: 0, width: 1920, height: 1080 } };
const CENTRED = { x: 120, y: 63, width: 1200, height: 800, maximized: false, displayId: 1 };

describe("window state", () => {
  it("TC-F04-76 [AC-F04-40] a saved place on a screen that is still there comes back as it was", () => {
    const saved = { x: 1500, y: 40, width: 1000, height: 700, maximized: true, displayId: 2 };
    expect(restoreState(saved, [MAIN, SIDE], 1)).toEqual(saved);
  });

  it("TC-F04-76 [AC-F04-40] anything odd opens centred on the main screen; nothing throws", () => {
    const odd = [
      undefined,
      null,
      "x",
      { x: 1500, y: 40, width: 1000, height: 700, maximized: false, displayId: 9 },
      { x: 10, y: 30, width: 1e9, height: 700, maximized: false, displayId: 1 },
      { x: -5000, y: 30, width: 900, height: 700, maximized: false, displayId: 1 },
      { x: Number.NaN, y: 30, width: 900, height: 700, maximized: false, displayId: 1 },
      { x: 10, y: 30, width: 2000, height: 700, maximized: false, displayId: 1 },
      { x: 10, y: 30, width: 200, height: 100, maximized: false, displayId: 1 },
      { x: 10, y: 30, width: 900, height: 700, maximized: "yes", displayId: 1 },
    ];
    for (const saved of odd) expect(restoreState(saved, [MAIN, SIDE], 1), JSON.stringify(saved)).toEqual(CENTRED);
    // A screen smaller than the default size: the window fits it.
    const small = { id: 3, workArea: { x: 0, y: 0, width: 1024, height: 700 } };
    expect(restoreState(undefined, [small], 3)).toEqual({
      x: 0,
      y: 0,
      width: 1024,
      height: 700,
      maximized: false,
      displayId: 3,
    });
  });

  it("TC-F04-76 [AC-F04-40] saves once the window has been still for 500 ms", () => {
    const timers: { run: () => void; live: boolean; ms: number }[] = [];
    let saves = 0;
    const changed = saveLater(
      (run, ms) => {
        const timer = { run, live: true, ms };
        timers.push(timer);
        return () => (timer.live = false);
      },
      () => (saves += 1),
    );
    changed();
    changed();
    changed();
    expect(timers.filter((t) => t.live)).toHaveLength(1);
    expect(timers[0]?.ms).toBe(SAVE_AFTER_MS);
    for (const timer of timers) if (timer.live) timer.run();
    expect(saves).toBe(1);
  });
});
