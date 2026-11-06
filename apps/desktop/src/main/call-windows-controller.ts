// F16's small windows, put together (design.md section 3; D079): keeps every main window's report, the
// focus history and the open small windows, and decides after each change which windows show where, which
// button presses pass, and which missed calls get a notification. Free of Electron: the computer's side
// comes in as `CallWindowsDeps` (call-windows-bridge.ts gives the real one, tests a fake).
import type { CallWindowView, CallWindowsNotificationAction } from "@meetapp/contracts";
import {
  FLICKER_MS,
  GAP,
  TIMER_MARGIN_MS,
  RING_SIZE,
  ringHeight,
  createFocusHistory,
  isCallWindowAction,
  layoutWindows,
  mergeReports,
  missedToNotify,
  routeAction,
  type CallInfo,
  type CallWindowsState,
  type Display,
  type MissedInfo,
  type Places,
  type Rect,
  type RingInfo,
} from "./call-windows.ts";
import { cleanReport } from "./call-windows-checks.ts";

export type SmallKind = "ring" | "mini";

export interface SmallWindow {
  id: number;
  setBounds: (rect: Rect) => void;
  /** Shows the window without taking focus from the app in front (AC-F16-01). */
  showInactive: () => void;
  close: () => void;
  send: (state: CallWindowView) => void;
}

export interface CallWindowsDeps {
  open: (kind: SmallKind) => SmallWindow;
  displays: () => Display[];
  primaryDisplayId: () => number;
  /** The screen holding a main window, for the default corner. */
  displayOf: (mainWindowId: number) => number | undefined;
  toMain: (mainWindowId: number, action: unknown) => void;
  focusMain: (mainWindowId: number) => void;
  loadPlaces: () => Places;
  savePlaces: (places: Places) => void;
  notify: (missed: MissedInfo) => void;
  now: () => number;
  later: (ms: number, run: () => void) => void;
  /** Opens the live-video line from a main window to the mini window (design.md 3.5). */
  linkFrames: (miniWindowId: number, mainWindowId: number) => void;
  /** Closes it: the main window stops sending pictures. */
  unlinkFrames: (mainWindowId: number) => void;
  /** A main window keeps full speed behind other apps only while it has a call (design.md 3.5). */
  fullSpeed: (mainWindowId: number, on: boolean) => void;
  /** F04: where the ring and mini windows now are, so notification cards keep clear of them. */
  laidOut?: (rects: Rect[]) => void;
}

export class CallWindowsController {
  private readonly reports = new Map<number, CallWindowsState>();
  /** Main windows, the one used last first. */
  private readonly usedLast: number[] = [];
  private readonly focus;
  private readonly rings = new Map<string, SmallWindow>();
  /** Rings the person hid with ×: they don't come back for this call (AC-F16-04). */
  private readonly hidden = new Set<string>();
  private readonly told = new Set<string>();
  /** The ring windows from the bottom of the stack up (the newest on top, AC-F16-08). */
  private stacked: { callId: string; height: number }[] = [];
  private mini: SmallWindow | undefined;
  /** The person hid the mini window with ×: it stays hidden until a MeetApp window has been in front. */
  private miniHidden = false;
  /** The main window sending the mini window its pictures, and that mini window. */
  private framesFrom: number | undefined;
  private framesTo: number | undefined;
  /** Main windows with a call, kept at full speed. */
  private readonly inCall = new Set<number>();
  private places: Places;

  private readonly deps: CallWindowsDeps;

  constructor(deps: CallWindowsDeps) {
    this.deps = deps;
    this.focus = createFocusHistory(deps.now(), true);
    this.places = deps.loadPlaces();
  }

  /** A main window's report (design.md 3.1); a wrong shape is ignored. */
  report(mainWindowId: number, value: unknown): void {
    const state = cleanReport(value);
    if (!state) return;
    this.reports.set(mainWindowId, state);
    this.setFullSpeed(mainWindowId, state.call !== null);
    if (!this.usedLast.includes(mainWindowId)) this.usedLast.push(mainWindowId);
    this.render();
  }

