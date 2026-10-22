// The desktop app's main process (design.md section 5): one locked-down window showing apps/web.
// Development: the Vite dev server (MEETAPP_RENDERER_URL). Otherwise: the built screens on app://meetapp.
import { join } from "node:path";
import { BrowserWindow, app, powerMonitor, safeStorage, session, shell } from "electron";
import { registerAppScheme, serveScreens } from "./app-protocol.ts";
import { createAuthActions } from "./auth-actions.ts";
import { applyApiAuth, registerAuthBridge } from "./auth-bridge.ts";
import { createAuthClient } from "./auth-client.ts";
import { addSpellcheckMenu, registerFilesBridge, setUpSpellcheck } from "./chat-bridge.ts";
import { POWER_CHANNEL } from "./chat-desktop.ts";
import { createTokenStore } from "./auth-token.ts";
import { createProviderSignIn } from "./provider-sign-in.ts";
import { guardContents, lockDownSession } from "./guards.ts";
import { createMediaActions } from "./media-actions.ts";
import { realMediaSystem, registerMediaBridge } from "./media-bridge.ts";
import { createSharePicker } from "./media-permissions.ts";
import { canOpenHandOffStart, contentSecurityPolicy, webPreferences, APP_ORIGIN } from "./security.ts";
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

if (settings.userDataDir) app.setPath("userData", settings.userDataDir);
// Sandbox every page, including any created later, not only the main window.
app.enableSandbox();
startSentry(settings.sentryDsn);
registerAppScheme();

app.on("web-contents-created", (_event, contents) => {
  guardContents(contents, appUrl, (url) => shell.openExternal(url));
  addSpellcheckMenu(contents);
});
app.on("window-all-closed", () => app.quit());

/** F14 AC-F14-26: a locked computer shows as Away; the screens hear it through the bridge's `power`. */
function forwardLockChanges(window: BrowserWindow): void {
  const send = (locked: boolean) => () => {
    if (!window.isDestroyed()) window.webContents.send(POWER_CHANNEL, locked);
  };
  const lock = send(true);
  const unlock = send(false);
  powerMonitor.on("lock-screen", lock);
  powerMonitor.on("unlock-screen", unlock);
  window.once("closed", () => {
    powerMonitor.off("lock-screen", lock);
    powerMonitor.off("unlock-screen", unlock);
  });
}

function openWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "MeetApp",
    show: false,
    webPreferences: webPreferences(settings.preloadPath),
  });
  window.once("ready-to-show", () => window.show());
  forwardLockChanges(window);
  void window.loadURL(appUrl);
}

// Not awaited at the top level: Electron only becomes ready after this file has finished running.
void app.whenReady().then(() => {
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
  applyApiAuth(session.defaultSession, settings.apiUrl, tokens);
  if (!settings.devServerUrl) serveScreens(settings.rendererDir, csp);
  openWindow();
});
