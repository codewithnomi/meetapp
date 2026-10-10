// Applies the security rules to Electron (AC-F00-24, S17): every permission, device and screen-share
// request is refused (camera and microphone arrive with F02, through an allow-list), downloads are
// refused, pages can't leave the app or open windows, and the dev server's pages get the CSP.
import type { Event, Session, WebContents } from "electron";
import { canOpenExternally, isInsideApp } from "./security.ts";

export function lockDownSession(session: Session, csp: string, devServerUrl: string | undefined): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.setPermissionCheckHandler(() => false);
  session.setDevicePermissionHandler(() => false);
  session.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  const cancel = (event: Event) => event.preventDefault();
  session.on("select-hid-device", (event, _details, callback) => {
    cancel(event);
    callback();
  });
  session.on("select-serial-port", (event, _ports, _contents, callback) => {
    cancel(event);
    callback("");
  });
  session.on("select-usb-device", (event, _details, callback) => {
    cancel(event);
    callback();
  });
  session.on("will-download", cancel);
  // app:// answers carry the CSP themselves (app-protocol.ts); in development the dev server's don't.
  if (devServerUrl) {
    session.webRequest.onHeadersReceived({ urls: [`${devServerUrl}/*`] }, (details, callback) => {
      callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] } });
    });
  }
}

/** Keeps a page inside the app. An https link it tries to open goes to the user's browser instead. */
export function guardContents(
  contents: WebContents,
  appUrl: string,
  openExternal: (url: string) => Promise<void>,
): void {
  const stayInside = (event: { preventDefault: () => void }, url: string) => {
    if (!isInsideApp(url, appUrl)) event.preventDefault();
  };
  contents.on("will-navigate", (event, url) => stayInside(event, url));
  contents.on("will-redirect", (event, url) => stayInside(event, url));
  contents.on("will-frame-navigate", (event) => stayInside(event, event.url));
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.on("select-bluetooth-device", (event, _devices, callback) => {
    event.preventDefault();
    callback("");
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (canOpenExternally(url)) openExternal(url).catch(() => undefined);
    return { action: "deny" };
  });
}
