// F16's small windows (design.md section 3; D079): the rules, without Electron, so they can be tested.
// When the ring windows and the mini call window are wanted, where they go, how several MeetApp
// windows' reports merge, which actions may pass, and which missed calls get a notification.
// call-windows-bridge.ts gives them the real windows, screens and focus.

export const RING_SIZE = { width: 360, height: 132 };
export const MINI_SIZE = { width: 320, height: 236 };
/** Distance from the screen's edges for the default corner. */
export const EDGE = 16;
/** Space between stacked windows. */
export const GAP = 8;
/** Focus must stay away this long before windows show, so a passing menu doesn't flash them. */
export const FLICKER_MS = 150;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Display {
  id: number;
  workArea: Rect;
}
export interface Place {
  x: number;
  y: number;
  displayId: number;
}
export interface Places {
  ring?: Place;
  mini?: Place;
}

export interface RingInfo {
  callId: string;
  caller: { name: string; initials: string; photo?: string };
  kind: "video" | "audio";
  chatName?: string;
  /** The current call's or meeting's name when the person is busy (AC-F16-07). */
  busyIn?: string;
}
export interface CallInfo {
  title: string;
  joinedAt: number;
  people: number;
  phase: "lobby" | "calling" | "in-call" | "reconnecting";
  speaker: { name: string; initials: string; photo?: string; hasVideo: boolean; sharing: boolean };
  mic: boolean;
  camera: boolean;
  hand: boolean;
  canUnmute: boolean;
  canShare: boolean;
}
export interface MissedInfo {
  callId: string;
  from: string;
  chatName?: string;
  kind: "video" | "audio";
  conversationId: string;
  endedAt: number;
}
/** What one MeetApp main window reports (design.md 3.1). */
export interface CallWindowsState {
  rings: RingInfo[];
  call: CallInfo | null;
  missed: MissedInfo[];
}
export interface Merged {
  rings: RingInfo[];
  call: CallInfo | null;
  /** The window whose call it is (the one used last among those reporting it). */
  callWindow: number | undefined;
  missed: MissedInfo[];
}

/** Whether a MeetApp window is in front, over time, so late reports are judged by the right moment. */
export function createFocusHistory(start: number, inFront: boolean) {
  const changes: { at: number; inFront: boolean }[] = [{ at: start, inFront }];
  const latest = () => changes[changes.length - 1] as { at: number; inFront: boolean };
  return {
    set(front: boolean, at: number) {
      if (latest().inFront !== front) changes.push({ at, inFront: front });
      if (changes.length > 200) changes.splice(1, changes.length - 100);
    },
    inFrontAt(at: number): boolean {
      let front = (changes[0] as { inFront: boolean }).inFront;
      for (const change of changes) if (change.at <= at) front = change.inFront;
      return front;
    },
    /** True once no MeetApp window has been in front for FLICKER_MS. */
    awayLongEnough(now: number): boolean {
      const last = latest();
      return !last.inFront && now - last.at >= FLICKER_MS;
    },
  };
}
export type FocusHistory = ReturnType<typeof createFocusHistory>;

/** One ring per call, one call and one missed entry per call across windows (AC-F16-24). */
export function mergeReports(reports: Map<number, CallWindowsState>, usedLast: number[]): Merged {
  const order = [...usedLast, ...[...reports.keys()].filter((id) => !usedLast.includes(id))];
  const rings = new Map<string, RingInfo>();
  const missed = new Map<string, MissedInfo>();
  let call: CallInfo | null = null;
  let callWindow: number | undefined;
  for (const id of [...reports.keys()]) {
    const report = reports.get(id) as CallWindowsState;
    for (const r of report.rings) if (!rings.has(r.callId)) rings.set(r.callId, r);
    for (const m of report.missed) if (!missed.has(m.callId)) missed.set(m.callId, m);
  }
  for (const id of order) {
    const report = reports.get(id);
    if (report?.call) {
      call = report.call;
      callWindow = id;
      break;
    }
  }
  return { rings: [...rings.values()], call, callWindow, missed: [...missed.values()] };
}

