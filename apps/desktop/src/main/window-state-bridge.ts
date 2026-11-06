// Electron wiring for the main window's size and place (F04 design.md 3.5): read and checked before the
// window opens, written to userData/window-state.json 500 ms after a move or resize stops. Thin on purpose.
import { join } from "node:path";
import { app, screen, type BrowserWindow } from "electron";
import { readJson, writeJson } from "./login-item-bridge.ts";
import { restoreState, saveLater, type WindowState } from "./window-state.ts";

const file = () => join(app.getPath("userData"), "window-state.json");
const displays = () => screen.getAllDisplays().map((d) => ({ id: d.id, workArea: d.workArea }));

/** Where the window opens. */
export function savedWindowState(): WindowState {
  return restoreState(readJson(file()), displays(), screen.getPrimaryDisplay().id);
}

/** Keeps the window's place; the normal (not maximized) size is the one saved. */
export function rememberWindow(window: BrowserWindow, start: WindowState): void {
  if (start.maximized) window.once("ready-to-show", () => window.maximize());
  const save = saveLater(
    (run, ms) => {
      const timer = setTimeout(run, ms);
      return () => clearTimeout(timer);
    },
    () => {
      if (window.isDestroyed()) return;
      const bounds = window.getNormalBounds();
      const displayId = screen.getDisplayMatching(bounds).id;
      writeJson(file(), { ...bounds, maximized: window.isMaximized(), displayId });
    },
  );
  for (const change of ["move", "resize", "maximize", "unmaximize"] as const) window.on(change as "move", save);
}
