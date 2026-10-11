// Sign-in with Better Auth (F01 design.md section 3, D048): identity only. It handles password
// sign-in (scrypt), email codes, sessions (30 days, extended by use) and signing out everywhere.
// Only the routes in AUTH_ROUTE_ALLOW_LIST are reachable; everything else Better Auth offers answers
// 404, so its own sign-up, profile and organization routes can't be used to get around our rules.
import { account, session, user, verification, type Database } from "@meetapp/db";
import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { fromNodeHeaders } from "better-auth/node";
import { bearer, emailOTP } from "better-auth/plugins";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "../config/config.ts";
import type { Outbox } from "../emails/outbox.ts";
import { tooManyAttempts } from "./errors.ts";
import { RATE_RULES, type RateLimiter } from "./rate-limit.ts";
import type { SessionReader } from "./session.ts";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_MESSAGES,
  checkPassword,
} from "../modules/accounts/password-rule.ts";
import { hashSessionTokens } from "./auth-adapter.ts";

const DAY_SECONDS = 24 * 60 * 60;
const CODE_MINUTES = 15;

/** The Better Auth routes the app may use (design.md section 3); all others answer 404. */
const AUTH_ROUTE_ALLOW_LIST = [
  "/sign-in/email",
  "/sign-in/email-otp",
  "/email-otp/send-verification-otp",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
  "/sign-in/social",
  "/sign-out",
  "/revoke-sessions",
] as const;
/** Google/Microsoft send people back here (/callback/google, /callback/microsoft). */
const CALLBACK_PREFIX = "/callback/";
const AUTH_BASE_PATH = "/api/auth";

/** Routes whose body carries a new password: checked against our password rule first. */
const NEW_PASSWORD_ROUTES = new Set(["/email-otp/reset-password"]);

function isAllowedAuthPath(path: string): boolean {
  return (
    (AUTH_ROUTE_ALLOW_LIST as readonly string[]).includes(path) ||
    (path.startsWith(CALLBACK_PREFIX) && /^[a-z]+$/.test(path.slice(CALLBACK_PREFIX.length)))
  );
}

export interface AuthDependencies {
  config: Config;
  db: Database;
  outbox: Outbox;
  log: FastifyBaseLogger;
  /** Origins allowed to call sign-in (the app's own pages). */
  trustedOrigins: string[];
}

/** Our own fields on Better Auth's user; none can be set through Better Auth's routes (input: false). */
const USER_FIELDS = {
  termsVersion: { type: "string", required: false, input: false },
  termsAcceptedAt: { type: "date", required: false, input: false },
  ageConfirmedAt: { type: "date", required: false, input: false },
  theme: { type: "string", required: false, input: false },
  accent: { type: "string", required: false, input: false },
  lastWorkspaceId: { type: "string", required: false, input: false },
  avatarKey: { type: "string", required: false, input: false },
} as const;

/** Refuses a weak new password (AC-F01-03) before Better Auth handles the request. */
const passwordRuleHook = createAuthMiddleware(async (context) => {
  if (!NEW_PASSWORD_ROUTES.has(context.path)) return;
  const body = context.body as { password?: unknown } | undefined;
  const problem = typeof body?.password === "string" ? checkPassword(body.password) : "TOO_SHORT";
  if (problem) throw new APIError("BAD_REQUEST", { code: "PASSWORD_WEAK", message: PASSWORD_MESSAGES[problem] });
});

/** 6-digit email codes (D047): 15 minutes, 5 tries, stored hashed, never creating accounts. */
function emailCodes(outbox: Outbox, log: FastifyBaseLogger) {
  return emailOTP({
    otpLength: 6,
    expiresIn: CODE_MINUTES * 60,
    allowedAttempts: 5,
    storeOTP: "hashed",
    disableSignUp: true,
    overrideDefaultEmailVerification: true,
    sendVerificationOTP: async ({ email, otp, type }) => {
      const purpose = type === "forget-password" ? "reset" : type === "sign-in" ? "sign-in" : "sign-up";
      // Only queued, never awaited for delivery, so timing doesn't reveal whether an account exists.
      void outbox.enqueue({ to: email, template: { kind: "code", purpose, code: otp } }).catch((error: unknown) => {
        log.error({ err: error }, "could not queue a code email");
      });
    },
  });
}

/**
 * Lets our own code start a session for a user it has just created (sign-up with a code, T5), so the
 * desktop gets the same signed token as after any sign-in. Server-side only: the path is not in the
 * allow-list, so it can't be called over HTTP.
 */
const sessionIssuer = {
  id: "meetapp-session-issuer",
  endpoints: {
    issueSession: createAuthEndpoint(
      "/meetapp/issue-session",
      { method: "POST", body: z.object({ userId: z.string() }) },
      async (context) => {
        const found = await context.context.internalAdapter.findUserById(context.body.userId);
        if (!found) throw new APIError("NOT_FOUND");
        const created = await context.context.internalAdapter.createSession(found.id);
        await setSessionCookie(context, { session: created, user: found });
        return context.json({ ok: true });
      },
    ),
  },
} satisfies BetterAuthPlugin;

