// Turns an error code from the backend (or the desktop's main process) into the text key the screen
// shows (F01 design.md section 2): say what went wrong and how to fix it, never a raw code.

type ErrorName =
  | "network"
  | "wrongPassword"
  | "codeInvalid"
  | "codeTooManyTries"
  | "codeExpired"
  | "passwordCommon"
  | "tooManyAttempts"
  | "cancelled"
  | "unverified"
  | "workspaceLimit"
  | "generic";

/** Text key and values for t(): e.g. { key: "auth.errors.tooManyAttempts", values: { minutes: 3 } }. */
export interface ErrorText {
  key: `auth.errors.${ErrorName}`;
  values?: Record<string, number>;
}

const KEYS: Record<string, ErrorName> = {
  NETWORK_ERROR: "network",
  NO_DESKTOP: "network",
  INVALID_EMAIL_OR_PASSWORD: "wrongPassword",
  CODE_INVALID: "codeInvalid",
  INVALID_OTP: "codeInvalid",
  CODE_EXPIRED: "codeExpired",
  OTP_EXPIRED: "codeExpired",
  PASSWORD_WEAK: "passwordCommon",
  SIGN_IN_CANCELLED: "cancelled",
  PROVIDER_EMAIL_UNVERIFIED: "unverified",
  WORKSPACE_LIMIT: "workspaceLimit",
};

/** `retryAfterSeconds` comes with TOO_MANY_ATTEMPTS (our limits, AC-F01-13). */
export function errorText(code: string, retryAfterSeconds?: number): ErrorText {
  if (code === "TOO_MANY_ATTEMPTS") {
    if (retryAfterSeconds === undefined) return { key: "auth.errors.codeTooManyTries" };
    return { key: "auth.errors.tooManyAttempts", values: { minutes: Math.max(1, Math.ceil(retryAfterSeconds / 60)) } };
  }
  return { key: `auth.errors.${KEYS[code] ?? "generic"}` };
}

/** Problems with the connection are shown with a Retry button. */
export const isNetworkError = (code: string) => code === "NETWORK_ERROR" || code === "NO_DESKTOP";
