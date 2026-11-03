// The desktop app's security rules (AC-F00-24, security rule S17), kept free of Electron imports so
// they can be tested on their own. design.md section 5 lists every setting.

/** The app's own address when it serves the built screens. A fixed origin keeps saved settings. */
export const APP_ORIGIN = "app://meetapp";

/** Locked-down page settings: no Node.js in pages, a separate world for the preload, the sandbox on. */
export function webPreferences(preloadPath: string) {
  return {
    preload: preloadPath,
    contextIsolation: true,
    sandbox: true,
    nodeIntegration: false,
    webSecurity: true,
    webviewTag: false,
  } as const;
}

function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

/** True only for addresses on the app itself (the built screens, or the dev server in development). */
export function isInsideApp(url: string, appUrl: string): boolean {
  if (url.startsWith(`${APP_ORIGIN}/`)) return true;
  const origin = originOf(url);
  return origin !== undefined && origin !== "null" && origin === originOf(appUrl);
}

/** Outside links may open in the user's browser, but only plain https (never file:, javascript: …). */
export function canOpenExternally(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export interface CspOptions {
  /** Where the screens may call the backend, e.g. http://127.0.0.1:3000. */
  apiUrl: string;
  /** The Vite dev server in development; its live-reload connection and inline styles are allowed. */
  devServerUrl?: string | undefined;
  /** The call server (F02): ws:// on this computer in development, wss:// online. */
  callServerUrl?: string | undefined;
  /** KLIPY's API, which the app searches itself (F03, D059). */
  gifApiUrl?: string | undefined;
}

/** The call server's address, plus its http(s) twin, which the call library uses to check the connection. */
function callServerSources(url: string | undefined): string[] {
  const origin = url ? originOf(url.replace(/^ws/, "http")) : undefined;
  if (!origin) return [];
  return [origin.replace(/^http/, "ws"), origin];
}

/** Where KLIPY's GIF pictures come from (F03 design section 7). */
const GIF_IMAGES = "https://static.klipy.com";

/** Development only; must equal DEV_CSP_NONCE in apps/web/vite.config.ts (checked by a test). */
export const DEV_CSP_NONCE = "meetapp-dev";

/**
 * Content Security Policy: only the app's own scripts, styles and fonts; no inline scripts. In development
 * the dev server's own live-reload scripts are allowed through their nonce.
 */
export function contentSecurityPolicy({ apiUrl, devServerUrl, callServerUrl, gifApiUrl }: CspOptions): string {
  const api = originOf(apiUrl) ?? "";
  const dev = devServerUrl ? originOf(devServerUrl) : undefined;
  const connect = [
    "'self'",
    api,
    // F14 D064: the live line to the same backend (ws/wss), and nowhere else.
    ...(api ? [api.replace(/^http/, "ws")] : []),
    ...callServerSources(callServerUrl),
    ...(gifApiUrl ? [originOf(gifApiUrl) ?? ""] : []),
    ...(dev ? [dev.replace(/^http/, "ws")] : []),
  ].join(" ");
  return [
    "default-src 'self'",
    // F15 D073 (owner, 2026-10-27): the background tool's WebAssembly engine, shipped with the app, may be
    // compiled. Scripts still load only from the app itself.
    dev ? `script-src 'self' 'wasm-unsafe-eval' 'nonce-${DEV_CSP_NONCE}'` : "script-src 'self' 'wasm-unsafe-eval'",
    // Development only: Vite injects the page's styles at run time as inline <style> tags.
    dev ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "font-src 'self'",
    // Profile photos come from the backend, with the token main adds (F01, AC-F01-25).
    // Chat GIFs load straight from KLIPY's image server, as KLIPY requires (F03, D059).
    `img-src 'self' data: ${api}${gifApiUrl ? ` ${GIF_IMAGES}` : ""}`,
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/**
 * Backend routes that hand out or replace a session token (F01 design.md section 4). The page may not
 * call them; main calls them itself through `window.meetapp.auth`, so the token never reaches the page.
 * Only `GET /api/v1/auth/providers` (which buttons to show) stays open to the page.
 */
export function isTokenRoute(url: string, apiUrl: string): boolean {
  const api = originOf(apiUrl);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (api === undefined || parsed.origin !== api) return false;
  // Decoded first: the backend treats "/api/v1/me/p%61ssword" as "/api/v1/me/password".
  let path: string;
  try {
    path = decodeURIComponent(parsed.pathname).toLowerCase();
  } catch {
    return true;
  }
  if (path === "/api/v1/auth/providers") return false;
  return path.startsWith("/api/auth/") || path.startsWith("/api/v1/auth/") || path === "/api/v1/me/password";
}

const HAND_OFF_START = /^\/api\/v1\/auth\/desktop\/start$/;
const REQUEST_ID = /^request=[0-9a-f-]{36}$/;

/**
 * Google/Microsoft sign-in opens the backend's start link in the user's browser (F01 design.md section 4).
 * Besides any https link, development also allows exactly that link on this computer (D040 extended);
 * never in the packaged app.
 */
export function canOpenHandOffStart(url: string, packaged: boolean): boolean {
  if (canOpenExternally(url)) return true;
  if (packaged) return false;
  try {
    const { protocol, hostname, pathname, search, hash } = new URL(url);
    const local = protocol === "http:" && (hostname === "127.0.0.1" || hostname === "localhost");
    return local && HAND_OFF_START.test(pathname) && REQUEST_ID.test(search.slice(1)) && hash === "";
  } catch {
    return false;
  }
}

/** F16 (D079): the page the small call windows show, and their own session. */
export const CALL_WINDOW_PAGE = "call-window.html";
export const CALL_WINDOW_PARTITION = "call-windows";

/** The small windows' settings: the main window's, in their own session that refuses every permission. */
export function callWindowPreferences(preloadPath: string) {
  return { ...webPreferences(preloadPath), partition: CALL_WINDOW_PARTITION } as const;
}

/**
 * The small windows' Content Security Policy (F16 design.md, Security): S17 tightened. They reach no
 * address at all; pictures only from the app, data: (photos) and blob: (live video frames). In
 * development the dev server's live-reload script and connection are allowed, as for the main window.
 */
export function callWindowPolicy(devServerUrl?: string): string {
  const dev = devServerUrl ? originOf(devServerUrl) : undefined;
  return [
    "default-src 'self'",
    dev ? `script-src 'self' 'nonce-${DEV_CSP_NONCE}'` : "script-src 'self'",
    dev ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    dev ? `connect-src ${dev.replace(/^http/, "ws")}` : "connect-src 'none'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** The policy for a page address: the small windows' page gets its own. */
export function policyFor(url: string, mainPolicy: string, smallPolicy: string): string {
  try {
    return new URL(url).pathname.endsWith(`/${CALL_WINDOW_PAGE}`) ? smallPolicy : mainPolicy;
  } catch {
    return mainPolicy;
  }
}

/**
 * How each small window is made (F16 design.md 3.3, 3.8): its own page, session and preload; above other
 * apps and full-screen windows on every Space; kept out of screen captures; shown without taking focus.
 */
export function smallWindowSetup(preloadPath: string, size: { width: number; height: number }) {
  return {
    options: {
      ...size,
      show: false,
      frame: false,
      // See-through behind the rounded corners (the page draws the card).
      transparent: true,
      hasShadow: true,
      resizable: false,
      maximizable: false,
      minimizable: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      title: "MeetApp",
      webPreferences: callWindowPreferences(preloadPath),
    },
    alwaysOnTopLevel: "pop-up-menu",
    visibleOnFullScreen: true,
    contentProtection: true,
    showInactive: true,
  } as const;
}

/** The small windows' session serves only their own page and the built files it loads (security review). */
export function smallPageAllows(url: string): boolean {
  try {
    const { pathname } = new URL(url);
    if (pathname === `/${CALL_WINDOW_PAGE}`) return true;
    return pathname.startsWith("/assets/") && !pathname.endsWith(".html") && !pathname.includes("..");
  } catch {
    return false;
  }
}
