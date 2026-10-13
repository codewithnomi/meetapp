// Google/Microsoft sign-in for the desktop app (F01 design.md sections 4 and 8): which providers are on,
// the app's init/exchange/cancel calls, and the browser's start link and page. All public; the app's
// calls are protected by its secret verifier, the browser's by a signed cookie and the person's click.
import {
  desktopExchangeBodySchema,
  desktopInitBodySchema,
  desktopInitResponseSchema,
  desktopPendingSchema,
  meResponseSchema,
  providersResponseSchema,
  type SignInProvider,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import type { AccountsService } from "./accounts.service.ts";
import type { DesktopSignInService } from "./desktop-sign-in.service.ts";
import { PAGE_HEADERS, renderDesktopSignInPage } from "./page/desktop-sign-in-page.ts";

const PATH = "/api/v1/auth/desktop";
const COOKIE = "meetapp_desktop_sign_in";
const config = { access: "public" as const };
const tags = ["accounts"];
const hidden = { hide: true };

export interface DesktopSignInRoutesOptions {
  desktopSignIn: DesktopSignInService;
  accounts: AccountsService;
  enabled: Record<SignInProvider, boolean>;
  /** Cookies get `Secure` when the backend is reached over https. */
  secureCookies: boolean;
}

function cookieValue(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return undefined;
}

const INIT = {
  config,
  schema: {
    summary: "Start a Google/Microsoft sign-in for the desktop app",
    description: "Send the SHA-256 of a secret verifier; open the start link in the browser within 60 s.",
    tags,
    body: desktopInitBodySchema,
    response: { 200: desktopInitResponseSchema },
  },
};

const EXCHANGE = {
  config,
  schema: {
    summary: "Collect the finished Google/Microsoft sign-in",
    description:
      "202 until the person confirms in the browser; then 200 once, with the new session in the set-auth-token header. 410 when cancelled.",
    tags,
    body: desktopExchangeBodySchema,
    response: { 200: meResponseSchema, 202: desktopPendingSchema },
  },
};

const CANCEL = {
  config,
  schema: {
    summary: "Cancel a Google/Microsoft sign-in",
    description:
      "The app gave up (Cancel, or 5 minutes passed). Only with the right verifier; otherwise nothing changes.",
    tags,
    body: desktopExchangeBodySchema,
  },
};

const browserQuery = z.object({ request: z.uuid(), error: z.string().max(100).optional() });
const confirmForm = z.object({ request: z.uuid(), action: z.enum(["continue", "cancel"]) });

type App = Parameters<FastifyPluginAsyncZod>[0];

/** The browser's start link and page (HTML, not part of the API description). */
function browserRoutes(app: App, { desktopSignIn, secureCookies }: DesktopSignInRoutesOptions) {
  const cookieFlags = `HttpOnly; SameSite=Lax; Path=${PATH}; Max-Age=300${secureCookies ? "; Secure" : ""}`;
  // The browser page's form; small and never logged. Registered inside this plugin, so Fastify keeps
  // it to these routes only.
  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string", bodyLimit: 1_024 },
    (_, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(String(body))));
    },
  );

  app.get(`${PATH}/start`, { config, schema: { ...hidden, querystring: browserQuery } }, async (request, reply) => {
    const started = await desktopSignIn.start(request.query.request);
    if (!started)
      return reply
        .status(400)
        .headers(PAGE_HEADERS)
        .send(renderDesktopSignInPage("", { page: "invalid" }));
    for (const cookie of started.cookies) reply.header("set-cookie", cookie);
    reply.header("set-cookie", `${COOKIE}=${started.binding}; ${cookieFlags}`);
    return reply.headers({ "cache-control": "no-store", "referrer-policy": "no-referrer" }).redirect(started.url, 302);
  });

  app.get(`${PATH}/done`, { config, schema: { ...hidden, querystring: browserQuery } }, async (request, reply) => {
    const { request: requestId, error } = request.query;
    const cookieHeader = request.headers.cookie;
    const binding = cookieValue(cookieHeader, COOKIE);
    const page = await desktopSignIn.providerReturned({ requestId, binding, cookieHeader, error });
    return reply.headers(PAGE_HEADERS).send(renderDesktopSignInPage(requestId, page));
  });

  app.post(`${PATH}/done`, { config, schema: { ...hidden, body: confirmForm } }, async (request, reply) => {
    const { request: requestId, action } = request.body;
    const binding = cookieValue(request.headers.cookie, COOKIE);
    const page = await desktopSignIn.confirmed({ requestId, binding, proceed: action === "continue" });
    return reply.headers(PAGE_HEADERS).send(renderDesktopSignInPage(requestId, page));
  });
}

export const desktopSignInRoutes: FastifyPluginAsyncZod<DesktopSignInRoutesOptions> = async (app, options) => {
  const { desktopSignIn, accounts, enabled } = options;
  app.get(
    "/api/v1/auth/providers",
    {
      config,
      schema: {
        summary: "Which sign-in providers are on",
        description:
          "Which of Google and Microsoft are switched on, so the app shows only those buttons. Anyone may ask.",
        tags,
        response: { 200: providersResponseSchema },
      },
    },
    () => enabled,
  );

  app.post(`${PATH}/init`, INIT, async (request) =>
    desktopSignIn.init(request.body.provider, request.body.challenge, request.ip),
  );

  app.post(`${PATH}/exchange`, EXCHANGE, async (request, reply) => {
    const finished = await desktopSignIn.exchange(request.body.requestId, request.body.verifier);
    if (!finished) return reply.status(202).send({ status: "pending" as const });
    reply.header("set-auth-token", finished.token);
    return accounts.me(finished.userId);
  });

  app.post(`${PATH}/cancel`, CANCEL, async (request, reply) => {
    await desktopSignIn.cancel(request.body.requestId, request.body.verifier);
    return reply.status(204).send();
  });

  browserRoutes(app, options);
};
