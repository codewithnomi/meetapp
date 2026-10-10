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
}

/** Development only; must equal DEV_CSP_NONCE in apps/web/vite.config.ts (checked by a test). */
export const DEV_CSP_NONCE = "meetapp-dev";

/**
 * Content Security Policy: only the app's own scripts, styles and fonts; no inline scripts. In development
 * the dev server's own live-reload scripts are allowed through their nonce.
 */
export function contentSecurityPolicy({ apiUrl, devServerUrl }: CspOptions): string {
  const api = originOf(apiUrl) ?? "";
  const dev = devServerUrl ? originOf(devServerUrl) : undefined;
  const connect = dev ? `'self' ${api} ${dev.replace(/^http/, "ws")}` : `'self' ${api}`;
  return [
    "default-src 'self'",
    dev ? `script-src 'self' 'nonce-${DEV_CSP_NONCE}'` : "script-src 'self'",
    // Development only: Vite injects the page's styles at run time as inline <style> tags.
    dev ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}
