// Better Auth's web routes at /api/auth/* (F01 design.md section 3): only the allowed ones are
// forwarded, and the per-email limits (AC-F01-13) are applied in front of them.
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyInstance } from "fastify";
import { AUTH_BASE_PATH, type Auth } from "./auth.ts";
import { tooManyAttempts } from "./errors.ts";
import { RATE_RULES, type RateLimiter } from "./rate-limit.ts";

/**
 * The Better Auth routes the app may use (design.md section 3); all others answer 404, so its own
 * sign-up, profile and organization routes can't be used to get around our rules. Google/Microsoft
 * sign-in starts only through our desktop hand-off, which calls `sign-in/social` on the server (T7).
 */
const AUTH_ROUTE_ALLOW_LIST = [
  "/sign-in/email",
  "/sign-in/email-otp",
  "/email-otp/send-verification-otp",
  "/email-otp/request-password-reset",
  "/sign-out",
  "/revoke-sessions",
] as const;
/** Google/Microsoft send people back here (/callback/google, /callback/microsoft). */
const CALLBACK_PREFIX = "/callback/";

function isAllowedAuthPath(path: string): boolean {
  return (
    (AUTH_ROUTE_ALLOW_LIST as readonly string[]).includes(path) ||
    (path.startsWith(CALLBACK_PREFIX) && /^[a-z]+$/.test(path.slice(CALLBACK_PREFIX.length)))
  );
}

const PASSWORD_SIGN_IN = "/sign-in/email";
/** Routes that send a code email (sign-in code, reset code). */
const CODE_EMAIL_ROUTES = new Set(["/email-otp/send-verification-otp", "/email-otp/request-password-reset"]);

function emailIn(body: unknown): string | undefined {
  const email = (body as { email?: unknown } | undefined)?.email;
  return typeof email === "string" ? email : undefined;
}

/**
 * Refuses the request when its email or network address is over a limit (AC-F01-13). A password
 * sign-in is counted as a wrong one before it is checked (so a burst can't slip past the limit) and
 * given back if it was right; code emails are counted.
 */
async function enforceLimits(
  limiter: RateLimiter | undefined,
  path: string,
  email: string | undefined,
  address: string,
) {
  if (limiter === undefined || email === undefined) return;
  let wait: number | undefined;
  if (path === PASSWORD_SIGN_IN) {
    wait =
      (await limiter.take(RATE_RULES.wrongPasswordPerAddress, address)) ??
      (await limiter.take(RATE_RULES.wrongPassword, email));
  } else if (CODE_EMAIL_ROUTES.has(path)) wait = await limiter.take(RATE_RULES.codeEmails, email);
  if (wait !== undefined) throw tooManyAttempts(wait);
}

/** A sign-in that wasn't a wrong password gives back the counts taken for it. */
async function settleSignIn(limiter: RateLimiter, email: string, address: string, status: number) {
  if (status === 401) return;
  await limiter.refund(RATE_RULES.wrongPassword, email);
  await limiter.refund(RATE_RULES.wrongPasswordPerAddress, address);
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
      await enforceLimits(limiter, path, email, request.ip);
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
        }),
      );
      if (limiter && email !== undefined && path === PASSWORD_SIGN_IN) {
        await settleSignIn(limiter, email, request.ip, response.status);
      }
      reply.status(response.status);
      response.headers.forEach((value, key) => reply.header(key, value));
      // Better Auth's own answer, passed on with its own content type: JSON or a redirect from the
      // allow-listed routes only, never an HTML page built from what the caller sent.
      // nosemgrep: javascript.express.security.audit.xss.direct-response-write.direct-response-write
      return reply.send(response.body ? await response.text() : null);
    },
  });
}
