// Test helper: the real backend with sign-in, on its own empty database, sending real emails to the
// local fake inbox. Used by the F01 integration tests; needs the `pnpm dev` services running.
import { randomUUID } from "node:crypto";
import { runMigrations } from "@meetapp/db";
import { createTestDatabase, type TestDatabase } from "@meetapp/db/testing";
import type { FastifyInstance } from "fastify";
import { pino, type DestinationStream } from "pino";
import { createAccounts } from "../accounts.ts";
import { ALLOWED_ORIGINS, buildApp } from "../app.ts";
import { createEmailOutbox } from "../emails/outbox.ts";
import type { Auth } from "../plugins/auth.ts";
import { loggerOptions } from "../plugins/logging.ts";
import { createCacheProvider } from "../providers/cache.ts";
import { createEmailProvider } from "../providers/email.ts";
import { createStorageProvider } from "../providers/storage.ts";
import { localConfig } from "./integration.ts";

export interface AuthTestApp {
  app: FastifyInstance;
  /** The services behind the routes, for steps no route starts (for example the daily expiry job). */
  accounts: ReturnType<typeof createAccounts>;
  storage: ReturnType<typeof createStorageProvider>;
  auth: Auth;
  database: TestDatabase;
  close: () => Promise<void>;
}

/** Fake Google/Microsoft keys; with them the providers are switched on (see fake-providers.ts). */
const PROVIDER_KEYS = {
  google: { GOOGLE_CLIENT_ID: "test-google-client", GOOGLE_CLIENT_SECRET: "test-google-secret" },
  microsoft: { MICROSOFT_CLIENT_ID: "test-microsoft-client", MICROSOFT_CLIENT_SECRET: "test-microsoft-secret" },
};

interface TestAppOptions {
  providers?: (keyof typeof PROVIDER_KEYS)[];
  /** Where the log lines go (every level); without it nothing is logged. */
  logs?: DestinationStream;
}

/**
 * The local settings with its own key for the attempt counters, so counts left in Redis by earlier
 * runs (all from 127.0.0.1, within the same hour) can't use up this run's limits.
 */
function testConfig(options: TestAppOptions): ReturnType<typeof localConfig> {
  return {
    ...localConfig(),
    DATA_ENCRYPTION_KEY: `test-${randomUUID()}`,
    ...Object.assign({}, ...(options.providers ?? []).map((provider) => PROVIDER_KEYS[provider])),
  } as ReturnType<typeof localConfig>;
}

export async function startAuthTestApp(options: TestAppOptions = {}): Promise<AuthTestApp> {
  const config = testConfig(options);
  const database = await createTestDatabase();
  await runMigrations(database.url);
  const log = options.logs ? pino(loggerOptions("debug"), options.logs) : pino({ level: "silent" });
  const email = createEmailProvider(config);
  const emails = createEmailOutbox({ host: config.REDIS_HOST, port: config.REDIS_PORT }, email);
  const cache = createCacheProvider(config, log);
  const storage = createStorageProvider(config);
  // Wait for Redis, or the first limit checks would be let through as "Redis unavailable".
  if (!cache.isReady()) await new Promise((ready) => cache.redis.once("ready", ready));
  const accounts = createAccounts({
    config,
    db: database.db,
    redis: cache.redis,
    outbox: emails.outbox,
    log,
    trustedOrigins: ALLOWED_ORIGINS,
    storage,
  });
  const { auth } = accounts;
  const app = await buildApp(config, {
    logLevel: options.logs ? "debug" : "silent",
    accounts,
    ...(options.logs ? { logDestination: options.logs } : {}),
  });
  return {
    app,
    accounts,
    storage,
    auth,
    database,
    close: async () => {
      await app.close();
      await emails.close();
      await email.close();
      await cache.close();
      await storage.close();
      await database.drop();
    },
  };
}

/** A unique test email address (Mailpit keeps old messages, so every test uses its own). */
export function testEmail(label: string): string {
  return `${label}-${randomUUID()}@example.test`;
}

/**
 * An existing account with a confirmed email, made through Better Auth's own internals. With a
 * `password` it has a password login; without one it imitates a Google-only account.
 * `termsAccepted` false imitates a first Google sign-in.
 */
export async function createUser(
  auth: Auth,
  options: { email: string; password?: string; termsAccepted?: boolean },
): Promise<string> {
  const { adapter, password } = await auth.$context;
  const accepted = options.termsAccepted === false ? {} : { termsVersion: "draft-1", termsAcceptedAt: new Date() };
  // Straight into the tables (Better Auth's sign-up rules run only inside its web routes).
  const created = await adapter.create<{ id: string }>({
    model: "user",
    data: { name: "Test Person", email: options.email.toLowerCase(), emailVerified: true, ...accepted },
  });
  const login =
    options.password === undefined
      ? { providerId: "google", accountId: randomUUID() }
      : { providerId: "credential", accountId: created.id, password: await password.hash(options.password) };
  await adapter.create({ model: "account", data: { userId: created.id, ...login } });
  return created.id;
}

/** Signs in with email and password; returns the session token the desktop app would keep. */
export async function signIn(app: FastifyInstance, email: string, password: string): Promise<string> {
  const response = await app.inject({
    method: "POST",
    url: "/api/auth/sign-in/email",
    payload: { email, password },
    headers: { origin: "app://meetapp" },
  });
  const token = response.headers["set-auth-token"];
  if (response.statusCode !== 200 || typeof token !== "string") {
    throw new Error(`sign-in failed with ${String(response.statusCode)}`);
  }
  return token;
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
