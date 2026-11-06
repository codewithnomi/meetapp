// Electron wiring for start at login (F04 design.md 3.2). The packaged app uses the system's login items;
// development and tests use a stand-in file in the profile folder, so they never change the computer's
// real login items. Thin on purpose: the rules live in login-item.ts.
import { execFile } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app, ipcMain } from "electron";
import { fromAppPage } from "./auth-bridge.ts";
import {
  HIDDEN_ARG,
  LOGIN_ITEM_CHANNEL,
  firstStart,
  startsHidden,
  validSwitch,
  type AppState,
  type LoginSystem,
} from "./login-item.ts";

export function readJson(file: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(readFileSync(file, "utf8"));
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function writeJson(file: string, value: object): void {
  try {
    writeFileSync(file, JSON.stringify(value), { mode: 0o600 });
  } catch {
    // A full or read-only disk: asked again at the next start.
  }
}

function systemLoginItem(): LoginSystem {
  return {
    isOn: () => app.getLoginItemSettings().openAtLogin,
    // Windows passes --hidden; the Mac's new login items ignore args (the 60-second rule covers it, D086).
    set: (on) =>
      app.setLoginItemSettings({ openAtLogin: on, ...(process.platform === "win32" ? { args: [HIDDEN_ARG] } : {}) }),
  };
}

function standInLoginItem(file: string): LoginSystem {
  return { isOn: () => readJson(file)["openAtLogin"] === true, set: (on) => writeJson(file, { openAtLogin: on }) };
}

/** Seconds since the person logged in to the Mac (the login window's age); undefined elsewhere or unknown. */
function secondsSinceLogin(): Promise<number | undefined> {
  if (process.platform !== "darwin") return Promise.resolve(undefined);
  return new Promise((done) => {
    execFile("/bin/ps", ["-axo", "etimes=,comm="], { timeout: 2_000 }, (error, out) => {
      const line = error ? undefined : out.split("\n").find((row) => row.trim().endsWith("/loginwindow"));
      const seconds = line ? Number.parseInt(line.trim(), 10) : Number.NaN;
      done(Number.isFinite(seconds) ? seconds : undefined);
    });
  });
}

/** Sets the login item once after install and answers the Settings switch (AC-08, 09). */
export function setUpLoginItem(appUrl: string): void {
  const folder = app.getPath("userData");
  const system = app.isPackaged ? systemLoginItem() : standInLoginItem(join(folder, "login-item.json"));
  const stateFile = join(folder, "app-state.json");
  const state: AppState = { loginItemSet: readJson(stateFile)["loginItemSet"] === true };
  const changed = firstStart(state, system);
  if (changed) writeJson(stateFile, { ...readJson(stateFile), ...changed });
  ipcMain.handle(LOGIN_ITEM_CHANNEL, (event, name: unknown, on: unknown) => {
    if (!fromAppPage(event, appUrl)) throw new Error("Refused: not the app's own page");
    if (name === "set" && validSwitch(on)) system.set(on);
    return system.isOn();
  });
}

/** Whether this start stays hidden in the menu bar (AC-08). */
export async function hiddenStart(hasLink: boolean): Promise<boolean> {
  const openedAtLogin = process.platform === "darwin" && app.getLoginItemSettings().wasOpenedAtLogin === true;
  const seconds = hasLink || openedAtLogin || process.argv.includes(HIDDEN_ARG) ? undefined : await secondsSinceLogin();
  return startsHidden({ argv: process.argv, openedAtLogin, secondsSinceLogin: seconds, hasLink });
}
