// The small windows put together (F16 design.md section 3), with a fake computer: TC-F16-60 and the
// controller's part of TC-F16-01, 04, 41, 44 and 55. Real windows: tests/e2e/desktop/call-windows.spec.ts.
import { describe, expect, it, vi } from "vitest";
import type { CallWindowView } from "@meetapp/contracts";
import { CallWindowsController, type SmallKind } from "./call-windows-controller.ts";
import { FLICKER_MS, GAP, RING_SIZE, type CallWindowsState, type Places } from "./call-windows.ts";

const ring = (callId: string) => ({ callId, caller: { name: "Sara", initials: "SM" }, kind: "video" as const });
const call = {
  title: "Release team",
  joinedAt: 0,
  people: 2,
  phase: "in-call" as const,
  speaker: { name: "Sara", initials: "SM", hasVideo: false, sharing: false },
  mic: true,
  camera: false,
  hand: false,
  canUnmute: true,
  canShare: true,
};
const report = (over: Partial<CallWindowsState> = {}): CallWindowsState => ({
  rings: [],
  call: null,
  missed: [],
  ...over,
});

function computer() {
  let clock = 1_000;
  let nextId = 100;
  const windows: { id: number; kind: SmallKind; open: boolean; states: CallWindowView[]; shown: number }[] = [];
  const timers: { at: number; run: () => void }[] = [];
  const saved: Places[] = [];
  const deps = {
    open: (kind: SmallKind) => {
      const w = { id: nextId++, kind, open: true, states: [] as CallWindowView[], shown: 0 };
      windows.push(w);
      return {
        id: w.id,
        setBounds: vi.fn(),
        showInactive: () => void (w.shown += 1),
        close: () => void (w.open = false),
        send: (s: CallWindowView) => void w.states.push(s),
      };
    },
    displays: () => [{ id: 1, workArea: { x: 0, y: 0, width: 1440, height: 900 } }],
    primaryDisplayId: () => 1,
    displayOf: () => 1,
    toMain: vi.fn(),
    focusMain: vi.fn(),
    loadPlaces: () => ({}),
    savePlaces: (p: Places) => void saved.push(p),
    notify: vi.fn(),
    now: () => clock,
    later: (ms: number, run: () => void) => void timers.push({ at: clock + ms, run }),
    linkFrames: vi.fn(),
    unlinkFrames: vi.fn(),
    fullSpeed: vi.fn(),
  };
  const controller = new CallWindowsController(deps);
  const advance = (ms: number) => {
    clock += ms;
    for (const t of timers.splice(0)) if (t.at <= clock) t.run();
  };
  const open = (kind?: SmallKind) => windows.filter((w) => w.open && (!kind || w.kind === kind));
  return { controller, deps, advance, open, saved };
}

