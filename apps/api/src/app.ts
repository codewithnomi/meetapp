// Builds the backend (without starting it), so tests can call it directly with app.inject().
import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import { serializerCompiler, validatorCompiler } from "@fastify/type-provider-zod";
import Fastify, { LogController, type FastifyInstance } from "fastify";
import type { DestinationStream } from "pino";
import type { Config } from "./config/config.ts";
import type { Accounts } from "./accounts.ts";
import { accountsRoutes } from "./modules/accounts/accounts.routes.ts";
import { desktopSignInRoutes } from "./modules/accounts/desktop-sign-in.routes.ts";
import { passwordsRoutes } from "./modules/accounts/passwords.routes.ts";
import { signUpRoutes } from "./modules/accounts/sign-up.routes.ts";
import { flagsRoutes } from "./modules/flags/flags.routes.ts";
import { createFlagsService, type FlagsSource } from "./modules/flags/flags.service.ts";
import { healthRoutes } from "./modules/health/health.routes.ts";
import { createHealthService, type HealthCheck } from "./modules/health/health.service.ts";
import { joinRequestsRoutes } from "./modules/join-requests/join-requests.routes.ts";
import { invitationsRoutes } from "./modules/invitations/invitations.routes.ts";
import { workspacesRoutes } from "./modules/workspaces/workspaces.routes.ts";
import { testErrorRoutes } from "./modules/test-support/test-error.routes.ts";
import { authSessionReader } from "./plugins/auth.ts";
import { authRoutes } from "./plugins/auth-routes.ts";
import { registerDocs } from "./plugins/docs.ts";
import { registerErrorHandling } from "./plugins/errors.ts";
import { loggerOptions } from "./plugins/logging.ts";
import { registerMetrics, type MetricsSources } from "./plugins/metrics.ts";
import { registerSessionCheck } from "./plugins/session.ts";

/** Only the app's own pages may call the backend from a browser (AC-F00-23, design.md section 9). */
export const ALLOWED_ORIGINS = ["app://meetapp", "http://127.0.0.1:5173"];

export interface BuildOptions {
  /** Where log lines go (tests capture them); defaults to standard output. */
  logDestination?: DestinationStream;
  logLevel?: string;
  /** One check per service the backend needs (database, cache, …); see server.ts. */
  healthChecks?: Record<string, HealthCheck>;
  /** Where feature flags come from (the database in server.ts). Without it every flag list is empty (= all off). */
  flags?: FlagsSource;
  metrics?: MetricsSources;
  /** Sign-in and accounts (F01). Without them nobody is signed in: only public routes answer. */
  accounts?: Accounts;
}

const NO_FLAGS: FlagsSource = { list: async () => [] };

export async function buildApp(config: Config, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { ...loggerOptions(options.logLevel ?? "info"), stream: options.logDestination ?? process.stdout },
    genReqId: () => randomUUID(),
    logController: new LogController({ requestIdLogLabel: "requestId" }),
    requestIdHeader: false,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });
  registerErrorHandling(app);
  registerMetrics(app, options.metrics);
  // The desktop's main process adds the token (authorization); creating things sends an idempotency key (F01).
  await app.register(cors, {
    origin: ALLOWED_ORIGINS,
    allowedHeaders: ["content-type", "authorization", "idempotency-key"],
  });
  // After CORS, so a 401 still carries its CORS headers and the app can read "signed out" (T8).
  registerSessionCheck(app, options.accounts ? authSessionReader(options.accounts.auth) : undefined);
  if (config.NODE_ENV === "development") await registerDocs(app);

  await app.register(healthRoutes, { health: createHealthService(options.healthChecks ?? {}) });
  await app.register(flagsRoutes, { flags: createFlagsService(options.flags ?? NO_FLAGS) });
  if (options.accounts) {
    const { auth, limiter, service, signUp, passwords, desktopSignIn, providers } = options.accounts;
    const { workspaces, invitations, joinLink, joinRequests, membershipLookup, idempotency } = options.accounts;
    await app.register(authRoutes, { auth, limiter });
    await app.register(accountsRoutes, { accounts: service });
    await app.register(signUpRoutes, { signUp, accounts: service });
    await app.register(passwordsRoutes, { passwords, accounts: service });
    await app.register(desktopSignInRoutes, {
      desktopSignIn,
      accounts: service,
      enabled: providers,
      secureCookies: config.APP_PUBLIC_URL.startsWith("https:"),
    });
    await app.register(workspacesRoutes, { workspaces, lookup: membershipLookup, idempotency });
    await app.register(invitationsRoutes, { invitations, lookup: membershipLookup });
    await app.register(joinRequestsRoutes, { joinLink, joinRequests, lookup: membershipLookup });
  }
  if (config.NODE_ENV === "test") await app.register(testErrorRoutes);
  return app;
}
