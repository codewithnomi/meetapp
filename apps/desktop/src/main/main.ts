// The desktop app's main process (design.md section 5): one locked-down window showing apps/web.
// Development: the Vite dev server (MEETAPP_RENDERER_URL). Otherwise: the built screens on app://meetapp.
import { join } from "node:path";
import { BrowserWindow, app, powerMonitor, safeStorage, session, shell } from "electron";
import { appIdentity } from "../../app-identity.ts";
import { bringBack, holdSingleCopy, setUpAppLife } from "./app-life-bridge.ts";
import { createTray } from "./tray.ts";
import { hiddenStart, setUpLoginItem } from "./login-item-bridge.ts";
import { linkInArgs } from "./links.ts";
import { createMeetingLinks } from "./meeting-links.ts";
import { registerAppScheme, serveScreens } from "./app-protocol.ts";
import { setUpCallWindows, type CallWindows } from "./call-windows-bridge.ts";
import { createAuthActions } from "./auth-actions.ts";
import { applyApiAuth, registerAuthBridge } from "./auth-bridge.ts";
import { createAuthClient } from "./auth-client.ts";
import { addSpellcheckMenu, registerFilesBridge, setUpSpellcheck } from "./chat-bridge.ts";
import { POWER_CHANNEL } from "./chat-desktop.ts";
import { MIN_SIZE } from "./window-state.ts";
import { rememberWindow, savedWindowState } from "./window-state-bridge.ts";
import { createTokenStore } from "./auth-token.ts";
import { createProviderSignIn } from "./provider-sign-in.ts";
import { guardContents, lockDownSession } from "./guards.ts";
import { createMediaActions } from "./media-actions.ts";
import { realMediaSystem, registerMediaBridge } from "./media-bridge.ts";
import { createSharePicker } from "./media-permissions.ts";
import {
  canOpenHandOffStart,
  callWindowPolicy,
  contentSecurityPolicy,
  policyFor,
  webPreferences,
  APP_ORIGIN,
} from "./security.ts";
import { startSentry } from "./sentry.ts";
import { readSettings } from "./settings.ts";

const settings = readSettings(process.env, import.meta.dirname, app.isPackaged);
const appUrl = settings.devServerUrl ?? `${APP_ORIGIN}/index.html`;
const csp = contentSecurityPolicy({
  apiUrl: settings.apiUrl,
  devServerUrl: settings.devServerUrl,
  callServerUrl: settings.callServerUrl,
  gifApiUrl: settings.gifApiUrl,
});

const smallCsp = callWindowPolicy(settings.devServerUrl);

if (settings.userDataDir) app.setPath("userData", settings.userDataDir);
// Sandbox every page, including any created later, not only the main window.
app.enableSandbox();
startSentry(settings.sentryDsn);
registerAppScheme();

app.on("web-contents-created", (_event, contents) => {
  guardContents(contents, appUrl, (url) => shell.openExternal(url));
  addSpellcheckMenu(contents);
});

// F04: the main window, once opened (a second start, a Dock click and Quit's question use it).
let mainWindow: BrowserWindow | undefined;
// One copy per profile folder (AC-F04-02): a second start only brings the first one forward.
// F04 AC-10: meeting links, kept until the screens listen.
const links = createMeetingLinks(appUrl, () => (bringBack(mainWindow), mainWindow));
const fromArgs = (args: readonly string[]) => {
  const link = linkInArgs(args);
  if (link) links.arrived(link);
};
const firstCopy = holdSingleCopy(() => mainWindow, fromArgs);
if (!firstCopy) app.quit();
// Mac: a clicked link (also one that starts MeetApp) comes as open-url, listened for this early.
app.on("will-finish-launching", () => {
  app.on("open-url", (event, url) => {
    event.preventDefault();
    links.arrived(url);
  });
});
fromArgs(process.argv);

/** F14 AC-F14-26: a locked computer shows as Away; the screens hear it through the bridge's `power`.
 * F04 AC-38: waking from sleep counts as unlocking, so the live line reconnects at once. */
function forwardLockChanges(window: BrowserWindow): void {
  const send = (locked: boolean) => () => {
    if (!window.isDestroyed()) window.webContents.send(POWER_CHANNEL, locked);
  };
  const lock = send(true);
  const unlock = send(false);
  powerMonitor.on("lock-screen", lock);
  powerMonitor.on("unlock-screen", unlock);
  powerMonitor.on("resume", unlock);
  window.once("closed", () => {
    powerMonitor.off("lock-screen", lock);
    powerMonitor.off("unlock-screen", unlock);
    powerMonitor.off("resume", unlock);
  });
}

function openWindow(callWindows: CallWindows, hidden: Promise<boolean>): void {
  // F04 AC-40: the size and place it had last time, checked against today's screens.
  const start = savedWindowState();
  const window = new BrowserWindow({
    x: start.x,
    y: start.y,
    width: start.width,
    height: start.height,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    title: appIdentity.productName,
    show: false,
    // F16: during a call the window keeps full speed behind other apps (call-windows-controller, design.md 3.5).
    webPreferences: webPreferences(settings.preloadPath),
  });
  // F04 AC-08: a login start stays hidden in the menu bar; Open MeetApp shows it.
  window.once("ready-to-show", () => void hidden.then((stay) => stay || window.show()));
  forwardLockChanges(window);
  rememberWindow(window, start);
  callWindows.watch(window);
  setUpAppLife({ inCall: callWindows.hasCall, mainWindow: () => mainWindow }).watch(window);
  links.watch(window);
  mainWindow = window;
  void window.loadURL(appUrl);
}

// Not awaited at the top level: Electron only becomes ready after this file has finished running.
void app.whenReady().then(() => {
  if (!firstCopy) return;
  const picker = createSharePicker();
  lockDownSession(session.defaultSession, {
    csp,
    devServerUrl: settings.devServerUrl,
    appUrl,
    picker,
    apiUrl: settings.apiUrl,
  });
  setUpSpellcheck(session.defaultSession);
  registerFilesBridge(appUrl, settings.apiUrl);
  registerMediaBridge(createMediaActions(realMediaSystem(), picker), appUrl);
  // safeStorage works only once the app is ready.
  const tokens = createTokenStore(safeStorage, join(app.getPath("userData"), "auth-token"));
  const client = createAuthClient(settings.apiUrl, tokens);
  const providers = createProviderSignIn({
    client,
    tokens,
    // Only the backend's start link (https, or this computer in development: D040 extended).
    openInBrowser: async (url) => canOpenHandOffStart(url, app.isPackaged) && (await shell.openExternal(url), true),
  });
  registerAuthBridge(createAuthActions(client, tokens, providers), appUrl);
  setUpLoginItem(appUrl);
  createTray({
    signedIn: () => tokens.get() !== undefined,
    showWindow: () => (bringBack(mainWindow), mainWindow),
  });
  applyApiAuth(session.defaultSession, settings.apiUrl, tokens);
  if (!settings.devServerUrl) serveScreens(settings.rendererDir, (url) => policyFor(url, csp, smallCsp));
  openWindow(
    setUpCallWindows({
      preloadPath: settings.callWindowPreloadPath,
      appUrl,
      rendererDir: settings.rendererDir,
      devServerUrl: settings.devServerUrl,
      csp: smallCsp,
    }),
    // A meeting link always shows the window.
    hiddenStart(links.waiting()),
  );
});