  /** A main window closed, crashed or reloads: its report is gone (TC-F16-60). */
  dropReport(mainWindowId: number): void {
    this.reports.delete(mainWindowId);
    this.forget(mainWindowId);
    this.render();
  }

  /** Which main window is focused now, or none (another app, minimized, hidden). */
  focusChanged(mainWindowId: number | undefined): void {
    this.focus.set(mainWindowId !== undefined, this.deps.now());
    if (mainWindowId !== undefined) {
      this.miniHidden = false;
      this.forget(mainWindowId);
      this.usedLast.unshift(mainWindowId);
    }
    this.render();
    this.deps.later(FLICKER_MS + TIMER_MARGIN_MS, () => this.render());
  }

  /** A small window's button press (design.md 3.2). Only main's own small windows may send. */
  act(senderId: number, action: unknown): void {
    const from = this.kindOf(senderId);
    if (!from || !isCallWindowAction(action)) return;
    const forRing = "callId" in action;
    if (forRing ? action.callId !== from.callId : from.kind !== "mini") return;
    const route = routeAction(action, this.merged(), this.usedLast);
    if (!route.ok) return;
    if (route.hides === "mini") this.miniHidden = true;
    if (route.hides === "ring" && forRing) this.hidden.add(action.callId);
    if (route.hides) this.render();
    if (!("target" in route)) return;
    if (route.focus) this.deps.focusMain(route.target);
    this.deps.toMain(route.target, action);
  }

  /** A notification's click or Call back (AC-F16-11): to the main window used last, in front. */
  fromNotification(action: CallWindowsNotificationAction): void {
    const target = this.usedLast[0];
    if (target === undefined) return;
    this.deps.focusMain(target);
    this.deps.toMain(target, action);
  }

  /** A small window was dragged: its kind remembers the place (AC-F16-19). */
  moved(senderId: number, x: number, y: number, displayId: number): void {
    const from = this.kindOf(senderId);
    if (!from) return;
    // A ring higher in the stack stands for the bottom place it was stacked from.
    const placeY = from.callId ? this.stackPlaceY(from.callId, y) : y;
    this.places = { ...this.places, [from.kind]: { x, y: placeY, displayId } };
    this.deps.savePlaces(this.places);
    this.render();
  }

  /** A screen was added, removed or resized: places are checked again (AC-F16-20). */
  screensChanged(): void {
    this.render();
  }

  /** A small window closed by itself (crash, the system): forget it, so it can be opened again. */
  smallClosed(id: number): void {
    if (this.mini?.id === id) this.mini = undefined;
    for (const [callId, window] of this.rings) if (window.id === id) this.rings.delete(callId);
    this.render();
  }

  /** The ids of the small windows, for the sender check. */
  smallWindowIds(): Set<number> {
    return new Set([...this.rings.values(), ...(this.mini ? [this.mini] : [])].map((w) => w.id));
  }

  /** A call or meeting runs in some main window (F04: Quit asks first). */
  hasCall(): boolean {
    return this.inCall.size > 0;
  }

  private merged() {
    return mergeReports(this.reports, this.usedLast);
  }

  private setFullSpeed(mainWindowId: number, on: boolean): void {
    if (on === this.inCall.has(mainWindowId)) return;
    if (on) this.inCall.add(mainWindowId);
    else this.inCall.delete(mainWindowId);
    this.deps.fullSpeed(mainWindowId, on);
  }

  private forget(mainWindowId: number): void {
    // Gone or reloading: it reports again once loaded, and a call then switches full speed back on.
    this.inCall.delete(mainWindowId);
    const index = this.usedLast.indexOf(mainWindowId);
    if (index >= 0) this.usedLast.splice(index, 1);
  }

