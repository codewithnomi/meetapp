// Electron wiring for updates and Settings → About (F04 design.md 3.5; AC-F04-50). Thin on purpose.
import { app, ipcMain } from "electron";
import { fromAppPage } from "./auth-bridge.ts";
import { ABOUT_CHANNEL, UPDATES_ENABLED, startUpdates } from "./updates.ts";

export function setUpUpdates(appUrl: string): void {
  const state = startUpdates(UPDATES_ENABLED, async () => (await import("electron-updater")).autoUpdater);
  ipcMain.handle(ABOUT_CHANNEL, async (event) => {
    if (!fromAppPage(event, appUrl)) throw new Error("Refused: not the app's own page");
    return { version: app.getVersion(), updates: (await state).enabled };
  });
}
