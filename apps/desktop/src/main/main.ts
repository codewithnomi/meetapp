// The desktop app's main process (design.md section 5): one locked-down window showing apps/web.
// Development: the Vite dev server (MEETAPP_RENDERER_URL). Otherwise: the built screens on app://meetapp.
import { join } from "node:path";
import { BrowserWindow, app, safeStorage, session, shell } from "electron";
import { registerAppScheme, serveScreens } from "./app-protocol.ts";
import { createAuthActions } from "./auth-actions.ts";
import { applyApiAuth, registerAuthBridge } from "./auth-bridge.ts";
import { createAuthClient } from "./auth-client.ts";
import { createTokenStore } from "./auth-token.ts";
import { guardContents, lockDownSession } from "./guards.ts";
import { APP_ORIGIN, contentSecurityPolicy, webPreferences } from "./security.ts";
import { startSentry } from "./sentry.ts";
import { readSettings } from "./settings.ts";

const settings = readSettings(process.env, import.meta.dirname, app.isPackaged);
const appUrl = settings.devServerUrl ?? `${APP_ORIGIN}/index.html`;
const csp = contentSecurityPolicy({ apiUrl: settings.apiUrl, devServerUrl: settings.devServerUrl });

if (settings.userDataDir) app.setPath("userData", settings.userDataDir);
// Sandbox every page, including any created later, not only the main window.
app.enableSandbox();
startSentry(settings.sentryDsn);
registerAppScheme();

app.on("web-contents-created", (_event, contents) => guardContents(contents, appUrl, (url) => shell.openExternal(url)));
app.on("window-all-closed", () => app.quit());

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
  void window.loadURL(appUrl);
}

// Not awaited at the top level: Electron only becomes ready after this file has finished running.
void app.whenReady().then(() => {
  lockDownSession(session.defaultSession, csp, settings.devServerUrl);
  // safeStorage works only once the app is ready.
  const tokens = createTokenStore(safeStorage, join(app.getPath("userData"), "auth-token"));
  registerAuthBridge(createAuthActions(createAuthClient(settings.apiUrl, tokens), tokens), appUrl);
  applyApiAuth(session.defaultSession, settings.apiUrl, tokens);
  if (!settings.devServerUrl) serveScreens(settings.rendererDir, csp);
  openWindow();
});
