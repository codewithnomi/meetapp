// Camera, microphone and screen sharing (F02 design.md section 5, AC-F02-54, D040 updated). Only the
// app's own page may use them, and screen sharing only through our "Choose what to share" picker: the
// chosen source answers the next screen request once, within 10 seconds, never with computer sound.
// Free of Electron imports so the rules can be tested on their own; guards.ts wires them in.
import { isInsideApp } from "./security.ts";

/** Permissions the app's own page may have; everything else is refused. */
const MEDIA_TYPES = new Set(["audio", "video"]);
const SHARE_WINDOW_MS = 10_000;

export interface PermissionAsk {
  permission: string;
  /** The asking frame's address (or origin). */
  url: string;
  /** For media: "audio" and/or "video". */
  mediaTypes?: readonly string[] | undefined;
  /** Only the window's top frame may ask; embedded frames never. */
  isMainFrame: boolean;
}

/** A permission request (the page asks, the person may be prompted). */
export function allowsRequest(ask: PermissionAsk, appUrl: string): boolean {
  if (!ask.isMainFrame || !isInsideApp(ask.url, appUrl)) return false;
  // Screen capture: "display-capture" in newer Electron, "media" with no media types in Electron 44.
  // Our picker then decides what is shared (shareAnswer).
  if (ask.permission === "display-capture") return true;
  if (ask.permission !== "media") return false;
  const types = ask.mediaTypes ?? [];
  return types.every((type) => MEDIA_TYPES.has(type));
}

/** A permission check (the page asks whether it has a permission, without a prompt). */
export function allowsCheck(ask: PermissionAsk, appUrl: string): boolean {
  if (!ask.isMainFrame || !isInsideApp(ask.url, appUrl)) return false;
  // Choosing the speakers (setSinkId) is checked as "speaker-selection".
  return ask.permission === "media" || ask.permission === "speaker-selection";
}

export interface ShareSource {
  id: string;
  name: string;
}

/** The source chosen in our picker, kept until the next screen request or for 10 seconds. */
export function createSharePicker(now: () => number = Date.now) {
  let chosen: (ShareSource & { at: number }) | undefined;
  return {
    choose(source: ShareSource): void {
      chosen = { ...source, at: now() };
    },
    /** The answer to a screen request: the chosen source (once), or nothing. */
    take(): ShareSource | undefined {
      const source = chosen;
      chosen = undefined;
      if (!source || now() - source.at > SHARE_WINDOW_MS) return undefined;
      return { id: source.id, name: source.name };
    },
  };
}

export type SharePicker = ReturnType<typeof createSharePicker>;

/** What the screen request gets: only video of the chosen source, never computer sound; else refused. */
export function shareAnswer(
  picker: SharePicker,
  request: { securityOrigin: string; fromTopFrame: boolean },
  appUrl: string,
): { video: ShareSource } | null {
  if (!request.fromTopFrame || !isInsideApp(`${request.securityOrigin}/`, appUrl)) return null;
  const source = picker.take();
  return source ? { video: source } : null;
}
