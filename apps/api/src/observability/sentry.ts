// Crash reporting with Sentry, only when SENTRY_DSN is set (AC-F00-22). Reports never carry personal
// data: no request bodies, cookies, headers or user details (security rule S10).
import type { ErrorEvent, NodeOptions } from "@sentry/node";

/** Removes everything that could identify a person or leak a secret before an event leaves the machine. */
export function stripPersonalData(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.data;
    delete event.request.cookies;
    delete event.request.headers;
    delete event.request.query_string;
  }
  delete event.user;
  return event;
}

/**
 * Sentry 11 collects user info, cookies, headers, bodies and more by default. Every category is switched
 * off here; stripPersonalData in beforeSend is a second safety net.
 */
export const NO_PERSONAL_DATA: NonNullable<NodeOptions["dataCollection"]> = {
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
};

export function sentryOptions(dsn: string): NodeOptions {
  return {
    dsn,
    dataCollection: NO_PERSONAL_DATA,
    environment: process.env["NODE_ENV"] ?? "development",
    beforeSend: stripPersonalData,
  };
}
