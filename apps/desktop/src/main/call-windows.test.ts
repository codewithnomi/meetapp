// The rules behind F16's small windows (design.md section 3), checked without Electron. The desktop tests
// (tests/e2e/desktop/call-windows.spec.ts) check them in real windows.
import { describe, expect, it } from "vitest";
import {
  EDGE,
  GAP,
  FLICKER_MS,
  MINI_SIZE,
  RING_BUSY_HEIGHT,
  RING_SIZE,
  createFocusHistory,
  layoutWindows,
  mergeReports,
  missedToNotify,
  placeOrFallback,
  routeAction,
  type CallWindowsState,
  type Display,
  type Rect,
} from "./call-windows.ts";

const main: Display = { id: 1, workArea: { x: 0, y: 0, width: 1440, height: 900 } };
const second: Display = { id: 2, workArea: { x: 1440, y: 0, width: 1920, height: 1080 } };
const ring = (callId: string) => ({ callId, caller: { name: callId, initials: "AB" }, kind: "video" as const });
const call = {
  title: "Release team",
  joinedAt: 0,
  people: 3,
  phase: "in-call" as const,
  speaker: { name: "Sara", initials: "SM", hasVideo: true, sharing: false },
  mic: true,
  camera: true,
  hand: false,
  canUnmute: true,
  canShare: true,
};
const state = (over: Partial<CallWindowsState> = {}): CallWindowsState => ({
  rings: [],
  call: null,
  missed: [],
  ...over,
});
const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("TC-F16-01 TC-F16-29 TC-F16-61 [AC-F16-01, AC-F16-05, AC-F16-14] when the small windows are wanted", () => {
  it("TC-F16-01 [AC-F16-01, AC-F16-05] a ring is shown only while no MeetApp window is in front, after the wait", () => {
    const focus = createFocusHistory(0, true);
    expect(focus.awayLongEnough(1000)).toBe(false);
    focus.set(false, 1000);
    expect(focus.awayLongEnough(1000 + FLICKER_MS - 1)).toBe(false);
    expect(focus.awayLongEnough(1000 + FLICKER_MS)).toBe(true);
    focus.set(true, 2000);
    expect(focus.awayLongEnough(2500)).toBe(false);
  });

  it("TC-F16-61 [AC-F16-01, AC-F16-14] leaving and coming back within 150 ms shows nothing", () => {
    const focus = createFocusHistory(0, true);
    focus.set(false, 100);
    focus.set(true, 200);
    expect(focus.awayLongEnough(260)).toBe(false);
    focus.set(false, 300);
    expect(focus.awayLongEnough(300 + FLICKER_MS)).toBe(true);
  });

  it("TC-F16-29 [AC-F16-14] the mini window is wanted for every call phase, never without a call", () => {
    for (const phase of ["lobby", "calling", "in-call", "reconnecting"] as const) {
      const merged = mergeReports(new Map([[1, state({ call: { ...call, phase } })]]), [1]);
      expect(merged.call?.phase).toBe(phase);
    }
    expect(mergeReports(new Map([[1, state()]]), [1]).call).toBeNull();
  });
});

describe("TC-F16-02 TC-F16-16 TC-F16-18 [AC-F16-01, AC-F16-08, AC-F16-09] placement and stacking", () => {
  it("TC-F16-02 [AC-F16-01] the first ring goes to the bottom-right of the last-used screen", () => {
    const { rings } = layoutWindows({
      displays: [main, second],
      primaryId: 1,
      lastUsedDisplayId: 2,
      places: {},
      rings: Array<number>(1).fill(RING_SIZE.height),
      mini: false,
    });
    expect(rings[0]).toEqual({
      x: 1440 + 1920 - EDGE - RING_SIZE.width,
      y: 1080 - EDGE - RING_SIZE.height,
      ...RING_SIZE,
    });
  });

  it("TC-F16-16 [AC-F16-08] rings stack upwards with a gap, newest on top, above the mini window", () => {
    const { rings, mini } = layoutWindows({
      displays: [main],
      primaryId: 1,
      lastUsedDisplayId: 1,
      places: {},
      rings: Array<number>(3).fill(RING_SIZE.height),
      mini: true,
    });
    expect(mini).toBeDefined();
    const all = [...rings, mini as Rect];
    for (let i = 0; i < all.length; i += 1)
      for (let j = i + 1; j < all.length; j += 1) expect(overlaps(all[i] as Rect, all[j] as Rect)).toBe(false);
    // Index 0 is the oldest (lowest); each newer one sits GAP above the one before.
    for (let i = 1; i < rings.length; i += 1) {
      expect((rings[i] as Rect).y + RING_SIZE.height + GAP).toBe((rings[i - 1] as Rect).y);
    }
    expect((rings[0] as Rect).y + RING_SIZE.height).toBeLessThanOrEqual((mini as Rect).y);
  });

  it("TC-F16-16 [AC-F16-07, AC-F16-08] a busy ring is taller; the stack still has a gap and no overlap", () => {
    const { rings } = layoutWindows({
      displays: [main],
      primaryId: 1,
      lastUsedDisplayId: 1,
      places: {},
      rings: [RING_BUSY_HEIGHT, RING_SIZE.height],
      mini: false,
    });
    const [bottom, top] = rings as [Rect, Rect];
    expect(bottom.height).toBe(RING_BUSY_HEIGHT);
    expect(bottom.y + bottom.height).toBe(900 - EDGE);
    expect(top.y + top.height + GAP).toBe(bottom.y);
  });

  it("TC-F16-18 [AC-F16-09] when a ring ends the others close the gap", () => {
    const three = layoutWindows({
      displays: [main],
      primaryId: 1,
      lastUsedDisplayId: 1,
      places: {},
      rings: Array<number>(3).fill(RING_SIZE.height),
      mini: false,
    }).rings;
    const two = layoutWindows({
      displays: [main],
      primaryId: 1,
      lastUsedDisplayId: 1,
      places: {},
      rings: Array<number>(2).fill(RING_SIZE.height),
      mini: false,
    }).rings;
    const one = layoutWindows({
      displays: [main],
      primaryId: 1,
      lastUsedDisplayId: 1,
      places: {},
      rings: Array<number>(1).fill(RING_SIZE.height),
      mini: false,
    }).rings;
    expect(two).toEqual(three.slice(0, 2));
    expect(one).toEqual(three.slice(0, 1));
  });
});

