// The Mac notification helper for monitoring alerts (AC-F00-44, design.md section 3).
// Gatus (POST /gatus) and Grafana (POST /grafana) send their "down"/"recovered" alerts here, and each
// one becomes a macOS notification. `pnpm monitoring` (tools/monitoring.ts) starts it on
// 127.0.0.1:NOTIFIER_PORT. Only small, well-formed JSON bodies are accepted.
import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";

export interface Notification {
  title: string;
  message: string;
}

export interface NotifierOptions {
  notify: (notification: Notification) => void | Promise<void>;
}

const MAX_BODY_BYTES = 16 * 1024;
const MAX_NAME_LENGTH = 100;
const TITLE = "MeetApp alert";

class HttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(String(status));
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function name(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") throw new HttpError(400);
  return value.slice(0, MAX_NAME_LENGTH);
}

/** Gatus: {"service": "Cache", "status": "TRIGGERED" | "RESOLVED"} (infra/monitoring/gatus/config.yaml). */
function fromGatus(body: unknown): Notification[] {
  if (!isRecord(body)) throw new HttpError(400);
  const service = name(body["service"]);
  if (body["status"] === "TRIGGERED") return [{ title: TITLE, message: `${service} is down` }];
  if (body["status"] === "RESOLVED") return [{ title: TITLE, message: `${service} recovered` }];
  throw new HttpError(400);
}

/** Grafana webhook: {"alerts": [{"status": "firing" | "resolved", "labels": {"alertname": "…"}}]}. */
function fromGrafana(body: unknown): Notification[] {
  const alerts = isRecord(body) ? body["alerts"] : undefined;
  if (!Array.isArray(alerts) || alerts.length === 0) throw new HttpError(400);
  return alerts.map((alert: unknown) => {
    if (!isRecord(alert) || !isRecord(alert["labels"])) throw new HttpError(400);
    const alertName = name(alert["labels"]["alertname"]);
    if (alert["status"] === "firing") return { title: TITLE, message: `${alertName} is firing` };
    if (alert["status"] === "resolved") return { title: TITLE, message: `${alertName} resolved` };
    throw new HttpError(400);
  });
}

const ROUTES: Record<string, (body: unknown) => Notification[]> = { "/gatus": fromGatus, "/grafana": fromGrafana };

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413);
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400);
  }
}

async function handle(request: IncomingMessage, options: NotifierOptions): Promise<number> {
  const parse = ROUTES[new URL(request.url ?? "/", "http://127.0.0.1").pathname];
  if (!parse) return 404;
  if (request.method !== "POST") return 405;
  const notifications = parse(await readJson(request));
  for (const notification of notifications) await options.notify(notification);
  return 204;
}

function reply(response: ServerResponse, status: number): void {
  // Stop reading an oversized body so the client gets its answer straight away.
  if (status === 413) response.setHeader("Connection", "close");
  response.writeHead(status).end();
}

/** A server (not yet listening) that turns alert calls into notifications. */
export function createNotifier(options: NotifierOptions): Server {
  return createServer((request, response) => {
    handle(request, options).then(
      (status) => reply(response, status),
      (error: unknown) => reply(response, error instanceof HttpError ? error.status : 500),
    );
  });
}

/** The osascript call that shows a notification. The text goes in as arguments, never into the script. */
export function macNotificationCommand(notification: Notification): { command: "osascript"; args: string[] } {
  return {
    command: "osascript",
    args: [
      "-e",
      "on run argv",
      "-e",
      "display notification (item 2 of argv) with title (item 1 of argv)",
      "-e",
      "end run",
      notification.title,
      notification.message,
    ],
  };
}

/** Shows a macOS notification (macOS asks once to allow notifications for the terminal app). */
export function showMacNotification(notification: Notification): void {
  const { command, args } = macNotificationCommand(notification);
  spawn(command, args, { stdio: "ignore" }).on("error", () => undefined);
}
