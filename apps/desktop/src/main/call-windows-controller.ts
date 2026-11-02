// F16's small windows, put together (design.md section 3; D079): keeps every main window's report, the
// focus history and the open small windows, and decides after each change which windows show where, which
// button presses pass, and which missed calls get a notification. Free of Electron: the computer's side
// comes in as `CallWindowsDeps` (call-windows-bridge.ts gives the real one, tests a fake).
import type { CallWindowView, CallWindowsNotificationAction } from "@meetapp/contracts";
import {
  FLICKER_MS,
  GAP,
  RING_SIZE,
  createFocusHistory,
  isCallWindowAction,
  isCallWindowsState,
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

export type SmallKind = "ring" | "mini";
/** What a small window is told to show. */
export type SmallState = CallWindowView;

export interface SmallWindow {
  id: number;
  setBounds: (rect: Rect) => void;
  /** Shows the window without taking focus from the app in front (AC-F16-01). */
  showInactive: () => void;
  close: () => void;
  send: (state: SmallState) => void;
}

/** Actions only main sends (from a notification), never a small window (TC-F16-55). */
export type MainOnlyAction = CallWindowsNotificationAction;

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
  private ringOrder: string[] = [];
  private mini: SmallWindow | undefined;
  private places: Places;

  private readonly deps: CallWindowsDeps;

  constructor(deps: CallWindowsDeps) {
    this.deps = deps;
    this.focus = createFocusHistory(deps.now(), true);
    this.places = deps.loadPlaces();
  }

  /** A main window's report (design.md 3.1); a wrong shape is ignored. */
  report(mainWindowId: number, state: unknown): void {
    if (!isCallWindowsState(state)) return;
    this.reports.set(mainWindowId, state);
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
      this.forget(mainWindowId);
      this.usedLast.unshift(mainWindowId);
    }
    this.render();
    this.deps.later(FLICKER_MS, () => this.render());
  }

  /** A small window's button press (design.md 3.2). Only main's own small windows may send. */
  act(senderId: number, action: unknown): void {
    const from = this.kindOf(senderId);
    if (!from || !isCallWindowAction(action)) return;
    const forRing = "callId" in action;
    if (forRing ? action.callId !== from.callId : from.kind !== "mini") return;
    const route = routeAction(action, this.merged(), this.usedLast);
    if (!route.ok) return;
    if (action.name === "hide") {
      this.hidden.add(action.callId);
      this.render();
    }
    if (route.focus) this.deps.focusMain(route.target);
    this.deps.toMain(route.target, action);
  }

  /** A notification's click or Call back (AC-F16-11): to the main window used last, in front. */
  fromNotification(action: MainOnlyAction): void {
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
    const above = from.callId ? Math.max(0, this.ringOrder.indexOf(from.callId)) : 0;
    const bottomY = y + above * (RING_SIZE.height + GAP);
    this.places = { ...this.places, [from.kind]: { x, y: bottomY, displayId } };
    this.deps.savePlaces(this.places);
    this.render();
  }

  /** A screen was added, removed or resized: places are checked again (AC-F16-20). */
  screensChanged(): void {
    this.render();
  }

  /** The ids of the small windows, for the sender check. */
  smallWindowIds(): Set<number> {
    return new Set([...this.rings.values(), ...(this.mini ? [this.mini] : [])].map((w) => w.id));
  }

  private merged() {
    return mergeReports(this.reports, this.usedLast);
  }

  private forget(mainWindowId: number): void {
    const index = this.usedLast.indexOf(mainWindowId);
    if (index >= 0) this.usedLast.splice(index, 1);
  }

  private render(): void {
    const merged = this.merged();
    const away = this.focus.awayLongEnough(this.deps.now());
    for (const id of this.hidden) if (!merged.rings.some((r) => r.callId === id)) this.hidden.delete(id);
    const wantedRings = away ? merged.rings.filter((r) => !this.hidden.has(r.callId)) : [];
    const call = away ? merged.call : null;
    this.closeUnwanted(wantedRings, call);
    const layout = layoutWindows({
      displays: this.deps.displays(),
      primaryId: this.deps.primaryDisplayId(),
      lastUsedDisplayId: this.lastUsedDisplay(),
      places: this.places,
      rings: wantedRings.length,
      mini: call !== null,
    });
    if (call) this.mini = this.place(this.mini, "mini", layout.mini as Rect, { kind: "mini", call });
    const stack = [...wantedRings].reverse();
    stack.forEach((ring, index) => {
      const shown = this.place(this.rings.get(ring.callId), "ring", layout.rings[index] as Rect, {
        kind: "ring",
        ring,
      });
      this.rings.set(ring.callId, shown);
    });
    this.ringOrder = stack.map((ring) => ring.callId);
    for (const missed of missedToNotify(merged.missed, this.focus, this.told)) this.deps.notify(missed);
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

  private place(window: SmallWindow | undefined, kind: SmallKind, rect: Rect, state: SmallState): SmallWindow {
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
