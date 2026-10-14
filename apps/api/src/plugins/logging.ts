// Logger settings: JSON logs with the requestId; secrets and personal data never reach the logs
// (AC-F00-20, security rule S10). Request bodies are never logged.
import { pino, type LoggerOptions } from "pino";

// "code" is not here on purpose: error codes must stay readable; email codes only travel in request
// bodies, which are never logged.
const SECRET_FIELDS = [
  "password",
  "newPassword",
  "currentPassword",
  "otp",
  "verifier",
  "token",
  "secret",
  "authorization",
  "cookie",
  "email",
  // F02: meeting passcodes, meeting tickets, call-server passes, lookup tokens, links and guest device keys.
  "passcode",
  "ticket",
  "pass",
  "lookupToken",
  "link",
  "deviceKey",
];
const NAME_FIELDS = ["name", "firstName", "lastName", "displayName", "guestName"];
const SENSITIVE = [...SECRET_FIELDS, ...NAME_FIELDS];

/** Fields removed wherever they appear (top level and up to two levels deep), plus request bodies. */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["set-cookie"]',
  'req.headers["x-meeting-ticket"]',
  'res.headers["set-auth-token"]',
  "req.body",
  "body",
  ...SENSITIVE.flatMap((field) => [field, `*.${field}`, `*.*.${field}`]),
];

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
/** Signed passes (JWTs) such as the call server's: three base64url parts, the first starting "eyJ". */
const JWT = /\beyJ[\w-]+\.[\w-]+\.[\w-]+/g;
/** A meeting link's secret part quoted inside text (e.g. "…/m/AbC…"). */
const MEETING_LINK_PART = /(\/m\/)[\w-]{10,}/g;
const SECRET_ASSIGNMENT =
  /\b(password|passwd|pwd|secret|token|api[_-]?key|authorization)("?\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi;

/** Address parts (?name=value) whose value is a secret: reset, sign-in and API links (security review, F00). */
export const SENSITIVE_QUERY_PARAMS = [
  "token",
  "code",
  "state",
  "access_token",
  "refresh_token",
  "id_token",
  "password",
  "secret",
  "key",
  "api_key",
  "email",
  // The desktop sign-in's request id (desktop/start and desktop/done, F01): with it a browser could
  // finish someone else's sign-in, so it is treated like a secret.
  "request",
];

const SENSITIVE_NAMES = new Set(SENSITIVE_QUERY_PARAMS);

/** A name with a broken %-code (e.g. "?%") is compared as written, so logging never throws. */
function readableName(name: string): string {
  try {
    return decodeURIComponent(name).toLowerCase();
  } catch {
    return name.toLowerCase();
  }
}

/** Addresses whose last part is itself a secret: invitation and join links (F01), meeting links (F02). */
const SECRET_PATHS = /^((?:https?:\/\/[^/]+)?\/(?:invite|join|m)\/)[^/?#]+/;

/** "/invite/abc?x=1" → "/invite/REDACTED?x=1", also with the site in front; other addresses are unchanged. */
export function redactPath(url: string): string {
  return url.replace(SECRET_PATHS, "$1REDACTED");
}

/** Both: secret path parts and secret query values. Used for logs and traces. */
export function redactUrl(url: string): string {
  return redactQuery(redactPath(url));
}

/** "/reset?token=abc&lang=en" → "/reset?token=REDACTED&lang=en" (names compared without regard to case). */
export function redactQuery(url: string): string {
  const start = url.indexOf("?");
  if (start === -1) return url;
  const parts = url
    .slice(start + 1)
    .split("&")
    .map((part) => {
      const name = part.split("=")[0] ?? "";
      return SENSITIVE_NAMES.has(readableName(name)) ? `${name}=REDACTED` : part;
    });
  return `${url.slice(0, start)}?${parts.join("&")}`;
}

interface LoggedRequest {
  method: string;
  url: string;
  host?: string;
  ip?: string;
  socket?: { remotePort?: number };
}

/** The request as logged: like Fastify's own, but with secrets in the address hidden. */
function serializeRequest(request: LoggedRequest): Record<string, unknown> {
  return {
    method: request.method,
    url: redactUrl(request.url),
    host: request.host,
    remoteAddress: request.ip,
    remotePort: request.socket?.remotePort,
  };
}

/** Hides email addresses, signed passes and "password=…"-style values inside free text such as error messages. */
export function maskSensitiveText(text: string): string {
  return text
    .replace(EMAIL, "[email]")
    .replace(JWT, "[pass]")
    .replace(MEETING_LINK_PART, "$1REDACTED")
    .replace(SECRET_ASSIGNMENT, "$1$2[redacted]");
}

/** Error serializer: keeps type and code; message and stack are masked (database errors can quote data). */
function serializeError(error: unknown): Record<string, unknown> {
  const serialized = pino.stdSerializers.err(error as Error);
  return {
    type: serialized.type,
    code: (error as { code?: unknown }).code,
    message: maskSensitiveText(serialized.message),
    stack: maskSensitiveText(serialized.stack),
  };
}

export function loggerOptions(level: string): LoggerOptions {
  return {
    level,
    redact: { paths: REDACT_PATHS, censor: "[redacted]" },
    serializers: { err: serializeError, error: serializeError, req: serializeRequest },
  };
}
