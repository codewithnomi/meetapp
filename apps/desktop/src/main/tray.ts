// The menu-bar (Mac) or tray (Windows) icon (F04 design.md section 1, AC-F04-05). Thin on purpose: the menu
// lives in tray-menu.ts. The menu is built on each click, so it always matches the sign-in state.
import { join } from "node:path";
import { Menu, Tray, app, nativeImage, type MenuItemConstructorOptions } from "electron";
import { appIdentity } from "../../app-identity.ts";
import { APP_CHANNEL, clickOpensWindow, trayMenu, type TrayChoice, type TrayItem } from "./tray-menu.ts";

export interface TrayOptions {
  signedIn: () => boolean;
  /** Shows the main window (restored and focused); returns it so a command can follow. */
  showWindow: () => Electron.BrowserWindow | undefined;
}

function icon(): Electron.NativeImage {
  const folder = join(app.getAppPath(), "build-resources");
  // Mac: a template image, coloured by the system for light and dark menu bars (the @2x file is found by name).
  if (process.platform === "darwin") return nativeImage.createFromPath(join(folder, "trayTemplate.png"));
  return nativeImage
    .createFromPath(join(folder, appIdentity.icon.replace("build-resources/", "")))
    .resize({ width: 32 });
}

function act(choice: TrayChoice, options: TrayOptions): void {
  if (choice.kind === "quit") return app.quit();
  const window = options.showWindow();
  if (!window || choice.kind === "open" || choice.kind === "signIn") return;
  window.webContents.send(APP_CHANNEL, choice);
}

function toElectron(items: TrayItem[], options: TrayOptions): MenuItemConstructorOptions[] {
  return items.map((item) => {
    if (item.type === "separator") return { type: "separator" };
    const { choice } = item;
    return {
      label: item.label ?? "",
      ...(item.submenu ? { submenu: toElectron(item.submenu, options) } : {}),
      ...(choice ? { click: () => act(choice, options) } : {}),
    };
  });
}

// Kept referenced for the app's life: a Tray that is garbage-collected disappears from the menu bar.
let shown: Tray | undefined;

/** Shows the icon (once). */
export function createTray(options: TrayOptions): void {
  if (shown) return;
  const tray = new Tray(icon());
  shown = tray;
  tray.setToolTip(appIdentity.productName);
  const menu = () => Menu.buildFromTemplate(toElectron(trayMenu(options.signedIn(), appIdentity.productName), options));
  tray.on("click", () => {
    if (clickOpensWindow(process.platform, "left")) options.showWindow();
    else tray.popUpContextMenu(menu());
  });
  tray.on("right-click", () => tray.popUpContextMenu(menu()));
}
