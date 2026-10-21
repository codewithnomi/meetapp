// Applies the security rules to Electron (AC-F00-24, S17; F02 AC-F02-54, D040 updated): camera,
// microphone and screen capture only for the app's own page, screen sharing only through our picker
// (media-permissions.ts); every other permission and every device request is refused; downloads are
// refused, pages can't leave the app or open windows, and the dev server's pages get the CSP. Electron
// keeps only the last handler set, so this is the one place they are set.
import type { Event, Session, WebContents } from "electron";
import { allowsCheck, allowsRequest, shareAnswer, type SharePicker } from "./media-permissions.ts";
import { isChatFileUrl } from "./chat-desktop.ts";
import { canOpenExternally, isInsideApp } from "./security.ts";

export interface LockDown {
  csp: string;
  devServerUrl: string | undefined;
  /** The app's own page (app://meetapp, or the dev server in development). */
  appUrl: string;
  picker: SharePicker;
  /** The backend: chat files from it may be saved (F03). */
  apiUrl: string;
}

function mediaRules(session: Session, { appUrl, picker }: LockDown): void {
  session.setPermissionRequestHandler((_contents, permission, callback, details) => {
    const mediaTypes = "mediaTypes" in details ? details.mediaTypes : undefined;
    callback(
      allowsRequest({ permission, url: details.requestingUrl, mediaTypes, isMainFrame: details.isMainFrame }, appUrl),
    );
  });
  session.setPermissionCheckHandler((_contents, permission, requestingOrigin, details) =>
    allowsCheck(
      { permission, url: details.requestingUrl ?? requestingOrigin, isMainFrame: details.isMainFrame },
      appUrl,
    ),
  );
  session.setDisplayMediaRequestHandler((request, callback) => {
    const frame = request.frame;
    const fromTopFrame = frame !== null && frame === frame.top;
    callback(shareAnswer(picker, { securityOrigin: request.securityOrigin, fromTopFrame }, appUrl));
  });
}

export function lockDownSession(session: Session, lock: LockDown): void {
  const { csp, devServerUrl } = lock;
  mediaRules(session, lock);
  session.setDevicePermissionHandler(() => false);
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
  // Only chat files from our backend are saved, with a "Save as" dialog; every other download is refused (F03).
  session.on("will-download", (event, item) => {
    if (!isChatFileUrl(item.getURL(), lock.apiUrl)) cancel(event);
  });
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