describe("F16 small windows, put together", () => {
  it("TC-F16-01 [AC-F16-01, AC-F16-05] a ring shows after MeetApp has been away 150 ms, and closes when it's back", () => {
    const { controller, advance, open } = computer();
    controller.focusChanged(1);
    controller.report(1, report({ rings: [ring("c1")] }));
    expect(open()).toHaveLength(0);
    controller.focusChanged(undefined);
    expect(open()).toHaveLength(0);
    advance(FLICKER_MS + 20);
    expect(open("ring")).toHaveLength(1);
    expect(open("ring")[0]?.shown).toBe(1);
    controller.focusChanged(1);
    expect(open()).toHaveLength(0);
  });

  it("TC-F16-04 [AC-F16-04] × hides only this window and tells the main window; the ring doesn't come back", () => {
    const { controller, deps, advance, open } = computer();
    controller.report(1, report({ rings: [ring("c1")] }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    const id = (open("ring")[0] as { id: number }).id;
    controller.act(id, { name: "hide", callId: "c1" });
    expect(open()).toHaveLength(0);
    expect(deps.toMain).toHaveBeenCalledWith(1, { name: "hide", callId: "c1" });
    expect(deps.focusMain).not.toHaveBeenCalled();
    controller.report(1, report({ rings: [ring("c1")] }));
    expect(open()).toHaveLength(0);
  });

  it("TC-F16-55 [AC-F16-22] a ring window can only answer its own ring; main windows can't press buttons", () => {
    const { controller, deps, advance, open } = computer();
    controller.report(1, report({ rings: [ring("c1"), ring("c2")], call }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    const first = open("ring").find((w) => {
      const last = w.states.at(-1);
      return last?.kind === "ring" && last.ring.callId === "c1";
    }) as { id: number };
    controller.act(first.id, { name: "decline", callId: "c2" });
    controller.act(first.id, { name: "toggleMic" });
    controller.act(1, { name: "decline", callId: "c1" });
    controller.act(first.id, { name: "openChat", conversationId: "k1" });
    expect(deps.toMain).not.toHaveBeenCalled();
    controller.act(first.id, { name: "accept", callId: "c1", video: false });
    expect(deps.focusMain).toHaveBeenCalledWith(1);
    expect(deps.toMain).toHaveBeenCalledWith(1, { name: "accept", callId: "c1", video: false });
  });

  it("TC-F16-16 [AC-F16-08] the newest ring sits on top of the stack", () => {
    const { controller, advance, open } = computer();
    controller.report(1, report({ rings: [ring("new"), ring("old")] }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    const rings = open("ring");
    expect(rings.map((w) => (w.states.at(-1) as { ring: { callId: string } }).ring.callId)).toEqual(["old", "new"]);
  });

  it("TC-F16-41 [AC-F16-19] dragging the upper of two rings saves the bottom place it stands for", () => {
    const { controller, advance, open, saved } = computer();
    controller.report(1, report({ rings: [ring("new"), ring("old")] }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    const upper = open("ring")[1] as { id: number };
    controller.moved(upper.id, 50, 100, 1);
    expect(saved.at(-1)).toEqual({ ring: { x: 50, y: 100 + RING_SIZE.height + GAP, displayId: 1 } });
  });

  it("TC-F16-33 [AC-F16-15] the live-video line opens with the mini window and closes with it", () => {
    const { controller, deps, advance, open } = computer();
    controller.report(1, report({ call }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    const mini = open("mini")[0] as { id: number };
    expect(deps.linkFrames).toHaveBeenCalledWith(mini.id, 1);
    controller.focusChanged(1);
    expect(deps.unlinkFrames).toHaveBeenCalledWith(1);
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    expect(deps.linkFrames).toHaveBeenCalledTimes(2);
  });

  it("TC-F16-71 [AC-F16-15] the mini window's × hides only it; the call goes on; it is back after MeetApp was in front", () => {
    const { controller, deps, advance, open } = computer();
    controller.report(1, report({ call }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    const mini = open("mini")[0] as { id: number };
    controller.act(mini.id, { name: "hideMini" });
    expect(open("mini")).toHaveLength(0);
    expect(deps.toMain).not.toHaveBeenCalled(); // the call is not touched
    controller.report(1, report({ call }));
    advance(FLICKER_MS + 20);
    expect(open("mini")).toHaveLength(0); // stays hidden while MeetApp is still behind
    controller.focusChanged(1);
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    expect(open("mini")).toHaveLength(1);
  });

  it("TC-F16-70 [AC-F16-15] a main window keeps full speed only while it has a call (battery)", () => {
    const { controller, deps } = computer();
    controller.report(1, report({ rings: [ring("a")] }));
    expect(deps.fullSpeed).not.toHaveBeenCalled();
    controller.report(1, report({ call }));
    controller.report(1, report({ call }));
    expect(deps.fullSpeed).toHaveBeenCalledTimes(1);
    expect(deps.fullSpeed).toHaveBeenLastCalledWith(1, true);
    controller.report(1, report({}));
    expect(deps.fullSpeed).toHaveBeenLastCalledWith(1, false);
    controller.report(1, report({ call }));
    controller.dropReport(1);
    controller.report(1, report({ call }));
    expect(deps.fullSpeed).toHaveBeenLastCalledWith(1, true);
    expect(deps.fullSpeed).toHaveBeenCalledTimes(4);
  });

  it("TC-F16-61 [AC-F16-01] a timer that fires a moment early still shows the windows", () => {
    const { controller, advance, open } = computer();
    controller.report(1, report({ rings: [ring("c1")] }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    expect(open("ring")).toHaveLength(1);
  });

  it("TC-F16-60 [AC-F16-06] a small window closed by the system is forgotten and opened again", () => {
    const { controller, advance, open } = computer();
    controller.report(1, report({ rings: [ring("c1")] }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    const first = open("ring")[0] as { id: number; open: boolean };
    first.open = false;
    controller.smallClosed(first.id);
    expect(open("ring")).toHaveLength(1);
    expect((open("ring")[0] as { id: number }).id).not.toBe(first.id);
  });

  it("TC-F16-60 [AC-F16-06] a main window that crashes or reloads takes its small windows with it", () => {
    const { controller, advance, open } = computer();
    controller.report(1, report({ rings: [ring("c1")], call }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    expect(open()).toHaveLength(2);
    controller.dropReport(1);
    expect(open()).toHaveLength(0);
  });

  it("TC-F16-44 [AC-F16-24] two main windows: one ring window, one mini window, one notification", () => {
    const { controller, deps, advance, open } = computer();
    const missed = {
      callId: "c9",
      from: "Sara",
      kind: "audio" as const,
      conversationId: "k1",
      endedAt: 2_000,
      text: { title: "Missed call", body: "from Sara", callBack: "Call back" },
    };
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    controller.report(1, report({ rings: [ring("c1")], call, missed: [missed] }));
    controller.report(2, report({ rings: [ring("c1")], call, missed: [missed] }));
    expect(open("ring")).toHaveLength(1);
    expect(open("mini")).toHaveLength(1);
    expect(deps.notify).toHaveBeenCalledTimes(1);
  });

  it("TC-F16-41 [AC-F16-19] a dragged window's place is saved for its kind", () => {
    const { controller, advance, open, saved } = computer();
    controller.report(1, report({ call }));
    controller.focusChanged(undefined);
    advance(FLICKER_MS + 20);
    controller.moved((open("mini")[0] as { id: number }).id, 200, 300, 1);
    expect(saved.at(-1)).toEqual({ mini: { x: 200, y: 300, displayId: 1 } });
    controller.moved(999, 1, 1, 1);
    expect(saved).toHaveLength(1);
  });

  it("TC-F16-11 [AC-F16-11] a notification's Call back goes to the main window used last, in front", () => {
    const { controller, deps } = computer();
    controller.focusChanged(2);
    controller.focusChanged(1);
    controller.fromNotification({ name: "callBack", conversationId: "k1", video: true });
    expect(deps.focusMain).toHaveBeenCalledWith(1);
    expect(deps.toMain).toHaveBeenCalledWith(1, { name: "callBack", conversationId: "k1", video: true });
  });
});
