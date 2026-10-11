// The desktop app's settings, read once at start. Development and tests set them; the packaged app
// (F04) ignores the development-only ones, so nothing outside the app can point its window elsewhere.
import { resolve } from "node:path";

export interface DesktopSettings {
  /** The Vite dev server (development only). Unset: serve the built screens from app://meetapp. */
  devServerUrl: string | undefined;
  apiUrl: string;
  /** The built screens (apps/web/dist). */
  rendererDir: string;
  preloadPath: string;
  /** Tests start each run with a fresh profile folder; ignored in the packaged app. */
  userDataDir: string | undefined;
  sentryDsn: string | undefined;
}

const DEFAULT_API_URL = "http://127.0.0.1:3000";

function filled(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" ? undefined : value.trim();
}

/** Only a server on this computer (http://127.0.0.1:<port> or http://localhost:<port>). */
function isLocalHttp(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === "http:" && (hostname === "127.0.0.1" || hostname === "localhost");
  } catch {
    return false;
  }
}

/** The backend must be on this computer or use https. */
function safeApiUrl(value: string | undefined): string {
  if (!value) return DEFAULT_API_URL;
  if (isLocalHttp(value)) return value;
  try {
    return new URL(value).protocol === "https:" ? value : DEFAULT_API_URL;
  } catch {
    return DEFAULT_API_URL;
  }
}

export function readSettings(env: NodeJS.ProcessEnv, mainDir: string, packaged = false): DesktopSettings {
  const devServerUrl = filled(env["MEETAPP_RENDERER_URL"]);
  return {
    devServerUrl: !packaged && devServerUrl && isLocalHttp(devServerUrl) ? devServerUrl : undefined,
    apiUrl: packaged ? DEFAULT_API_URL : safeApiUrl(filled(env["VITE_API_URL"])),
    rendererDir: resolve(mainDir, "../../../web/dist"),
    preloadPath: resolve(mainDir, "../preload/preload.cjs"),
    userDataDir: packaged ? undefined : filled(env["MEETAPP_USER_DATA_DIR"]),
    sentryDsn: filled(env["SENTRY_DSN"]),
  };
}
