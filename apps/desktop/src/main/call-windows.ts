// F16's small windows (design.md section 3; D079): the rules, without Electron, so they can be tested.
// When the ring windows and the mini call window are wanted, where they go, how several MeetApp
// windows' reports merge, which actions may pass, and which missed calls get a notification.
// call-windows-bridge.ts gives them the real windows, screens and focus.

/** Main window ↔ main: `report` (state) and `action` (to carry out). */
import type {
  CallWindowAction,
  CallWindowsCall as CallInfo,
  CallWindowsMissed as MissedInfo,
  CallWindowsRing as RingInfo,
  CallWindowsState,
} from "@meetapp/contracts";

export type { CallInfo, CallWindowAction, CallWindowsState, MissedInfo, RingInfo };

export const CALL_WINDOWS_CHANNEL = "meetapp:call-windows";
/** Small window ↔ main: `state` (to show) and `act` (a button press). */
export const CALL_WINDOW_CHANNEL = "meetapp:call-window";
/** Main → a main window and the mini window: the two ends of the live-video line, or "stop" (design.md 3.5). */
export const FRAMES_CHANNEL = "meetapp:call-window:frames";

/** The ring window as drawn on the approved canvas: caller, then the three round answers with their words. */
export const RING_SIZE = { width: 320, height: 160 };
/** The ring window with the "You're in … Accepting leaves it." line (AC-F16-07). */
export const RING_BUSY_HEIGHT = 212;
/** A ring window's height. */
export const ringHeight = (ring: { busyIn?: string | undefined }) =>
  ring.busyIn ? RING_BUSY_HEIGHT : RING_SIZE.height;
/** The mini call window: top line, the 150-point picture and the buttons (approved canvas). */
export const MINI_SIZE = { width: 320, height: 256 };
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
  /** The ring windows' heights, from the bottom of the stack up. */
  rings: number[];
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
  // The remembered place is the bottom window's top at the usual height; the stack grows up from its bottom.
  let bottom = start.y + RING_SIZE.height;
  if (mini && overlaps({ ...start, ...RING_SIZE }, mini)) bottom = Math.min(bottom, mini.y - GAP);
  const rings: Rect[] = [];
  for (const height of input.rings) {
    rings.push({ x: start.x, y: bottom - height, width: RING_SIZE.width, height });
    bottom -= height + GAP;
  }
  return { ...(mini ? { mini } : {}), rings };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

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
  // Remember only recent calls (a report holds at most 20 missed calls).
  for (const id of told) if (told.size > 200) told.delete(id);
  return fresh.filter((m) => !focus.inFrontAt(m.endedAt));
}

const short = (v: unknown, max = 200) => typeof v === "string" && v.length <= max;
const isPhoto = (v: unknown) => v === undefined || (short(v, 400_000) && (v as string).startsWith("data:image/"));
const isPerson = (v: unknown) => {
  const p = v as Record<string, unknown> | null;
  return typeof p === "object" && p !== null && short(p["name"]) && short(p["initials"], 4) && isPhoto(p["photo"]);
};
const isKind = (v: unknown) => v === "video" || v === "audio";
const optional = (v: unknown) => v === undefined || short(v);

function isRing(v: unknown): boolean {
  const r = v as Record<string, unknown>;
  return (
    typeof r === "object" &&
    r !== null &&
    short(r["callId"], 100) &&
    isPerson(r["caller"]) &&
    isKind(r["kind"]) &&
    optional(r["chatName"]) &&
    optional(r["busyIn"])
  );
}
function isCall(v: unknown): boolean {
  if (v === null) return true;
  const c = v as Record<string, unknown>;
  const speaker = c?.["speaker"] as Record<string, unknown> | undefined;
  return (
    typeof c === "object" &&
    short(c["title"]) &&
    Number.isFinite(c["joinedAt"]) &&
    Number.isInteger(c["people"]) &&
    ["lobby", "calling", "in-call", "reconnecting"].includes(c["phase"] as string) &&
    isPerson(speaker) &&
    typeof speaker?.["hasVideo"] === "boolean" &&
    typeof speaker["sharing"] === "boolean" &&
    ["mic", "camera", "hand", "canUnmute", "canShare"].every((k) => typeof c[k] === "boolean")
  );
}
function isText(v: unknown): boolean {
  const t = v as Record<string, unknown> | null;
  return (
    typeof t === "object" && t !== null && short(t["title"], 60) && short(t["body"], 200) && short(t["callBack"], 40)
  );
}
function isMissed(v: unknown): boolean {
  const m = v as Record<string, unknown>;
  return (
    typeof m === "object" &&
    m !== null &&
    short(m["callId"], 100) &&
    short(m["from"]) &&
    optional(m["chatName"]) &&
    isKind(m["kind"]) &&
    short(m["conversationId"], 100) &&
    Number.isFinite(m["endedAt"]) &&
    isText(m["text"])
  );
}

/** Checks a main window's report before main uses it (design.md 3.1); at most 20 entries per list. */
export function isCallWindowsState(value: unknown): value is CallWindowsState {
  const s = value as Record<string, unknown>;
  const list = (v: unknown, check: (x: unknown) => boolean) => Array.isArray(v) && v.length <= 20 && v.every(check);
  return (
    typeof s === "object" && s !== null && list(s["rings"], isRing) && isCall(s["call"]) && list(s["missed"], isMissed)
  );
}

/** Only main's own small windows may press buttons on CALL_WINDOW_CHANNEL; only main windows may report. */
export function senderAllowed(senderId: number, smallWindowIds: ReadonlySet<number>, channel: string): boolean {
  const small = smallWindowIds.has(senderId);
  return channel === CALL_WINDOW_CHANNEL ? small : !small;
}
