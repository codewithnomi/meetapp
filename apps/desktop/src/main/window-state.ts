// F04: where the main window was (design.md 3.5; AC-F04-40): `{x, y, width, height, maximized, displayId}`,
// checked against today's screens when read. A missing screen, a broken file or odd numbers open the window
// centred on the main screen at a safe size. Free of Electron, so it can be tested.
import type { Display, Rect } from "./call-windows.ts";

export interface WindowState extends Rect {
  maximized: boolean;
  displayId: number;
}

const DEFAULT_SIZE = { width: 1200, height: 800 };
export const MIN_SIZE = { width: 800, height: 600 };
/** Saved only once the window has been still this long. */
export const SAVE_AFTER_MS = 500;

const whole = (v: unknown): v is number => Number.isInteger(v) && Math.abs(v as number) < 100_000;

/** Centred on the main screen, as large as the default but never larger than the screen. */
function centred(primary: Display): WindowState {
  const area = primary.workArea;
  const width = Math.min(DEFAULT_SIZE.width, area.width);
  const height = Math.min(DEFAULT_SIZE.height, area.height);
  const x = area.x + Math.round((area.width - width) / 2);
  const y = area.y + Math.round((area.height - height) / 2);
  return { x, y, width, height, maximized: false, displayId: primary.id };
}

/** The saved state if it is whole and fits its screen, else the centred default (TC-F04-76). */
export function restoreState(saved: unknown, displays: Display[], primaryId: number): WindowState {
  const primary = displays.find((d) => d.id === primaryId) ?? (displays[0] as Display);
  const s = (typeof saved === "object" && saved !== null ? saved : {}) as Record<string, unknown>;
  const numbers = ["x", "y", "width", "height", "displayId"].every((key) => whole(s[key]));
  const screen = numbers ? displays.find((d) => d.id === s["displayId"]) : undefined;
  if (!screen || typeof s["maximized"] !== "boolean") return centred(primary);
  const state = s as unknown as WindowState;
  const a = screen.workArea;
  const fits =
    state.width >= MIN_SIZE.width &&
    state.height >= MIN_SIZE.height &&
    state.x >= a.x &&
    state.y >= a.y &&
    state.x + state.width <= a.x + a.width &&
    state.y + state.height <= a.y + a.height;
  return fits ? { ...state } : centred(primary);
}

/** Runs `save` once things have been still for SAVE_AFTER_MS. */
export function saveLater(later: (run: () => void, ms: number) => () => void, save: () => void) {
  let cancel: (() => void) | undefined;
  return () => {
    cancel?.();
    cancel = later(save, SAVE_AFTER_MS);
  };
}
