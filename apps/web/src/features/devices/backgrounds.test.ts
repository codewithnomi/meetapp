// The frame monitor and the effect choices (TC-F15-50, AC-F15-31; TC-F15-48, AC-F15-30).
import { describe, expect, it, vi } from "vitest";
import { PICTURES, effectOf, frameMonitor, pictureUrl } from "./backgrounds.ts";

/** Feeds `fps` frames a second for `seconds`, moving the fake clock; answers the clock. */
function run(monitor: ReturnType<typeof frameMonitor>, clock: { t: number }, fps: number, seconds: number) {
  // A hair slower than the named rate, so rounding in the fake clock can't squeeze one more frame into a second.
  const step = 1000 / fps + 0.01;
  const end = clock.t + seconds * 1000;
  while (clock.t < end) {
    clock.t += step;
    monitor.frame();
  }
}

function setup() {
  const clock = { t: 0 };
  const onSlow = vi.fn();
  return { clock, onSlow, monitor: frameMonitor(onSlow, () => clock.t) };
}

describe("TC-F15-50 frame-rate fallback", () => {
  it("TC-F15-50 [AC-F15-31] 30 fps does nothing", () => {
    const { clock, onSlow, monitor } = setup();
    run(monitor, clock, 30, 10);
    expect(onSlow).not.toHaveBeenCalled();
  });

  it("TC-F15-50 [AC-F15-31] 14 fps for only 4 seconds does nothing", () => {
    const { clock, onSlow, monitor } = setup();
    run(monitor, clock, 30, 3);
    run(monitor, clock, 14, 4);
    expect(onSlow).not.toHaveBeenCalled();
  });

  it("TC-F15-50 [AC-F15-31] after 5 seconds under 15 fps it tells once, and not again at 14 fps or after recovery", () => {
    const { clock, onSlow, monitor } = setup();
    run(monitor, clock, 30, 3);
    run(monitor, clock, 14, 4);
    run(monitor, clock, 14, 5);
    expect(onSlow).toHaveBeenCalledTimes(1);
    run(monitor, clock, 14, 5);
    run(monitor, clock, 30, 5);
    expect(onSlow).toHaveBeenCalledTimes(1);
  });

  it("TC-F15-50 [AC-F15-31] a recovery in between restarts the 5 seconds", () => {
    const { clock, onSlow, monitor } = setup();
    run(monitor, clock, 30, 2);
    run(monitor, clock, 14, 4);
    run(monitor, clock, 30, 2);
    run(monitor, clock, 14, 4);
    expect(onSlow).not.toHaveBeenCalled();
  });

  it("TC-F15-50 [AC-F15-31] it does not turn on again by itself; only reset watches again", () => {
    const { clock, onSlow, monitor } = setup();
    run(monitor, clock, 30, 2);
    run(monitor, clock, 10, 8);
    expect(onSlow).toHaveBeenCalledTimes(1);
    monitor.reset();
    run(monitor, clock, 30, 2);
    run(monitor, clock, 10, 8);
    expect(onSlow).toHaveBeenCalledTimes(2);
  });
});

describe("T-fix-4 only real slowness turns the effect off", () => {
  it("T-fix-4 [AC-F15-31] a camera that gives 12 a second is not slow at 12, but is at 5", () => {
    const { clock, onSlow, monitor } = setup();
    monitor.cameraRate(12);
    run(monitor, clock, 12, 10);
    expect(onSlow).not.toHaveBeenCalled();
    run(monitor, clock, 5, 6);
    expect(onSlow).toHaveBeenCalledTimes(1);
  });

  it("T-fix-4 [AC-F15-31] a hidden window's fewer frames never count, and watching starts fresh on return", () => {
    const clock = { t: 0 };
    const onSlow = vi.fn();
    let hidden = true;
    const monitor = frameMonitor(
      onSlow,
      () => clock.t,
      () => hidden,
    );
    run(monitor, clock, 2, 20);
    expect(onSlow).not.toHaveBeenCalled();
    hidden = false;
    run(monitor, clock, 30, 3);
    expect(onSlow).not.toHaveBeenCalled();
  });
});

describe("TC-F15-48 effects of the choices", () => {
  it("TC-F15-48 [AC-F15-30] there are at least 8 pictures, each with its own file", () => {
    expect(PICTURES.length).toBeGreaterThanOrEqual(8);
    expect(new Set(PICTURES.map(pictureUrl)).size).toBe(PICTURES.length);
    expect(pictureUrl("office")).toBe("/backgrounds/office.jpg");
  });

  it("TC-F15-48 [AC-F15-30] none and unknown ids are disabled, blur blurs, a picture is a virtual background", () => {
    expect(effectOf("none")).toEqual({ mode: "disabled" });
    expect(effectOf("nonsense")).toEqual({ mode: "disabled" });
    expect(effectOf("blur")).toMatchObject({ mode: "background-blur" });
    for (const id of PICTURES) {
      expect(effectOf(id)).toEqual({ mode: "virtual-background", imagePath: `/backgrounds/${id}.jpg` });
    }
  });
});
