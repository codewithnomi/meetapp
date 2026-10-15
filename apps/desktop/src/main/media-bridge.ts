// Electron wiring for camera, microphone and screen sharing (F02 design.md section 5). Thin on purpose;
// the rules live in media-permissions.ts and media-actions.ts. Main answers only its own window's top page.
import { join } from "node:path";
import { app, desktopCapturer, ipcMain, systemPreferences } from "electron";
import { fromAppPage } from "./auth-bridge.ts";
import { loadDeviceKey } from "./device-key.ts";
import {
  MEDIA_CHANNEL,
  isValidMediaCall,
  type AccessKind,
  type MediaActions,
  type MediaSystem,
} from "./media-actions.ts";

const THUMBNAIL = { width: 320, height: 180 };
/** Linux has no system switch for these; the browser's own errors report a missing or busy device. */
const hasSystemSwitch = process.platform === "darwin" || process.platform === "win32";

export function realMediaSystem(): MediaSystem {
  let key: string | undefined;
  return {
    status: (kind) => (hasSystemSwitch ? systemPreferences.getMediaAccessStatus(kind) : "granted"),
    ask: (kind: AccessKind) =>
      process.platform === "darwin" ? systemPreferences.askForMediaAccess(kind) : Promise.resolve(true),
    sources: async () =>
      (await desktopCapturer.getSources({ types: ["screen", "window"], thumbnailSize: THUMBNAIL })).map((source) => ({
        id: source.id,
        name: source.name,
        kind: source.id.startsWith("screen:") ? ("screen" as const) : ("window" as const),
        thumbnail: source.thumbnail.toDataURL(),
      })),
    deviceKey: () => (key ??= loadDeviceKey(join(app.getPath("userData"), "device-key"))),
  };
}

export function registerMediaBridge(actions: MediaActions, appUrl: string): void {
  ipcMain.handle(MEDIA_CHANNEL, async (event, name: unknown, args: unknown) => {
    if (!fromAppPage(event, appUrl)) throw new Error("Refused: not the app's own page");
    if (!isValidMediaCall(name, args)) return { ok: false, code: "BAD_REQUEST" };
    const action = actions[name] as (...values: unknown[]) => unknown;
    return action(...(args as unknown[]));
  });
}