/** The remembered place if it still lies wholly inside the screen it was on, else the default corner. */
export function placeOrFallback(
  place: Place | undefined,
  displays: Display[],
  fallbackDisplayId: number,
  size: { width: number; height: number },
): { x: number; y: number } {
  const screen = place && displays.find((d) => d.id === place.displayId);
  if (place && screen) {
    const a = screen.workArea;
    const inside =
      place.x >= a.x &&
      place.y >= a.y &&
      place.x + size.width <= a.x + a.width &&
      place.y + size.height <= a.y + a.height;
    if (inside) return { x: place.x, y: place.y };
  }
  const target = displays.find((d) => d.id === fallbackDisplayId) ?? (displays[0] as Display);
  const a = target.workArea;
  return { x: a.x + a.width - EDGE - size.width, y: a.y + a.height - EDGE - size.height };
}

export interface LayoutInput {
  displays: Display[];
  primaryId: number;
  /** The screen holding the MeetApp window used last: the default corner (AC-F16-01). */
  lastUsedDisplayId: number;
  places: Places;
  rings: number;
  mini: boolean;
}

/**
 * Where each window goes (AC-F16-08, 09, 19, 20). Rings: index 0 is the oldest, lowest one; each newer
 * one sits GAP above. They never overlap the mini window: when they would, the stack starts above it.
 */
export function layoutWindows(input: LayoutInput): { mini?: Rect; rings: Rect[] } {
  const { displays, places } = input;
  const corner = displays.some((d) => d.id === input.lastUsedDisplayId) ? input.lastUsedDisplayId : input.primaryId;
  const mini = input.mini ? { ...placeOrFallback(places.mini, displays, corner, MINI_SIZE), ...MINI_SIZE } : undefined;
  const start = placeOrFallback(places.ring, displays, corner, RING_SIZE);
  let bottom = start.y;
  const first = { ...start, ...RING_SIZE };
  if (mini && overlaps(first, mini)) bottom = Math.min(start.y, mini.y - GAP - RING_SIZE.height);
  const rings: Rect[] = [];
  for (let i = 0; i < input.rings; i += 1) {
    rings.push({ x: start.x, y: bottom - i * (RING_SIZE.height + GAP), ...RING_SIZE });
  }
  return { ...(mini ? { mini } : {}), rings };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

export type CallWindowAction =
  | { name: "accept"; callId: string; video: boolean }
  | { name: "decline" | "hide"; callId: string }
  | { name: "toggleMic" | "toggleCamera" | "share" | "toggleHand" | "leave" | "backToCall" };

const RING_ACTIONS = new Set(["accept", "decline", "hide"]);
const CALL_ACTIONS = new Set(["toggleMic", "toggleCamera", "share", "toggleHand", "leave", "backToCall"]);
/** These open something in the main window, so it comes to the front first (AC-F16-03, 17). */
const BRING_FORWARD = new Set(["accept", "share", "backToCall"]);

/** Checks a small window's button press; true shape and names only (design.md 3.2). */
export function isCallWindowAction(value: unknown): value is CallWindowAction {
  if (typeof value !== "object" || value === null) return false;
  const action = value as Record<string, unknown>;
  const keys = Object.keys(action).sort().join(",");
  const id = typeof action["callId"] === "string" && action["callId"].length > 0 && action["callId"].length <= 100;
  if (action["name"] === "accept") return keys === "callId,name,video" && id && typeof action["video"] === "boolean";
  if (RING_ACTIONS.has(action["name"] as string)) return keys === "callId,name" && id;
  return keys === "name" && CALL_ACTIONS.has(action["name"] as string);
}

/** Which main window gets an action, and whether it comes to the front; refused when nothing matches. */
export function routeAction(
  action: CallWindowAction,
  merged: Merged,
  usedLast: number[],
): { ok: false } | { ok: true; target: number; focus: boolean } {
  const focus = BRING_FORWARD.has(action.name);
  if ("callId" in action) {
    if (!merged.rings.some((r) => r.callId === action.callId)) return { ok: false };
    const target = usedLast[0];
    return target === undefined ? { ok: false } : { ok: true, target, focus };
  }
  if (!merged.call || merged.callWindow === undefined) return { ok: false };
  return { ok: true, target: merged.callWindow, focus };
}

/** Missed calls to notify: once per call, only when no MeetApp window was in front as the ring ended. */
export function missedToNotify(missed: MissedInfo[], focus: FocusHistory, told: Set<string>): MissedInfo[] {
  const fresh = missed.filter((m) => !told.has(m.callId));
  for (const m of fresh) told.add(m.callId);
  return fresh.filter((m) => !focus.inFrontAt(m.endedAt));
}
