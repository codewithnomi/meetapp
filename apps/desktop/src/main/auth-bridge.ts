// Electron wiring for signing in (F01 design.md section 4, AC-F01-34). Thin on purpose; the rules live
// in auth-actions.ts and security.ts. The screens ask through `window.meetapp.auth` (the preload); main
// answers only its own window's top page, keeps the token, adds it to the screens' requests to the
// backend, and cancels any page request to a route that hands out a token.
import type { IpcMainInvokeEvent, Session } from "electron";
import { ipcMain } from "electron";
import { AUTH_CHANNEL, isValidCall, type AuthActions } from "./auth-actions.ts";
import type { TokenStore } from "./auth-token.ts";
import { isInsideApp, isTokenRoute } from "./security.ts";

/** Only the app's own page, in the window's top frame: never an embedded frame or another site. */
export function fromAppPage(event: IpcMainInvokeEvent, appUrl: string): boolean {
  const frame = event.senderFrame;
  return frame !== null && frame === event.sender.mainFrame && isInsideApp(frame.url, appUrl);
}

export function registerAuthBridge(actions: AuthActions, appUrl: string): void {
  ipcMain.handle(AUTH_CHANNEL, async (event, name: unknown, args: unknown) => {
    if (!fromAppPage(event, appUrl)) throw new Error("Refused: not the app's own page");
    if (!isValidCall(name, args)) return { ok: false, code: "BAD_REQUEST" };
    const action = actions[name] as (...values: unknown[]) => Promise<unknown>;
    return action(...(args as unknown[]));
  });
}

/** The screens' requests to the backend carry the token (data and photos); token routes are cancelled. */
export function applyApiAuth(session: Session, apiUrl: string, tokens: TokenStore): void {
  const urls = [`${new URL(apiUrl).origin}/*`];
  session.webRequest.onBeforeRequest({ urls }, (details, callback) => {
    callback({ cancel: isTokenRoute(details.url, apiUrl) });
  });
  session.webRequest.onBeforeSendHeaders({ urls }, (details, callback) => {
    const token = tokens.get();
    const requestHeaders = { ...details.requestHeaders };
    delete requestHeaders["Authorization"];
    delete requestHeaders["authorization"];
    if (token !== undefined) requestHeaders["Authorization"] = `Bearer ${token}`;
    callback({ requestHeaders });
  });
}
