// The menu-bar (Mac) or tray (Windows) menu (F04 design.md section 1, AC-F04-05). No Electron here so it
// can be unit-tested; tray.ts turns it into the real menu.

/** The statuses a person can choose (AC-F04-20); the tray sets them "until changed". */
const TRAY_STATUSES = [
  ["available", "Available"],
  ["busy", "Busy"],
  ["dnd", "Do not disturb"],
  ["brb", "Be right back"],
  ["away", "Appear away"],
] as const;

type TrayStatus = (typeof TRAY_STATUSES)[number][0];

/** What a menu item asks for. */
export type TrayChoice =
  | { kind: "open" }
  | { kind: "settings" }
  | { kind: "signIn" }
  | { kind: "quit" }
  | { kind: "status"; status: TrayStatus };

export interface TrayItem {
  label?: string;
  type?: "separator" | "submenu";
  submenu?: TrayItem[];
  choice?: TrayChoice;
}

const separator: TrayItem = { type: "separator" };

/** Signed in: Open, Status ▸, Settings, Quit. Signed out: Open, Sign in, Quit. */
export function trayMenu(signedIn: boolean, productName: string): TrayItem[] {
  const open: TrayItem = { label: `Open ${productName}`, choice: { kind: "open" } };
  const quit: TrayItem = { label: `Quit ${productName}`, choice: { kind: "quit" } };
  if (!signedIn) return [open, { label: "Sign in", choice: { kind: "signIn" } }, separator, quit];
  const statuses = TRAY_STATUSES.map(([status, label]): TrayItem => ({ label, choice: { kind: "status", status } }));
  return [
    open,
    separator,
    { label: "Status", type: "submenu", submenu: statuses },
    { label: "Settings", choice: { kind: "settings" } },
    separator,
    quit,
  ];
}

/** Windows (as Teams): left click opens the window, right click the menu. Mac: any click shows the menu. */
export function clickOpensWindow(platform: NodeJS.Platform, button: "left" | "right"): boolean {
  return platform !== "darwin" && button === "left";
}

/** Main → the main window: what the tray asked the screens to do (open Settings, set a status). */
export const APP_CHANNEL = "meetapp:app";

export type TrayCommand =
  | { kind: "settings" }
  | { kind: "status"; status: TrayStatus }
  /** F04 AC-04: the window was closed for the first time on this computer; the screens show the card. */
  | { kind: "stillRunning"; where: "menuBar" | "tray" };

/** Only the commands above reach the screens' listener (the preload checks what main sends). */
export function isTrayCommand(value: unknown): value is TrayCommand {
  if (typeof value !== "object" || value === null) return false;
  const command = value as { kind?: unknown; status?: unknown };
  if (command.kind === "settings") return true;
  if (command.kind === "stillRunning") {
    const where = (value as { where?: unknown }).where;
    return where === "menuBar" || where === "tray";
  }
  return command.kind === "status" && TRAY_STATUSES.some(([status]) => status === command.status);
}
