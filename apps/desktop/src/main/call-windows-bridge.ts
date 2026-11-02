// Electron wiring for F16's small windows (design.md sections 1, 3; D079). Thin on purpose: the decisions
// live in call-windows-controller.ts and call-windows.ts. Opens the small windows in their own locked
// session, follows which main window is in front, keeps their places in userData/call-windows.json, and
// shows missed-call notifications (D080: they need a signed app).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, Notification, app, ipcMain, screen, session, type IpcMainEvent } from "electron";
import { serveScreens } from "./app-protocol.ts";
import { CallWindowsController, type CallWindowsDeps, type SmallKind } from "./call-windows-controller.ts";
import {
  CALL_WINDOW_CHANNEL,
  CALL_WINDOWS_CHANNEL,
  MINI_SIZE,
  RING_SIZE,
  senderAllowed,
  type MissedInfo,
  type Places,
} from "./call-windows.ts";
import { lockDownCallWindowSession } from "./guards.ts";
import { CALL_WINDOW_PAGE, CALL_WINDOW_PARTITION, smallWindowSetup } from "./security.ts";

export interface CallWindowsOptions {
  preloadPath: string;
  /** The app's own address: the small page is CALL_WINDOW_PAGE next to it. */
  appUrl: string;
  rendererDir: string;
  devServerUrl: string | undefined;
  csp: string;
}

function readPlaces(file: string): Places {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Places;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function openSmallWindow(kind: SmallKind, options: CallWindowsOptions, onMoved: (window: BrowserWindow) => void) {
  const setup = smallWindowSetup(options.preloadPath, kind === "ring" ? RING_SIZE : MINI_SIZE);
  const window = new BrowserWindow(setup.options);
  window.setAlwaysOnTop(true, setup.alwaysOnTopLevel);
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: setup.visibleOnFullScreen });
  window.setContentProtection(setup.contentProtection);
  window.on("moved", () => onMoved(window));
  void window.loadURL(new URL(CALL_WINDOW_PAGE, options.appUrl).toString());
  const ready = new Promise<void>((resolve) => window.webContents.once("did-finish-load", () => resolve()));
  return {
    id: window.webContents.id,
    setBounds: (rect: { x: number; y: number; width: number; height: number }) => {
      if (!window.isDestroyed()) window.setBounds(rect);
    },
    showInactive: () => void ready.then(() => !window.isDestroyed() && window.showInactive()),
    close: () => {
      if (!window.isDestroyed()) window.destroy();
    },
    send: (state: unknown) =>
      void ready.then(() => !window.isDestroyed() && window.webContents.send(CALL_WINDOW_CHANNEL, state)),
  };
}

function notifyMissed(missed: MissedInfo, controller: CallWindowsController): void {
  if (!Notification.isSupported()) return;
  const body = missed.chatName ? `from ${missed.from} in ${missed.chatName}` : `from ${missed.from}`;
  const notification = new Notification({
    title: "Missed call",
    body,
    actions: [{ type: "button", text: "Call back" }],
  });
  notification.on("click", () =>
    controller.fromNotification({ name: "openChat", conversationId: missed.conversationId }),
  );
  notification.on("action", () =>
    controller.fromNotification({
      name: "callBack",
      conversationId: missed.conversationId,
      video: missed.kind === "video",
    }),
  );
  // Unsigned app or notifications off (D080, AC-F16-13): nothing else happens; the chat has the note.
  notification.on("failed", () => undefined);
  notification.show();
}

type MainWindows = Map<number, BrowserWindow>;

function computerFor(
  options: CallWindowsOptions,
  mains: MainWindows,
  controller: () => CallWindowsController,
): CallWindowsDeps {
  const placesFile = join(app.getPath("userData"), "call-windows.json");
  return {
    open: (kind) =>
      openSmallWindow(kind, options, (window) => {
        const { x, y } = window.getBounds();
        controller().moved(window.webContents.id, x, y, screen.getDisplayMatching(window.getBounds()).id);
      }),
    displays: () => screen.getAllDisplays().map((d) => ({ id: d.id, workArea: d.workArea })),
    primaryDisplayId: () => screen.getPrimaryDisplay().id,
    displayOf: (id) => {
      const window = mains.get(id);
      return window && !window.isDestroyed() ? screen.getDisplayMatching(window.getBounds()).id : undefined;
    },
    toMain: (id, action) => mains.get(id)?.webContents.send(CALL_WINDOWS_CHANNEL, action),
    focusMain: (id) => {
      const window = mains.get(id);
      if (!window || window.isDestroyed()) return;
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    },
    loadPlaces: () => readPlaces(placesFile),
    savePlaces: (places) => writeFileSync(placesFile, JSON.stringify(places)),
    notify: (missed) => notifyMissed(missed, controller()),
    now: () => Date.now(),
    later: (ms, run) => void setTimeout(run, ms),
  };
}

/** Only main windows report; only the small windows press buttons (TC-F16-55). */
function listen(controller: CallWindowsController, mains: MainWindows): void {
  const allowed = (event: IpcMainEvent, channel: string) =>
    senderAllowed(event.sender.id, controller.smallWindowIds(), channel) &&
    (channel === CALL_WINDOW_CHANNEL || mains.has(event.sender.id));
  ipcMain.on(CALL_WINDOWS_CHANNEL, (event, state: unknown) => {
    if (allowed(event, CALL_WINDOWS_CHANNEL)) controller.report(event.sender.id, state);
  });
  ipcMain.on(CALL_WINDOW_CHANNEL, (event, action: unknown) => {
    if (allowed(event, CALL_WINDOW_CHANNEL)) controller.act(event.sender.id, action);
  });
  for (const change of ["display-added", "display-removed", "display-metrics-changed"] as const)
    screen.on(change as "display-added", () => controller.screensChanged());
}

/** Sets up the small windows once the app is ready; `watch` is called for every main window. */
export function setUpCallWindows(options: CallWindowsOptions): { watch: (window: BrowserWindow) => void } {
  const smallSession = session.fromPartition(CALL_WINDOW_PARTITION);
  lockDownCallWindowSession(smallSession, options.devServerUrl, options.csp);
  if (!options.devServerUrl) serveScreens(options.rendererDir, () => options.csp, smallSession.protocol);
  const mains: MainWindows = new Map();
  const controller: CallWindowsController = new CallWindowsController(computerFor(options, mains, () => controller));
  listen(controller, mains);
  const focused = () => [...mains.entries()].find(([, w]) => !w.isDestroyed() && w.isFocused())?.[0];
  return {
    watch(window) {
      const id = window.webContents.id;
      mains.set(id, window);
      for (const change of ["focus", "blur", "minimize", "restore", "hide", "show"] as const)
        window.on(change as "focus", () => controller.focusChanged(focused()));
      window.webContents.on("render-process-gone", () => controller.dropReport(id));
      window.webContents.on("did-start-loading", () => controller.dropReport(id));
      window.on("closed", () => {
        mains.delete(id);
        controller.dropReport(id);
        controller.focusChanged(focused());
      });
    },
  };
}
