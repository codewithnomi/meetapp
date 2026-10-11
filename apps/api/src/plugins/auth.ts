// Sign-in with Better Auth (F01 design.md section 3, D048): identity only. It handles password
// sign-in (scrypt), email codes, sessions (30 days, extended by use) and signing out everywhere.
// Its web routes and their allow-list are in auth-routes.ts; the bridges our services use are in
// auth-bridges.ts.
import { account, session, user, verification, type Database } from "@meetapp/db";
import { betterAuth, type BetterAuthOptions, type BetterAuthPlugin } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthEndpoint, createAuthMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { fromNodeHeaders } from "better-auth/node";
import { bearer, emailOTP } from "better-auth/plugins";
import type { FastifyBaseLogger } from "fastify";
import { z } from "zod";
import type { Config } from "../config/config.ts";
import type { Outbox } from "../emails/outbox.ts";
import type { SessionReader } from "./session.ts";
import {
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  PASSWORD_MESSAGES,
  checkPassword,
} from "../modules/accounts/password-rule.ts";
import { hashSessionTokens } from "./auth-adapter.ts";
import { socialProviders, validateUserInfo } from "./auth-providers.ts";

const DAY_SECONDS = 24 * 60 * 60;
const CODE_MINUTES = 15;

/** Where Better Auth answers (design.md section 3). */
export const AUTH_BASE_PATH = "/api/auth";

/**
 * Routes whose body carries a new password: checked against our password rule first. The reset itself
 * is reached only through our `/api/v1/auth/reset-password`, which signs in on this computer after it.
 */
const NEW_PASSWORD_ROUTES = new Set(["/email-otp/reset-password"]);

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
    socialProviders: socialProviders(config),
    user: { additionalFields: USER_FIELDS, validateUserInfo },
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
