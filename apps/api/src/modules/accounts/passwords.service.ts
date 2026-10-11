// Passwords and signing out everywhere (F01 design.md sections 3 and 4, AC-F01-09, 10, 12). A reset or a
// change ends every session of the user and starts a new one for this computer; a wrong current password
// answers 400 PASSWORD_WRONG (never 401, so the app doesn't sign out) and counts toward the
// wrong-password limit (AC-F01-13).
import { AppError, tooManyAttempts } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import { PASSWORD_MESSAGES, checkPassword } from "./password-rule.ts";

/** What this service needs from the sign-in library (Better Auth, in plugins/auth.ts). */
export interface PasswordAuth {
  /** Checks a reset code and sets the password; every session of the user ends. Returns the user's id. */
  resetWithCode: (email: string, code: string, newPassword: string) => Promise<string>;
  /** False when the current password is wrong (or the account has none); otherwise every session ends. */
  changeWithCurrent: (userId: string, currentPassword: string, newPassword: string) => Promise<boolean>;
  endAllSessions: (userId: string) => Promise<void>;
  /** A new session; returns the token the desktop app keeps. */
  issueSession: (userId: string) => Promise<string>;
}

export interface PasswordsDependencies {
  auth: PasswordAuth;
  limiter?: RateLimiter | undefined;
}

/** Exactly one of `currentPassword` or `code` (the request schema checks it). */
export interface PasswordChange {
  newPassword: string;
  currentPassword?: string | undefined;
  code?: string | undefined;
}

function assertStrong(password: string): void {
  const problem = checkPassword(password);
  if (problem) throw new AppError(400, "PASSWORD_WEAK", PASSWORD_MESSAGES[problem]);
}

async function changeWithCurrent(
  { auth, limiter }: PasswordsDependencies,
  user: { id: string; email: string },
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const wait = await limiter?.blocked(RATE_RULES.wrongPassword, user.email);
  if (wait !== undefined) throw tooManyAttempts(wait);
  if (await auth.changeWithCurrent(user.id, currentPassword, newPassword)) return;
  await limiter?.hit(RATE_RULES.wrongPassword, user.email);
  throw new AppError(400, "PASSWORD_WRONG", "That isn't your current password.");
}

export function createPasswordsService(deps: PasswordsDependencies) {
  const { auth } = deps;
  return {
    /** Forgot password: the emailed code and a new password; signs in on this computer (AC-F01-09). */
    async reset(email: string, code: string, newPassword: string): Promise<{ userId: string; token: string }> {
      assertStrong(newPassword);
      const userId = await auth.resetWithCode(email, code, newPassword);
      return { userId, token: await auth.issueSession(userId) };
    },

    /** Change password while signed in, with the current one or an emailed code (AC-F01-10). */
    async change(user: { id: string; email: string }, change: PasswordChange): Promise<string> {
      assertStrong(change.newPassword);
      if (change.code !== undefined) await auth.resetWithCode(user.email, change.code, change.newPassword);
      else await changeWithCurrent(deps, user, change.currentPassword ?? "", change.newPassword);
      return auth.issueSession(user.id);
    },

    /** Ends every session of the user, this one included (AC-F01-12). */
    signOutEverywhere: (userId: string) => auth.endAllSessions(userId),
  };
}

export type PasswordsService = ReturnType<typeof createPasswordsService>;
