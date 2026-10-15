// What the screens may ask the main process about camera, microphone and screen sharing (F02 design.md
// section 5): the list behind `window.meetapp.media` and `window.meetapp.deviceKey`. Free of Electron
// imports; media-bridge.ts gives it the real system.
import type { SharePicker } from "./media-permissions.ts";

export const MEDIA_CHANNEL = "meetapp:media";

export type AccessKind = "camera" | "microphone";
/** As the system reports it: "granted", "denied", "restricted", "not-determined" or "unknown". */
export type AccessStatus = string;

export interface ShareSourceInfo {
  id: string;
  name: string;
  kind: "screen" | "window";
  /** A small preview as a data: address (img-src allows data:). */
  thumbnail: string;
}

/** The computer's side, given by media-bridge.ts (and by fakes in tests). */
export interface MediaSystem {
  status: (kind: AccessKind | "screen") => AccessStatus;
  /** macOS asks the person; other systems answer true. */
  ask: (kind: AccessKind) => Promise<boolean>;
  sources: () => Promise<ShareSourceInfo[]>;
  deviceKey: () => string;
}

const KINDS = new Set(["camera", "microphone"]);

export function createMediaActions(system: MediaSystem, picker: SharePicker) {
  // Only a source from the latest list may be chosen. The page sees stand-in ids ("share-1" …), never
  // the system's, so it can't capture a screen around our picker.
  let offered = new Map<string, ShareSourceInfo>();
  return {
    accessStatus: () => ({
      camera: system.status("camera"),
      microphone: system.status("microphone"),
      screen: system.status("screen"),
    }),
    requestAccess: async (kind: AccessKind) => KINDS.has(kind) && (await system.ask(kind)),
    getShareSources: async () => {
      const sources = await system.sources();
      offered = new Map(sources.map((source, index) => [`share-${String(index + 1)}`, source]));
      return [...offered].map(([id, source]) => ({ ...source, id }));
    },
    chooseShareSource: (id: string) => {
      const source = offered.get(id);
      if (!source) return { ok: false as const };
      picker.choose({ id: source.id, name: source.name });
      return { ok: true as const };
    },
    deviceKey: () => system.deviceKey(),
  };
}

export type MediaActions = ReturnType<typeof createMediaActions>;
export const MEDIA_ACTION_NAMES = [
  "accessStatus",
  "requestAccess",
  "getShareSources",
  "chooseShareSource",
  "deviceKey",
] as const satisfies readonly (keyof MediaActions)[];

/** The name is one of the actions and the arguments are what it takes (a string at most). */
export function isValidMediaCall(name: unknown, args: unknown): name is keyof MediaActions {
  if (!Array.isArray(args) || !(MEDIA_ACTION_NAMES as readonly unknown[]).includes(name)) return false;
  if (name === "requestAccess" || name === "chooseShareSource")
    return args.length === 1 && typeof args[0] === "string" && args[0].length <= 200;
  return args.length === 0;
}
