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
import { profileRoutes } from "./modules/accounts/profile.routes.ts";
import { signUpRoutes } from "./modules/accounts/sign-up.routes.ts";
import { flagsRoutes } from "./modules/flags/flags.routes.ts";
import { createFlagsService, type FlagsSource } from "./modules/flags/flags.service.ts";
import { healthRoutes } from "./modules/health/health.routes.ts";
import { createHealthService, type HealthCheck } from "./modules/health/health.service.ts";
import { joinRequestsRoutes } from "./modules/join-requests/join-requests.routes.ts";
import { callsRoutes } from "./modules/calls/calls.routes.ts";
import { controlsRoutes } from "./modules/calls/controls.routes.ts";
import { chatActionsRoutes } from "./modules/chat/chat-actions.routes.ts";
import { chatAfterRoutes } from "./modules/chat/chat-after.routes.ts";
import { chatsLineRoutes, registerWebSockets } from "./modules/chats/chats-line.routes.ts";
import { chatsExtrasRoutes } from "./modules/chats/chats-extras.routes.ts";
import { chatsMessagesRoutes } from "./modules/chats/chats-messages.routes.ts";
import { chatCallsRoutes } from "./modules/calls/chat-calls.routes.ts";
import { ringRoutes } from "./modules/calls/ring.routes.ts";
import { chatsGroupsRoutes } from "./modules/chats/chats-groups.routes.ts";
import { chatsRequestsRoutes } from "./modules/chats/chats-requests.routes.ts";
import { chatsRoutes } from "./modules/chats/chats.routes.ts";
import { chatFilesRoutes } from "./modules/chat/chat-files.routes.ts";
import { chatPollsRoutes } from "./modules/chat/chat-polls.routes.ts";
import { chatRoutes } from "./modules/chat/chat.routes.ts";
import { liveKitWebhookRoutes } from "./modules/calls/livekit-webhook.routes.ts";
import { meetingsRoutes } from "./modules/meetings/meetings.routes.ts";
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

/** One registered route, as the security sweeps read them (TC-F01-76, 77). */
export interface RouteSummary {
  method: string;
  url: string;
  access: "public" | "signed-in" | "optional" | undefined;
}

const ROUTES = new WeakMap<FastifyInstance, RouteSummary[]>();

/** Every route the app answers, read from Fastify itself, so a new route can't be missed. */
export function listRoutes(app: FastifyInstance): RouteSummary[] {
  return ROUTES.get(app) ?? [];
}

function recordRoutes(app: FastifyInstance): void {
  const routes: RouteSummary[] = [];
  ROUTES.set(app, routes);
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    const access = (route.config as { access?: RouteSummary["access"] } | undefined)?.access;
    for (const method of methods) routes.push({ method, url: route.url, access });
  });
}

export async function buildApp(config: Config, options: BuildOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { ...loggerOptions(options.logLevel ?? "info"), stream: options.logDestination ?? process.stdout },
    genReqId: () => randomUUID(),
    logController: new LogController({ requestIdLogLabel: "requestId" }),
    requestIdHeader: false,
  });

  // First, so every route sees WebSocket upgrades (F14 live line, D064).
  await registerWebSockets(app);
  recordRoutes(app);
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
    // F02: the meeting ticket has its own header, because the desktop sets authorization itself.
    allowedHeaders: ["content-type", "authorization", "idempotency-key", "x-meeting-ticket", "x-file-name"],
    // The screens also change and remove things (F01: rename, roles, last workspace, cancel…).
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"],
  });
  // After CORS, so a 401 still carries its CORS headers and the app can read "signed out" (T8).
  const sessions = options.accounts ? authSessionReader(options.accounts.auth) : undefined;
  registerSessionCheck(app, sessions);
  if (config.NODE_ENV === "development") await registerDocs(app);

  await app.register(healthRoutes, { health: createHealthService(options.healthChecks ?? {}) });
  await app.register(flagsRoutes, { flags: createFlagsService(options.flags ?? NO_FLAGS) });
  if (options.accounts) await registerAccountRoutes(app, config, options.accounts);
  if (options.accounts && sessions)
    await app.register(chatsLineRoutes, {
      line: options.accounts.chatsLine,
      sessions,
      status: options.accounts.chatsStatus,
      allowedOrigins: ALLOWED_ORIGINS,
    });
  if (config.NODE_ENV === "test") await app.register(testErrorRoutes);
  return app;
}

/** Sign-in, accounts, workspaces and meetings (F01, F02). */
async function registerAccountRoutes(app: FastifyInstance, config: Config, accounts: Accounts): Promise<void> {
  const { auth, limiter, service, signUp, passwords, desktopSignIn, providers } = accounts;
  const { workspaces, invitations, joinLink, joinRequests, membershipLookup, idempotency } = accounts;
  await app.register(authRoutes, { auth, limiter });
  await app.register(accountsRoutes, { accounts: service });
  await app.register(profileRoutes, { profile: accounts.profile });
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
  const {
    meetings,
    lookups,
    join,
    lobby,
    rejoin,
    record,
    webhooks,
    controls,
    chat,
    chatActions,
    chatPolls,
    chatFiles,
    chatAfter,
  } = accounts;
  await app.register(meetingsRoutes, { meetings, lookups, lookup: membershipLookup, idempotency });
  await app.register(callsRoutes, { join, lobby, rejoin, record });
  await app.register(liveKitWebhookRoutes, { webhooks });
  await app.register(controlsRoutes, { controls });
  await app.register(chatRoutes, { chat });
  await app.register(chatActionsRoutes, { actions: chatActions });
  await app.register(chatPollsRoutes, { polls: chatPolls });
  await app.register(chatFilesRoutes, { files: chatFiles });
  await app.register(chatAfterRoutes, { after: chatAfter });
  await registerChatsRoutes(app, accounts);
}

/** One-to-one and group chats (F14). */
async function registerChatsRoutes(app: FastifyInstance, accounts: Accounts): Promise<void> {
  const { chats, chatsPeople, chatsRequests, chatsGroups, chatsMessages, chatsExtras, membershipLookup } = accounts;
  await app.register(chatsRoutes, { chats, people: chatsPeople, lookup: membershipLookup });
  await app.register(chatsRequestsRoutes, { requests: chatsRequests });
  await app.register(chatsGroupsRoutes, { groups: chatsGroups });
  await app.register(chatsMessagesRoutes, { messages: chatsMessages });
  await app.register(chatCallsRoutes, { chatCalls: accounts.chatCalls });
  await app.register(ringRoutes, { rings: accounts.rings });
  await app.register(chatsExtrasRoutes, { extras: chatsExtras });
}