/** Better Auth's own messages carry no secrets; they go to our logs without their arguments. */
function authLogger(log: FastifyBaseLogger) {
  return {
    log: (level: "info" | "warn" | "error" | "debug", message: string) => {
      log[level]({ source: "auth" }, message);
    },
  };
}

export function createAuth({ config, db, outbox, log, trustedOrigins }: AuthDependencies) {
  const adapter = drizzleAdapter(db, { provider: "pg", schema: { user, session, account, verification } });
  return betterAuth({
    appName: "MeetApp",
    baseURL: config.APP_PUBLIC_URL,
    basePath: AUTH_BASE_PATH,
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins,
    database: (options: BetterAuthOptions) => hashSessionTokens(adapter(options)),
    advanced: {
      database: { generateId: "uuid" },
      // No IP addresses or browser names are kept with sessions (design.md section 3, privacy).
      ipAddress: { disableIpTracking: true },
    },
    emailAndPassword: {
      enabled: true,
      // Accounts are created only by our sign-up flow, after the email code (AC-F01-01, 04).
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      revokeSessionsOnPasswordReset: true,
    },
    session: { expiresIn: 30 * DAY_SECONDS, updateAge: DAY_SECONDS },
    user: { additionalFields: USER_FIELDS },
    account: { encryptOAuthTokens: true, accountLinking: { enabled: true, trustedProviders: [] } },
    databaseHooks: {
      session: { create: { before: async (data) => ({ data: { ...data, ipAddress: null, userAgent: null } }) } },
    },
    hooks: { before: passwordRuleHook },
    plugins: [emailCodes(outbox, log), bearer(), sessionIssuer],
    logger: authLogger(log),
  });
}

export type Auth = ReturnType<typeof createAuth>;

/** A new session for a user our code created; returns the token the desktop app keeps. */
export async function issueSession(auth: Auth, userId: string): Promise<string> {
  const { headers } = await auth.api.issueSession({ body: { userId }, returnHeaders: true });
  const token = headers.get("set-auth-token");
  if (token === null) throw new Error("Better Auth did not return a session token");
  return token;
}

/** Better Auth's own password hasher (scrypt), so our sign-up stores passwords it can check. */
export async function hashPassword(auth: Auth, password: string): Promise<string> {
  return (await auth.$context).password.hash(password);
}

/** Reads the signed-in person from the request's bearer token (or cookie) through Better Auth. */
export function authSessionReader(auth: Auth): SessionReader {
  return {
    read: async (request) => {
      const found = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
      if (!found) return undefined;
      const { id, email, name, termsAcceptedAt } = found.user;
      return { id, email, name, termsAccepted: termsAcceptedAt !== null && termsAcceptedAt !== undefined };
    },
  };
}

const PASSWORD_SIGN_IN = "/sign-in/email";
/** Routes that send a code email (sign-in code, reset code). */
const CODE_EMAIL_ROUTES = new Set(["/email-otp/send-verification-otp", "/forget-password/email-otp"]);

function emailIn(body: unknown): string | undefined {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email : undefined;
}

/** Refuses the request when its email is over a limit (AC-F01-13); counts code emails. */
async function enforceLimits(limiter: RateLimiter | undefined, path: string, email: string | undefined) {
  if (limiter === undefined || email === undefined) return;
  let wait: number | undefined;
  if (path === PASSWORD_SIGN_IN) wait = await limiter.blocked(RATE_RULES.wrongPassword, email);
  else if (CODE_EMAIL_ROUTES.has(path)) wait = await limiter.take(RATE_RULES.codeEmails, email);
  if (wait !== undefined) throw tooManyAttempts(wait);
}

export interface AuthRoutesOptions {
  auth: Auth;
  limiter?: RateLimiter;
}

/** Mounts Better Auth at /api/auth/*, forwarding only the allowed routes. */
export async function authRoutes(app: FastifyInstance, { auth, limiter }: AuthRoutesOptions): Promise<void> {
  app.route({
    method: ["GET", "POST"],
    url: `${AUTH_BASE_PATH}/*`,
    config: { access: "public" },
    // The body is sent on as JSON, exactly as received; it is never logged (security rule S10).
    handler: async (request, reply) => {
      const url = new URL(request.url, auth.options.baseURL);
      const path = url.pathname.slice(AUTH_BASE_PATH.length);
      if (!isAllowedAuthPath(path)) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found.", requestId: request.id } });
      }
      const email = emailIn(request.body);
      await enforceLimits(limiter, path, email);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        }),
      );
      if (limiter && email !== undefined && path === PASSWORD_SIGN_IN && response.status === 401) {
        await limiter.hit(RATE_RULES.wrongPassword, email);
      }
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    },
  });
}
