// Electron wiring for F16's small windows (design.md sections 1, 3; D079). Thin on purpose: the decisions
// live in call-windows-controller.ts and call-windows.ts. Opens the small windows in their own locked
// session, follows which main window is in front, keeps their places in userData/call-windows.json, and
// shows missed-call notifications (D080: they need a signed app).
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  BrowserWindow,
  MessageChannelMain,
  Notification,
  app,
  ipcMain,
  screen,
  session,
  webContents,
  type IpcMainEvent,
} from "electron";
import { serveScreens } from "./app-protocol.ts";
import { CallWindowsController, type CallWindowsDeps, type SmallKind } from "./call-windows-controller.ts";
import {
  CALL_WINDOW_CHANNEL,
  CALL_WINDOWS_CHANNEL,
  FRAMES_CHANNEL,
  MINI_SIZE,
  RING_SIZE,
  senderAllowed,
  type Places,
  watchDrag,
} from "./call-windows.ts";
import { validPlaces } from "./call-windows-checks.ts";
import { notifyMissed } from "./call-windows-notify.ts";
import { lockDownCallWindowSession } from "./guards.ts";
import { CALL_WINDOW_PAGE, CALL_WINDOW_PARTITION, smallPageAllows, smallWindowSetup } from "./security.ts";

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
    return validPlaces(JSON.parse(readFileSync(file, "utf8")));
  } catch {
    // No file yet, or an unreadable one: the default corner is used.
    return {};
  }
}

function writePlaces(file: string, places: Places): void {
  try {
    writeFileSync(file, JSON.stringify(places), { mode: 0o600 });
  } catch {
    // A full or read-only disk: the place is simply not remembered this time.
  }
}

interface SmallWindowEvents {
  onMoved: (window: BrowserWindow) => void;
  onClosed: (id: number) => void;
}

/**
 * Only a drag by the person counts (AC-F16-19): "will-move" fires only for those, never for the app's
 * own setBounds or a small nudge by macOS. `onSettled` runs once the window is still.
 */
function followDrag(window: BrowserWindow, onSettled: () => void) {
  const drag = watchDrag((run, ms) => {
    const timer = setTimeout(run, ms);
    return () => clearTimeout(timer);
  }, onSettled);
  window.on("will-move", drag.willMove);
  window.on("moved", drag.moved);
  return drag;
}

function openSmallWindow(kind: SmallKind, options: CallWindowsOptions, { onMoved, onClosed }: SmallWindowEvents) {
  const setup = smallWindowSetup(options.preloadPath, kind === "ring" ? RING_SIZE : MINI_SIZE);
  const window = new BrowserWindow(setup.options);
  // Placed only when the place changes, and never while the person drags it (no jumping back).
  let placed = "";
  // Sent only when the view changes: it can hold photos of up to 400 KB (bug review).
  let sent = "";
  window.setAlwaysOnTop(true, setup.alwaysOnTopLevel);
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: setup.visibleOnFullScreen });
  window.setContentProtection(setup.contentProtection);
  const drag = followDrag(window, () => {
    // Forget the last place, so a window dropped where it can't stay is moved back (bug review).
    placed = "";
    if (!window.isDestroyed()) onMoved(window);
  });
  const id = window.webContents.id;
  let closing = false;
  window.on("closed", () => {
    if (!closing) onClosed(id);
  });
  void window.loadURL(new URL(CALL_WINDOW_PAGE, options.appUrl).toString());
  const ready = new Promise<void>((resolve) => window.webContents.once("did-finish-load", () => resolve()));
  return {
    id,
    setBounds: (rect: { x: number; y: number; width: number; height: number }) => {
      const key = JSON.stringify(rect);
      if (window.isDestroyed() || drag.dragging() || key === placed) return;
      placed = key;
      window.setBounds(rect);
    },
    showInactive: () => void ready.then(() => !window.isDestroyed() && window.showInactive()),
    close: () => {
      closing = true;
      if (!window.isDestroyed()) window.destroy();
    },
    send: (state: unknown) => {
      const key = JSON.stringify(state);
      if (key === sent) return;
      sent = key;
      void ready.then(() => !window.isDestroyed() && window.webContents.send(CALL_WINDOW_CHANNEL, state));
    },
  };
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
      openSmallWindow(kind, options, {
        onMoved: (window) => {
          const { x, y } = window.getBounds();
          controller().moved(window.webContents.id, x, y, screen.getDisplayMatching(window.getBounds()).id);
        },
        onClosed: (id) => controller().smallClosed(id),
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
    savePlaces: (places) => writePlaces(placesFile, places),
    notify: (missed) => notifyMissed(missed, Notification, (action) => controller().fromNotification(action)),
    now: () => Date.now(),
    later: (ms, run) => void setTimeout(run, ms),
    ...mainWindowLines(mains),
  };
}

/** The live-video line and full speed of the main windows (design.md 3.5). */
function mainWindowLines(mains: MainWindows): Pick<CallWindowsDeps, "linkFrames" | "unlinkFrames" | "fullSpeed"> {
  return {
    linkFrames: (miniId, mainId) => {
      const mini = webContents.fromId(miniId);
      const main = mains.get(mainId);
      if (!mini || !main || main.isDestroyed()) return;
      const { port1, port2 } = new MessageChannelMain();
      main.webContents.postMessage(FRAMES_CHANNEL, null, [port1]);
      const give = () => mini.postMessage(FRAMES_CHANNEL, null, [port2]);
      if (mini.isLoading()) mini.once("did-finish-load", give);
      else give();
    },
    fullSpeed: (mainId, on) => {
      const window = mains.get(mainId);
      if (window && !window.isDestroyed()) window.webContents.setBackgroundThrottling(!on);
    },
    unlinkFrames: (mainId) => {
      const main = mains.get(mainId);
      if (main && !main.isDestroyed()) main.webContents.postMessage(FRAMES_CHANNEL, null, []);
    },
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
export interface CallWindows {
  watch: (window: BrowserWindow) => void;
  /** A call or meeting runs in some main window (F04 AC-06). */
  hasCall: () => boolean;
}

export function setUpCallWindows(options: CallWindowsOptions): CallWindows {
  const smallSession = session.fromPartition(CALL_WINDOW_PARTITION);
  lockDownCallWindowSession(smallSession, options.devServerUrl, options.csp);
  if (!options.devServerUrl)
    serveScreens(options.rendererDir, () => options.csp, smallSession.protocol, smallPageAllows);
  const mains: MainWindows = new Map();
  const controller: CallWindowsController = new CallWindowsController(computerFor(options, mains, () => controller));
  listen(controller, mains);
  const focused = () => [...mains.entries()].find(([, w]) => !w.isDestroyed() && w.isFocused())?.[0];
  return {
    hasCall: () => controller.hasCall(),
    watch(window) {
      const id = window.webContents.id;
      mains.set(id, window);
      for (const change of ["focus", "blur", "minimize", "restore", "hide", "show"] as const)
        window.on(change as "focus", () => controller.focusChanged(focused()));
      window.webContents.on("render-process-gone", () => controller.dropReport(id));
      // A real reload of the page (not an in-page change); the page reports again once it has loaded.
      window.webContents.on("did-start-navigation", (details) => {
        if (details.isMainFrame && !details.isSameDocument) controller.dropReport(id);
      });
      window.on("closed", () => {
        mains.delete(id);
        controller.dropReport(id);
        controller.focusChanged(focused());
      });
    },
  };
}
