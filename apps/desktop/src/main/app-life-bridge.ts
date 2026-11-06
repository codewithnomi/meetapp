// Electron wiring for F04's close, quit and one-copy rules (design.md 3.1, 3.2). Thin on purpose: the
// decisions live in app-life.ts.
import { BrowserWindow, app, dialog, powerMonitor } from "electron";
import { join } from "node:path";
import { AppLife } from "./app-life.ts";
import { readJson, writeJson } from "./login-item-bridge.ts";
import { APP_CHANNEL } from "./tray-menu.ts";
import { platformWords } from "./platform-words.ts";

/** The first close on this computer: the screens show "MeetApp is still running" once (AC-04, TC-F04-10). */
function firstClose(window: BrowserWindow): void {
  const file = join(app.getPath("userData"), "app-state.json");
  const state = readJson(file);
  if (state["firstCloseSeen"] === true) return;
  writeJson(file, { ...state, firstCloseSeen: true });
  window.webContents.send(APP_CHANNEL, {
    kind: "stillRunning",
    where: platformWords(process.platform).where,
  });
}

export interface AppLifeOptions {
  inCall: () => boolean;
  /** The main window to show again (Dock click, a second start); undefined before it exists. */
  mainWindow: () => BrowserWindow | undefined;
}

/** Shows a hidden or minimized window and brings it to the front. */
export function bringBack(window: BrowserWindow | undefined): void {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function askQuitDuringCall(window: BrowserWindow | undefined): boolean {
  const options = {
    type: "question" as const,
    buttons: ["Quit", "Cancel"],
    defaultId: 1,
    cancelId: 1,
    message: "Quit MeetApp? You'll leave the call.",
  };
  const answer =
    window && !window.isDestroyed() ? dialog.showMessageBoxSync(window, options) : dialog.showMessageBoxSync(options);
  return answer === 0;
}

/**
 * One copy per profile folder (AC-02): returns false when another copy already runs, which then comes
 * forward instead. Call before the app is ready, after the profile folder is set.
 */
export function holdSingleCopy(
  mainWindow: () => BrowserWindow | undefined,
  onSecondStart: (args: readonly string[]) => void,
): boolean {
  if (!app.requestSingleInstanceLock()) return false;
  app.on("second-instance", (_event, args) => {
    bringBack(mainWindow());
    // Windows: a clicked meeting link arrives as the second start's arguments (AC-F04-10).
    onSecondStart(args);
  });
  return true;
}

/** Closing hides; Quit asks during a call; a shutdown or logout quits without asking (AC-04, 06). */
export function setUpAppLife(options: AppLifeOptions): { watch: (window: BrowserWindow) => void } {
  const life = new AppLife({
    inCall: options.inCall,
    confirmQuitDuringCall: () => askQuitDuringCall(options.mainWindow()),
  });
  // Closed windows are only hidden, so this happens only while quitting; MeetApp keeps running otherwise.
  app.on("window-all-closed", () => undefined);
  app.on("before-quit", (event) => {
    if (!life.mayQuit("person")) event.preventDefault();
  });
  // Mac: the Dock icon stays; clicking it shows the window again.
  app.on("activate", () => bringBack(options.mainWindow()));
  powerMonitor.on("shutdown", () => {
    life.mayQuit("system");
    app.quit();
  });
  return {
    watch(window) {
      window.on("close", (event) => {
        if (!life.closeHides()) return;
        event.preventDefault();
        window.hide();
        firstClose(window);
      });
      // Windows: logging out or shutting down (query-session-end comes first and may be the only one).
      const systemQuit = () => {
        life.mayQuit("system");
        app.quit();
      };
      window.on("query-session-end", systemQuit);
      window.on("session-end", systemQuit);
    },
  };
}
