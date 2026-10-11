// Crash reports from the desktop app, only when SENTRY_DSN is set (AC-F00-22). They never carry
// personal data (S10, D036, D040):
// - every Sentry data category is off, and beforeSend removes request details and the user;
// - addresses in reports are cut down to their origin (a path could hold a meeting code);
// - console messages are not collected (they could hold meeting text);
// - native crash dumps (raw memory) are off;
// - the pages get no Sentry bridge: no extra preload and no sentry-ipc:// scheme.
import { IPCMode, init, type ElectronMainOptions } from "@sentry/electron/main";

type SentryEvent = Parameters<NonNullable<ElectronMainOptions["beforeSend"]>>[0];
type Breadcrumb = Parameters<NonNullable<ElectronMainOptions["beforeBreadcrumb"]>>[0];

/** Integrations that would widen the pages' access or send raw memory. */
const UNWANTED_INTEGRATIONS = new Set(["PreloadInjection", "SentryMinidump", "ElectronMinidump"]);

/** "https://host/path?q" → "https://host"; anything unreadable is dropped. */
function originOnly(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined;
  try {
    const { origin } = new URL(url);
    return origin === "null" ? undefined : origin;
  } catch {
    return undefined;
  }
}

export function withoutPersonalData(event: SentryEvent): SentryEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
    const url = originOnly(event.request.url);
    if (url) event.request.url = url;
    else delete event.request.url;
  }
  delete event.user;
  return event;
}

export function safeBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category === "console") return null;
  if (breadcrumb.data && "url" in breadcrumb.data) {
    breadcrumb.data = { ...breadcrumb.data, url: originOnly(breadcrumb.data["url"]) };
  }
  return breadcrumb;
}

export function desktopSentryOptions(dsn: string): ElectronMainOptions {
  return {
    dsn,
    ipcMode: IPCMode.Classic,
    integrations: (defaults) => defaults.filter((integration) => !UNWANTED_INTEGRATIONS.has(integration.name)),
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
    },
    beforeSend: withoutPersonalData,
    beforeBreadcrumb: safeBreadcrumb,
  };
}

/** Starts Sentry only when a DSN is set. Must run before the app is ready (it registers its own scheme). */
export function startSentry(dsn: string | undefined, start: typeof init = init): boolean {
  if (!dsn) return false;
  start(desktopSentryOptions(dsn));
  return true;
}
