// Electron wiring for F04's close, quit and one-copy rules (design.md 3.1, 3.2). Thin on purpose: the
// decisions live in app-life.ts.
import { BrowserWindow, app, dialog, powerMonitor } from "electron";
import { AppLife } from "./app-life.ts";

export interface AppLifeOptions {
  inCall: () => boolean;
  /** The main window to show again (Dock click, a second start); undefined before it exists. */
  mainWindow: () => BrowserWindow | undefined;
}

function bringBack(window: BrowserWindow | undefined): void {
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
export function holdSingleCopy(mainWindow: () => BrowserWindow | undefined): boolean {
  if (!app.requestSingleInstanceLock()) return false;
  app.on("second-instance", () => bringBack(mainWindow()));
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