  /** Where the bottom ring's top would be, for a ring of the stack dragged to `y`. */
  private stackPlaceY(callId: string, y: number): number {
    const index = Math.max(
      0,
      this.stacked.findIndex((ring) => ring.callId === callId),
    );
    let bottom = y + (this.stacked[index]?.height ?? RING_SIZE.height);
    for (const { height } of this.stacked.slice(0, index)) bottom += height + GAP;
    return bottom - RING_SIZE.height;
  }

  private render(): void {
    const merged = this.merged();
    const { rings, call } = this.wanted(merged);
    this.closeUnwanted(rings, call);
    this.placeAll([...rings].reverse(), call, merged.callWindow);
    for (const missed of missedToNotify(merged.missed, this.focus, this.told)) this.deps.notify(missed);
  }

  /** The rings and the call to show now: none while a MeetApp window is in front (AC-F16-05, 14). */
  private wanted(merged: ReturnType<typeof mergeReports>): { rings: RingInfo[]; call: CallInfo | null } {
    const away = this.focus.awayLongEnough(this.deps.now());
    for (const id of this.hidden) if (!merged.rings.some((r) => r.callId === id)) this.hidden.delete(id);
    return {
      rings: away ? merged.rings.filter((r) => !this.hidden.has(r.callId)) : [],
      call: away && !this.miniHidden ? merged.call : null,
    };
  }

  /** Places the mini window and the ring stack (`stack`: bottom first), and links the live video. */
  private placeAll(stack: RingInfo[], call: CallInfo | null, callWindow: number | undefined): void {
    const layout = layoutWindows({
      displays: this.deps.displays(),
      primaryId: this.deps.primaryDisplayId(),
      lastUsedDisplayId: this.lastUsedDisplay(),
      places: this.places,
      rings: stack.map(ringHeight),
      mini: call !== null,
    });
    if (call && layout.mini) this.mini = this.place(this.mini, "mini", layout.mini, { kind: "mini", call });
    this.linkFrames(this.mini, callWindow);
    stack.forEach((ring, index) => {
      const rect = layout.rings[index];
      if (!rect) return;
      this.rings.set(ring.callId, this.place(this.rings.get(ring.callId), "ring", rect, { kind: "ring", ring }));
    });
    this.stacked = stack.map((ring) => ({ callId: ring.callId, height: ringHeight(ring) }));
    this.deps.laidOut?.([...(call && layout.mini ? [layout.mini] : []), ...layout.rings.slice(0, stack.length)]);
  }

  private linkFrames(mini: SmallWindow | undefined, from: number | undefined): void {
    const wanted = mini ? from : undefined;
    if (wanted === this.framesFrom && mini?.id === this.framesTo) return;
    if (this.framesFrom !== undefined) this.deps.unlinkFrames(this.framesFrom);
    if (mini && wanted !== undefined) this.deps.linkFrames(mini.id, wanted);
    this.framesFrom = wanted;
    this.framesTo = mini?.id;
  }

  private closeUnwanted(wantedRings: RingInfo[], call: CallInfo | null): void {
    for (const [callId, window] of this.rings) {
      if (wantedRings.some((r) => r.callId === callId)) continue;
      window.close();
      this.rings.delete(callId);
    }
    if (!call && this.mini) {
      this.mini.close();
      this.mini = undefined;
    }
  }

  private lastUsedDisplay(): number {
    const last = this.usedLast[0];
    return (last !== undefined ? this.deps.displayOf(last) : undefined) ?? this.deps.primaryDisplayId();
  }

  private place(window: SmallWindow | undefined, kind: SmallKind, rect: Rect, state: CallWindowView): SmallWindow {
    const shown = window ?? this.deps.open(kind);
    shown.setBounds(rect);
    shown.send(state);
    if (!window) shown.showInactive();
    return shown;
  }

  private kindOf(senderId: number): { kind: SmallKind; callId?: string } | undefined {
    if (this.mini?.id === senderId) return { kind: "mini" };
    for (const [callId, window] of this.rings) if (window.id === senderId) return { kind: "ring", callId };
    return undefined;
  }
}
