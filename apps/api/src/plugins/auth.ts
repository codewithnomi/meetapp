// Sign-in with Better Auth (F01 design.md section 3, D048): identity only. It handles password
// sign-in (scrypt), email codes, sessions (30 days, extended by use) and signing out everywhere.
// Only the routes in AUTH_ROUTE_ALLOW_LIST are reachable; everything else Better Auth offers answers
// 404, so its own sign-up, profile and organization routes can't be used to get around our rules.
import { account, session, user, verification, type Database } from "@meetapp/db";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";
import { bearer, emailOTP } from "better-auth/plugins";
import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Config } from "../config/config.ts";
import type { Outbox } from "../emails/outbox.ts";
import type { SessionReader } from "./session.ts";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH, checkPassword } from "../modules/accounts/password-rule.ts";
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
  if (problem) throw new APIError("BAD_REQUEST", { code: "PASSWORD_WEAK", message: problem });
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
    plugins: [emailCodes(outbox, log), bearer()],
    logger: authLogger(log),
  });
}

export type Auth = ReturnType<typeof createAuth>;

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

/** Mounts Better Auth at /api/auth/*, forwarding only the allowed routes. */
export async function authRoutes(app: FastifyInstance, options: { auth: Auth }): Promise<void> {
  app.route({
    method: ["GET", "POST"],
    url: `${AUTH_BASE_PATH}/*`,
    config: { access: "public" },
    // The body is sent on as JSON, exactly as received; it is never logged (security rule S10).
    handler: async (request, reply) => {
      const url = new URL(request.url, options.auth.options.baseURL);
      const path = url.pathname.slice(AUTH_BASE_PATH.length);
      if (!isAllowedAuthPath(path)) {
        return reply.status(404).send({ error: { code: "NOT_FOUND", message: "Not found.", requestId: request.id } });
      }
      const response = await options.auth.handler(
        new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        }),
      );
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      return reply.send(response.body ? await response.text() : null);
    },
  });
}
