// The sign-in calls the desktop's main process makes for the screens (F01 design.md section 4,
// AC-F01-34). Routes that hand out a session token are called only from here; the token goes into the
// token store, and the screens get back only `{ ok, user }` or an error code. Free of Electron imports.
import type { TokenStore } from "./auth-token.ts";

/** The signed-in person as GET /api/v1/me describes them (contracts: meResponseSchema). */
type SignedInUser = Record<string, unknown>;

export type AuthResult =
  { ok: true; user: SignedInUser } | { ok: false; code: string; message?: string; retryAfterSeconds?: number };
export type StepResult = { ok: true; signupId?: string } | Extract<AuthResult, { ok: false }>;

export interface SignUpForm {
  email: string;
  name: string;
  password: string;
  termsAccepted: true;
  theme?: string;
  accent?: string;
}

export type PasswordChange = { newPassword: string } & ({ currentPassword: string } | { code: string });

/** Sent as the Origin of every call; the backend only accepts sign-ins from the app's own origin. */
const APP_ORIGIN = "app://meetapp";
const TIME_LIMIT_MS = 10_000;

export interface Answer {
  status: number;
  token: string | null;
  body: Record<string, unknown>;
}

export type Failure = Extract<AuthResult, { ok: false }>;

export function failureOf(answer: Answer): Failure {
  const error = (answer.body["error"] ?? answer.body) as {
    code?: unknown;
    message?: unknown;
    retryAfterSeconds?: unknown;
  };
  return {
    ok: false,
    code: typeof error.code === "string" ? error.code : `HTTP_${String(answer.status)}`,
    ...(typeof error.message === "string" && { message: error.message }),
    ...(typeof error.retryAfterSeconds === "number" && { retryAfterSeconds: error.retryAfterSeconds }),
  };
}

const NETWORK_ERROR: Failure = { ok: false, code: "NETWORK_ERROR" };
const SIGNED_OUT: Failure = { ok: false, code: "SIGNED_OUT" };

interface CallOptions {
  body?: object;
  method?: string;
  token?: string;
}

async function callApi(apiUrl: string, fetchImpl: typeof fetch, path: string, options: CallOptions): Promise<Answer> {
  const headers: Record<string, string> = { origin: APP_ORIGIN };
  if (options.body) headers["content-type"] = "application/json";
  if (options.token) headers["authorization"] = `Bearer ${options.token}`;
  const response = await fetchImpl(`${apiUrl}${path}`, {
    method: options.method ?? "POST",
    headers,
    ...(options.body && { body: JSON.stringify(options.body) }),
    signal: AbortSignal.timeout(TIME_LIMIT_MS),
  });
  const text = await response.text();
  const body = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  return { status: response.status, token: response.headers.get("set-auth-token"), body };
}

export function createAuthClient(apiUrl: string, tokens: TokenStore, fetchImpl: typeof fetch = fetch) {
  const call = (path: string, options: CallOptions = {}) => callApi(apiUrl, fetchImpl, path, options);

  /** Who is signed in; a 401 means the token no longer works, so it is forgotten. */
  async function status(): Promise<AuthResult> {
    const token = tokens.get();
    if (token === undefined) return SIGNED_OUT;
    try {
      const answer = await call("/api/v1/me", { method: "GET", token });
      if (answer.status === 200) return { ok: true, user: answer.body["user"] as SignedInUser };
      if (answer.status === 401) tokens.clear();
      return answer.status === 401 ? SIGNED_OUT : failureOf(answer);
    } catch {
      return NETWORK_ERROR;
    }
  }

  /** A call that ends signed in: keeps the new token, then answers with the user. */
  async function signingIn(path: string, body: object, token?: string): Promise<AuthResult> {
    try {
      const answer = await call(path, { body, ...(token !== undefined && { token }) });
      if (answer.status !== 200 || answer.token === null) return failureOf(answer);
      tokens.set(answer.token);
      return await status();
    } catch {
      return NETWORK_ERROR;
    }
  }

  /** A call that doesn't sign in (codes, the first sign-up step). */
  async function step(path: string, body: object): Promise<StepResult> {
    try {
      const answer = await call(path, { body });
      if (answer.status >= 300) return failureOf(answer);
      const signupId = answer.body["signupId"];
      return typeof signupId === "string" ? { ok: true, signupId } : { ok: true };
    } catch {
      return NETWORK_ERROR;
    }
  }

  return { call, status, signingIn, step };
}

export type AuthClient = ReturnType<typeof createAuthClient>;
