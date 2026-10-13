// What our services need from Better Auth, as small functions (F01 T6, T7), so the services don't
// depend on the library: password reset and change, ending sessions, and Google/Microsoft sign-in.
import { APIError } from "better-auth/api";
import type { ProviderAuth } from "../modules/accounts/desktop-sign-in.service.ts";
import type { PasswordAuth } from "../modules/accounts/passwords.service.ts";
import { issueSession, type Auth } from "./auth.ts";
import { AppError } from "./errors.ts";

/** Better Auth's answers to a wrong reset code, as our error codes (the same as sign-up's codes). */
const CODE_ERRORS: Record<string, () => AppError> = {
  INVALID_OTP: () => new AppError(400, "CODE_INVALID", "That code isn't right."),
  TOO_MANY_ATTEMPTS: () => new AppError(400, "CODE_INVALID", "That code isn't right."),
  OTP_EXPIRED: () => new AppError(400, "CODE_EXPIRED", "That code has expired. Ask for a new one."),
};

async function resetWithCode(auth: Auth, email: string, code: string, newPassword: string): Promise<string> {
  try {
    await auth.api.resetPasswordEmailOTP({ body: { email, otp: code, password: newPassword } });
  } catch (error) {
    const known = error instanceof APIError ? CODE_ERRORS[String(error.body?.code)] : undefined;
    throw known ? known() : error;
  }
  const found = await (await auth.$context).internalAdapter.findUserByEmail(email.toLowerCase());
  if (!found) throw new Error("The account disappeared during a password reset");
  return found.user.id;
}

/** Password reset and change for our passwords service, done with Better Auth's own hasher. */
export function passwordAuth(auth: Auth): PasswordAuth {
  const endAllSessions = async (userId: string) => (await auth.$context).internalAdapter.deleteUserSessions(userId);
  return {
    resetWithCode: (email, code, newPassword) => resetWithCode(auth, email, code, newPassword),
    changeWithCurrent: async (userId, currentPassword, newPassword) => {
      const { internalAdapter, password } = await auth.$context;
      const login = await internalAdapter.findCredentialAccount(userId);
      if (!login?.password || !(await password.verify({ hash: login.password, password: currentPassword }))) {
        return false;
      }
      await internalAdapter.updatePassword(userId, await password.hash(newPassword));
      await endAllSessions(userId);
      return true;
    },
    endAllSessions,
    issueSession: (userId) => issueSession(auth, userId),
  };
}

/** Google/Microsoft sign-in for the desktop hand-off: the browser's short session is only a step. */
export function providerAuth(auth: Auth): ProviderAuth {
  const internal = async () => (await auth.$context).internalAdapter;
  return {
    startSignIn: async (provider, returnUrl) => {
      const { headers, response } = await auth.api.signInSocial({
        body: { provider, callbackURL: returnUrl, errorCallbackURL: returnUrl, disableRedirect: true },
        returnHeaders: true,
      });
      if (!response.url) throw new Error("Better Auth gave no provider address");
      return { url: response.url, cookies: headers.getSetCookie() };
    },
    browserUser: async (cookieHeader) => {
      if (cookieHeader === undefined) return undefined;
      const found = await auth.api.getSession({ headers: new Headers({ cookie: cookieHeader }) });
      if (!found) return undefined;
      const { user, session } = found;
      return {
        userId: user.id,
        email: user.email,
        sessionToken: session.token,
        userCreatedAt: user.createdAt.getTime(),
      };
    },
    endBrowserSession: async (sessionToken) => (await internal()).deleteSession(sessionToken),
    deleteUser: async (userId) => (await internal()).deleteUser(userId),
    issueSession: (userId) => issueSession(auth, userId),
  };
}
