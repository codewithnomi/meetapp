// The sign-in calls the desktop's main process makes for the screens (F01 design.md section 4): the
// screens never see the session token, only the signed-in person or an error code. Outside the desktop
// app (e.g. the screens opened in a plain browser) every call answers NO_DESKTOP.
import type { MeResponse } from "@meetapp/contracts";

export type SignedInUser = MeResponse["user"];
export type AuthFailure = { ok: false; code: string; message?: string; retryAfterSeconds?: number };
export type AuthResult = { ok: true; user: SignedInUser } | AuthFailure;
export type StepResult = { ok: true; signupId?: string } | AuthFailure;

export interface SignUpForm {
  email: string;
  name: string;
  password: string;
  termsAccepted: true;
  theme?: string;
  accent?: string;
}

type PasswordChange = { newPassword: string } & ({ currentPassword: string } | { code: string });

/** `window.meetapp.auth` as the preload exposes it (apps/desktop/src/preload/preload.ts). */
export interface AuthBridge {
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>;
  requestCode: (email: string, purpose: "sign-in" | "reset") => Promise<StepResult>;
  signInWithCode: (email: string, code: string) => Promise<AuthResult>;
  startSignUp: (form: SignUpForm) => Promise<StepResult>;
  resendSignUpCode: (signupId: string) => Promise<StepResult>;
  finishSignUp: (signupId: string, code: string) => Promise<AuthResult>;
  resetPassword: (email: string, code: string, newPassword: string) => Promise<AuthResult>;
  changePassword: (change: PasswordChange) => Promise<AuthResult>;
  signOut: () => Promise<{ ok: true }>;
  signOutEverywhere: () => Promise<{ ok: true } | AuthFailure>;
  status: () => Promise<AuthResult>;
}

const unavailable = async (): Promise<AuthFailure> => ({ ok: false, code: "NO_DESKTOP" });

const NO_DESKTOP: AuthBridge = {
  signInWithPassword: unavailable,
  requestCode: unavailable,
  signInWithCode: unavailable,
  startSignUp: unavailable,
  resendSignUpCode: unavailable,
  finishSignUp: unavailable,
  resetPassword: unavailable,
  changePassword: unavailable,
  signOut: async () => ({ ok: true }),
  signOutEverywhere: unavailable,
  status: unavailable,
};

export function authBridge(): AuthBridge {
  return (window as { meetapp?: { auth?: AuthBridge } }).meetapp?.auth ?? NO_DESKTOP;
}
