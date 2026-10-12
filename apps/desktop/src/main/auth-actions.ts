// What the screens may ask the main process to do about signing in (F01 design.md section 4): the list
// behind `window.meetapp.auth`. Each answer is `{ ok, user }` (or `{ ok }` for steps that don't sign in)
// or an error code; the token never leaves the main process. Free of Electron imports.
import type { AuthClient, AuthResult, PasswordChange, SignUpForm, StepResult } from "./auth-client.ts";
import type { TokenStore } from "./auth-token.ts";

/** The one channel the preload uses; the action name and its arguments travel with it. */
export const AUTH_CHANNEL = "meetapp:auth";

const SIGNED_OUT = { ok: false, code: "SIGNED_OUT" } as const;

export function createAuthActions(client: AuthClient, tokens: TokenStore) {
  return {
    signInWithPassword: (email: string, password: string): Promise<AuthResult> =>
      client.signingIn("/api/auth/sign-in/email", { email, password }),
    requestCode: (email: string, purpose: "sign-in" | "reset"): Promise<StepResult> =>
      purpose === "reset"
        ? client.step("/api/auth/email-otp/request-password-reset", { email })
        : client.step("/api/auth/email-otp/send-verification-otp", { email, type: "sign-in" }),
    signInWithCode: (email: string, code: string): Promise<AuthResult> =>
      client.signingIn("/api/auth/sign-in/email-otp", { email, otp: code }),
    startSignUp: (form: SignUpForm): Promise<StepResult> => client.step("/api/v1/auth/sign-up", form),
    resendSignUpCode: (signupId: string): Promise<StepResult> =>
      client.step("/api/v1/auth/sign-up/resend", { signupId }),
    finishSignUp: (signupId: string, code: string): Promise<AuthResult> =>
      client.signingIn("/api/v1/auth/sign-up/verify", { signupId, code }),
    resetPassword: (email: string, code: string, newPassword: string): Promise<AuthResult> =>
      client.signingIn("/api/v1/auth/reset-password", { email, code, newPassword }),
    /** The backend signs out every other device and gives this one a new token (AC-F01-10). */
    changePassword: async (change: PasswordChange): Promise<AuthResult> => {
      const token = tokens.get();
      return token === undefined ? SIGNED_OUT : client.signingIn("/api/v1/me/password", change, token);
    },
    /** Signs this computer out at once; telling the backend is best effort (AC-F01-12). */
    signOut: async (): Promise<{ ok: true }> => {
      const token = tokens.get();
      tokens.clear();
      if (token !== undefined) await client.call("/api/auth/sign-out", { body: {}, token }).catch(() => undefined);
      return { ok: true };
    },
    /** This computer is signed out whatever happens; the answer says whether the others were too. */
    signOutEverywhere: async (): Promise<{ ok: true } | { ok: false; code: string }> => {
      const token = tokens.get();
      tokens.clear();
      if (token === undefined) return { ok: true };
      const answer = await client.call("/api/v1/auth/sign-out-everywhere", { body: {}, token }).catch(() => undefined);
      return answer?.status === 204
        ? { ok: true }
        : { ok: false, code: answer ? `HTTP_${String(answer.status)}` : "NETWORK_ERROR" };
    },
    status: (): Promise<AuthResult> => client.status(),
  };
}

export type AuthActions = ReturnType<typeof createAuthActions>;
export type AuthActionName = keyof AuthActions;
export const AUTH_ACTION_NAMES = [
  "signInWithPassword",
  "requestCode",
  "signInWithCode",
  "startSignUp",
  "resendSignUpCode",
  "finishSignUp",
  "resetPassword",
  "changePassword",
  "signOut",
  "signOutEverywhere",
  "status",
] as const satisfies readonly AuthActionName[];

const MAX_TEXT = 1_000;
const isText = (value: unknown) => typeof value === "string" && value.length <= MAX_TEXT;
const isField = (value: unknown) => isText(value) || typeof value === "boolean";

/**
 * Input from the page is untrusted: only known action names, at most 3 arguments, each a short text or a
 * flat object of short texts and true/false. The backend checks the meaning; this keeps junk out of main.
 */
export function isValidCall(name: unknown, args: unknown): name is AuthActionName {
  if (!(AUTH_ACTION_NAMES as readonly unknown[]).includes(name) || !Array.isArray(args) || args.length > 3)
    return false;
  return args.every(
    (arg) =>
      isText(arg) ||
      (typeof arg === "object" &&
        arg !== null &&
        Object.getPrototypeOf(arg) === Object.prototype &&
        Object.keys(arg).length <= 10 &&
        Object.values(arg).every(isField)),
  );
}