describe("TC-F16-41 TC-F16-43 [AC-F16-19, AC-F16-20] remembered places", () => {
  it("TC-F16-41 [AC-F16-19] each kind keeps its own place; rings stack from theirs", () => {
    const places = {
      ring: { x: 100, y: 500, displayId: 1 },
      mini: { x: 800, y: 600, displayId: 1 },
    };
    const { rings, mini } = layoutWindows({
      displays: [main],
      primaryId: 1,
      lastUsedDisplayId: 1,
      places,
      rings: Array<number>(2).fill(RING_SIZE.height),
      mini: true,
    });
    expect(mini).toEqual({ x: 800, y: 600, ...MINI_SIZE });
    expect(rings[0]).toEqual({ x: 100, y: 500, ...RING_SIZE });
    expect(rings[1]).toEqual({ x: 100, y: 500 - GAP - RING_SIZE.height, ...RING_SIZE });
    expect(Object.keys(places).sort()).toEqual(["mini", "ring"]);
  });

  it("TC-F16-43 [AC-F16-20] a place on a missing screen falls back; a place inside a screen is kept", () => {
    const fallback = { x: 1440 - EDGE - MINI_SIZE.width, y: 900 - EDGE - MINI_SIZE.height };
    expect(placeOrFallback({ x: 2000, y: 100, displayId: 2 }, [main], 1, MINI_SIZE)).toEqual(fallback);
    expect(placeOrFallback({ x: 1300, y: 100, displayId: 1 }, [main], 1, MINI_SIZE)).toEqual(fallback);
    expect(placeOrFallback({ x: 200, y: 100, displayId: 1 }, [main], 1, MINI_SIZE)).toEqual({ x: 200, y: 100 });
    expect(placeOrFallback(undefined, [main], 1, MINI_SIZE)).toEqual(fallback);
  });
});

describe("TC-F16-44 [AC-F16-24] several MeetApp windows", () => {
  it("TC-F16-44 [AC-F16-24] the same ring, call and missed call from two windows count once", () => {
    const missed = {
      callId: "c9",
      from: "Sara",
      kind: "audio" as const,
      conversationId: "k1",
      endedAt: 5,
      text: { title: "Missed call", body: "from Sara", callBack: "Call back" },
    };
    const merged = mergeReports(
      new Map([
        [1, state({ rings: [ring("c1")], call, missed: [missed] })],
        [2, state({ rings: [ring("c1"), ring("c2")], call, missed: [missed] })],
      ]),
      [2, 1],
    );
    expect(merged.rings.map((r) => r.callId)).toEqual(["c1", "c2"]);
    expect(merged.call).not.toBeNull();
    expect(merged.missed).toHaveLength(1);
    expect(routeAction({ name: "accept", callId: "c1", video: true }, merged, [2, 1])).toEqual({
      ok: true,
      target: 2,
      focus: true,
    });
  });
});

describe("TC-F16-38 [AC-F16-17] actions", () => {
  const merged = mergeReports(new Map([[1, state({ rings: [ring("c1")], call })]]), [1]);
  it("TC-F16-38 [AC-F16-17] share brings the main window forward first", () => {
    expect(routeAction({ name: "share" }, merged, [1])).toEqual({ ok: true, target: 1, focus: true });
    expect(routeAction({ name: "toggleMic" }, merged, [1])).toEqual({ ok: true, target: 1, focus: false });
  });
  it("TC-F16-38 [AC-F16-17] actions for rings not shown, or call actions without a call, are refused", () => {
    expect(routeAction({ name: "decline", callId: "other" }, merged, [1])).toEqual({ ok: false });
    const noCall = mergeReports(new Map([[1, state()]]), [1]);
    expect(routeAction({ name: "leave" }, noCall, [1])).toEqual({ ok: false });
  });
});

describe("TC-F16-21 [AC-F16-10, AC-F16-12] missed calls judged at the moment the ring ended", () => {
  const missed = {
    callId: "c1",
    from: "Sara",
    kind: "video" as const,
    conversationId: "k1",
    endedAt: 31_000,
    text: { title: "Missed call", body: "from Sara", callBack: "Call back" },
  };
  it("TC-F16-21 [AC-F16-10] away at that moment: notify once; in front at that moment: never", () => {
    const away = createFocusHistory(0, true);
    away.set(false, 30_000);
    away.set(true, 32_000);
    const told = new Set<string>();
    expect(missedToNotify([missed], away, told)).toEqual([missed]);
    expect(missedToNotify([missed], away, told)).toEqual([]);

    const front = createFocusHistory(0, false);
    front.set(true, 30_000);
    front.set(false, 32_000);
    expect(missedToNotify([missed], front, new Set())).toEqual([]);
  });
});
