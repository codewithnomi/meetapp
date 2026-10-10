// Logger settings: JSON logs with the requestId; secrets and personal data never reach the logs
// (AC-F00-20, security rule S10). Request bodies are never logged.
import { pino, type LoggerOptions } from "pino";

const SECRET_FIELDS = ["password", "token", "secret", "authorization", "cookie", "email"];
const NAME_FIELDS = ["name", "firstName", "lastName", "displayName"];
const SENSITIVE = [...SECRET_FIELDS, ...NAME_FIELDS];

/** Fields removed wherever they appear (top level and up to two levels deep), plus request bodies. */
const REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  'req.headers["set-cookie"]',
  "req.body",
  "body",
  ...SENSITIVE.flatMap((field) => [field, `*.${field}`, `*.*.${field}`]),
];

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const SECRET_ASSIGNMENT =
  /\b(password|passwd|pwd|secret|token|api[_-]?key|authorization)(\s*[=:]\s*)("[^"]*"|'[^']*'|\S+)/gi;

/** Hides email addresses and "password=…"-style values inside free text such as error messages. */
export function maskSensitiveText(text: string): string {
  return text.replace(EMAIL, "[email]").replace(SECRET_ASSIGNMENT, "$1$2[redacted]");
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
    serializers: { err: serializeError, error: serializeError },
  };
}
