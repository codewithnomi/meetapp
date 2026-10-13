// Google/Microsoft sign-in for the desktop app through the computer's browser (F01 design.md section 4,
// AC-F01-07). The app keeps a secret verifier and sends only its SHA-256; the browser must start within
// 60 s and carries a signed cookie that ties it to the request; the person confirms a 4-digit code; the
// app then collects a new session exactly once. The browser's own session ends as soon as it returns
// from the provider, so it keeps none.
import { createHash, createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { SignInProvider } from "@meetapp/contracts";
import { AppError, tooManyAttempts } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { DesktopSignIn, DesktopSignInStatus, DesktopSignInsRepository } from "./desktop-sign-ins.repository.ts";
import { PROVIDER_EMAIL_UNVERIFIED } from "./provider-profile.ts";

const START_WINDOW_MS = 60 * 1_000;
const LIMIT_MS = 5 * 60 * 1_000;
/**
 * Error codes in the redirect back to us that mean "this email can't be used" (AC-F01-08): ours from
 * the `validateUserInfo` gate, and Better Auth 1.7's `email_not_found` / `account_not_linked`
 * (OAUTH_CALLBACK_ERROR_CODES; "no email" is covered by TC-F01-22 (d)).
 */
const UNVERIFIED_ERRORS = new Set([PROVIDER_EMAIL_UNVERIFIED, "email_not_found", "account_not_linked"]);

/** Who signed in at the provider, as the browser's (short-lived) session shows it. */
interface BrowserUser {
  userId: string;
  email: string;
  sessionToken: string;
  userCreatedAt: number;
}

/** What this service needs from the sign-in library (Better Auth, in plugins/auth-bridges.ts). */
export interface ProviderAuth {
  /** The provider's page to send the browser to, and the cookies that must go with it. */
  startSignIn: (provider: SignInProvider, returnUrl: string) => Promise<{ url: string; cookies: string[] }>;
  /** From the browser's cookie header. */
  browserUser: (cookieHeader: string | undefined) => Promise<BrowserUser | undefined>;
  endBrowserSession: (sessionToken: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
  /** A new session; returns the token the desktop app keeps. */
  issueSession: (userId: string) => Promise<string>;
}

export interface DesktopSignInDependencies {
  repository: DesktopSignInsRepository;
  auth: ProviderAuth;
  enabled: Record<SignInProvider, boolean>;
  /** The backend's address as browsers reach it (APP_PUBLIC_URL). */
  publicUrl: string;
  /** Signs the browser cookie. */
  secret: string;
  workspaces: { ensurePersonalWorkspace: (userId: string) => Promise<void> };
  /** Copies the Google/Microsoft photo once, after the first sign-in (never fails the sign-in). */
  importPhoto?: (userId: string) => Promise<void>;
  limiter?: RateLimiter | undefined;
  now?: () => number;
}

/** What the browser page shows next. */
export type BrowserPage =
  | { page: "confirm"; matchCode: string }
  | { page: "done" }
  | { page: "cancelled"; reason: string }
  | { page: "invalid" };

const sha256 = (value: string) => createHash("sha256").update(value).digest();
const unknownRequest = () => new AppError(404, "NOT_FOUND", "Not found.");
/** Reasons the app is told as they are, with their message; anything else is a plain "cancelled". */
const SHOWN_REASONS = {
  PROVIDER_EMAIL_UNVERIFIED: "Your Google/Microsoft email isn't verified; create an account with your email instead.",
  TOO_MANY_ATTEMPTS: "Too many attempts. Try again later.",
} as const;
const cancelledError = (reason: string) =>
  Object.hasOwn(SHOWN_REASONS, reason)
    ? new AppError(410, reason as keyof typeof SHOWN_REASONS, SHOWN_REASONS[reason as keyof typeof SHOWN_REASONS])
    : new AppError(410, "SIGN_IN_CANCELLED", "Sign-in was cancelled.");

const cancelReason = (error: string | undefined) =>
  error !== undefined && UNVERIFIED_ERRORS.has(error) ? PROVIDER_EMAIL_UNVERIFIED : "SIGN_IN_CANCELLED";

function sameDigest(verifier: string, challenge: string): boolean {
  const expected = Buffer.from(challenge, "hex");
  const given = sha256(verifier);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/** The browser cookie's value: the request id and an HMAC of it, so it can't be made up. */
function binding(secret: string, requestId: string): string {
  return `${requestId}.${createHmac("sha256", secret).update(`desktop-sign-in:${requestId}`).digest("hex")}`;
}

function isBound(secret: string, requestId: string, cookie: string | undefined): boolean {
  if (cookie === undefined) return false;
  const expected = Buffer.from(binding(secret, requestId));
  const given = Buffer.from(cookie);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function createSteps(deps: DesktopSignInDependencies) {
  const now = deps.now ?? (() => Date.now());
  const expired = (record: DesktopSignIn) => now() - record.createdAt > LIMIT_MS;
  /** Ends the attempt and records why (first, so the app hears "cancelled" whatever happens next), then
   * removes an account this sign-in created. */
  const cancel = async (requestId: string, record: DesktopSignIn, reason: string): Promise<BrowserPage> => {
    await deps.repository.save(requestId, { ...record, status: "cancelled", reason });
    if (record.newUser && record.userId !== undefined) await deps.auth.deleteUser(record.userId);
    return { page: "cancelled", reason };
  };
  /** A browser step is valid only for a live request in the expected state, with its cookie. */
  const browserRecord = async (requestId: string, status: DesktopSignInStatus, cookie: string | undefined) => {
    const record = await deps.repository.load(requestId);
    if (!record || record.status !== status || expired(record)) return undefined;
    return isBound(deps.secret, requestId, cookie) ? record : undefined;
  };
  return { now, expired, cancel, browserRecord };
}

async function providerReturned(
  deps: DesktopSignInDependencies,
  steps: ReturnType<typeof createSteps>,
  visit: {
    requestId: string;
    binding: string | undefined;
    cookieHeader: string | undefined;
    error: string | undefined;
  },
): Promise<BrowserPage> {
  const record = await steps.browserRecord(visit.requestId, "started", visit.binding);
  if (!record) return { page: "invalid" };
  const user = await deps.auth.browserUser(visit.cookieHeader);
  if (!user) return steps.cancel(visit.requestId, record, cancelReason(visit.error));
  // The browser keeps no session, whatever happens next (design.md section 4).
  await deps.auth.endBrowserSession(user.sessionToken);
  const returned: DesktopSignIn = {
    ...record,
    status: "returned",
    userId: user.userId,
    email: user.email,
    newUser: user.userCreatedAt >= record.createdAt,
  };
  if (visit.error !== undefined) return steps.cancel(visit.requestId, returned, cancelReason(visit.error));
  // A locked email can't get in through Google/Microsoft either (AC-F01-13).
  if ((await deps.limiter?.blocked(RATE_RULES.wrongPassword, user.email)) !== undefined) {
    return steps.cancel(visit.requestId, returned, "TOO_MANY_ATTEMPTS");
  }
  await deps.repository.save(visit.requestId, returned);
  return { page: "confirm", matchCode: record.matchCode };
}

async function confirmed(
  deps: DesktopSignInDependencies,
  steps: ReturnType<typeof createSteps>,
  visit: { requestId: string; binding: string | undefined; proceed: boolean },
): Promise<BrowserPage> {
  // The signed cookie proves it's the browser that went to the provider; who signed in is on record.
  const record = await steps.browserRecord(visit.requestId, "returned", visit.binding);
  if (!record) return { page: "invalid" };
  if (!visit.proceed) return steps.cancel(visit.requestId, record, "SIGN_IN_CANCELLED");
  await deps.repository.save(visit.requestId, { ...record, status: "ready" });
  return { page: "done" };
}

async function exchange(
  deps: DesktopSignInDependencies,
  steps: ReturnType<typeof createSteps>,
  requestId: string,
  verifier: string,
): Promise<{ userId: string; token: string } | undefined> {
  const record = await deps.repository.load(requestId);
  if (!record) throw unknownRequest();
  if (!sameDigest(verifier, record.challenge)) {
    await deps.repository.remove(requestId);
    throw unknownRequest();
  }
  if (steps.expired(record) || record.status === "cancelled") {
    if (record.status !== "cancelled") await steps.cancel(requestId, record, "SIGN_IN_CANCELLED");
    await deps.repository.remove(requestId);
    throw cancelledError(record.reason ?? "SIGN_IN_CANCELLED");
  }
  if (record.status !== "ready") return undefined;
  const taken = await deps.repository.take(requestId);
  if (taken?.status !== "ready" || taken.userId === undefined) throw unknownRequest();
  await deps.workspaces.ensurePersonalWorkspace(taken.userId);
  const token = await deps.auth.issueSession(taken.userId);
  // In the background on purpose: the photo never delays or fails the sign-in (it handles its own errors).
  if (taken.newUser) void deps.importPhoto?.(taken.userId).catch(() => undefined);
  return { userId: taken.userId, token };
}

export function createDesktopSignInService(deps: DesktopSignInDependencies) {
  const steps = createSteps(deps);
  return {
    /** The app starts: a request id and the code to show (AC-F01-07). `address` is the caller's network address. */
    async init(provider: SignInProvider, challenge: string, address: string) {
      if (!deps.enabled[provider]) throw unknownRequest();
      // 20 starts an hour per network address (design.md section 9).
      const wait = await deps.limiter?.take(RATE_RULES.handOffStarts, address);
      if (wait !== undefined) throw tooManyAttempts(wait);
      const requestId = randomUUID();
      const matchCode = String(randomInt(0, 10_000)).padStart(4, "0");
      await deps.repository.save(requestId, { provider, challenge, matchCode, createdAt: steps.now(), status: "new" });
      return { requestId, matchCode, startUrl: `${deps.publicUrl}/api/v1/auth/desktop/start?request=${requestId}` };
    },

    /** The browser opens the start link: once, within 60 s. Undefined when the link isn't valid. */
    async start(requestId: string) {
      const record = await deps.repository.load(requestId);
      if (record?.status !== "new" || steps.now() - record.createdAt > START_WINDOW_MS) return undefined;
      await deps.repository.save(requestId, { ...record, status: "started" });
      const returnUrl = `${deps.publicUrl}/api/v1/auth/desktop/done?request=${requestId}`;
      const { url, cookies } = await deps.auth.startSignIn(record.provider, returnUrl);
      return { url, cookies, binding: binding(deps.secret, requestId) };
    },

    providerReturned: (visit: Parameters<typeof providerReturned>[2]) => providerReturned(deps, steps, visit),
    confirmed: (visit: Parameters<typeof confirmed>[2]) => confirmed(deps, steps, visit),
    exchange: (requestId: string, verifier: string) => exchange(deps, steps, requestId, verifier),

    /**
     * The app gave up (Cancel or 5 minutes): the request is gone, and so is an account it created.
     * Only with the right verifier, so nobody else can end someone's sign-in.
     */
    async cancel(requestId: string, verifier: string) {
      const record = await deps.repository.load(requestId);
      if (!record || !sameDigest(verifier, record.challenge)) return;
      if (record.status !== "cancelled") await steps.cancel(requestId, record, "SIGN_IN_CANCELLED");
      await deps.repository.remove(requestId);
    },
  };
}

export type DesktopSignInService = ReturnType<typeof createDesktopSignInService>;
