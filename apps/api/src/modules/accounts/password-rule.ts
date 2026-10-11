// The one password rule (AC-F01-03, design.md section 3): 10 to 128 characters and not one of the
// 10,000 most common passwords. The list ships with the app and is checked offline, so no outside
// service ever sees a password. Used by sign-up, password change and password reset.
import { dictionary } from "@zxcvbn-ts/language-common";

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

const COMMON = new Set(dictionary["passwords-common"].slice(0, 10_000).map((word) => word.toLowerCase()));
export const COMMON_PASSWORD_COUNT = COMMON.size;

export type PasswordProblem = "TOO_SHORT" | "TOO_LONG" | "TOO_COMMON";

/** Undefined when the password is acceptable; otherwise why it isn't. */
export function checkPassword(password: string): PasswordProblem | undefined {
  if (password.length < MIN_PASSWORD_LENGTH) return "TOO_SHORT";
  if (password.length > MAX_PASSWORD_LENGTH) return "TOO_LONG";
  if (COMMON.has(password.toLowerCase())) return "TOO_COMMON";
  return undefined;
}

/** What the person sees when a password is refused. */
export const PASSWORD_MESSAGES: Record<PasswordProblem, string> = {
  TOO_SHORT: `Use at least ${String(MIN_PASSWORD_LENGTH)} characters.`,
  TOO_LONG: `Use at most ${String(MAX_PASSWORD_LENGTH)} characters.`,
  TOO_COMMON: "This password is too common. Choose another one.",
};
