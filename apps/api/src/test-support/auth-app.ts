// Test helper: the real backend with sign-in, on its own empty database, sending real emails to the
// local fake inbox. Used by the F01 integration tests; needs the `pnpm dev` services running.
import { randomUUID } from "node:crypto";
import { runMigrations } from "@meetapp/db";
import { createTestDatabase, type TestDatabase } from "@meetapp/db/testing";
import type { FastifyInstance } from "fastify";
import { pino } from "pino";
import { createAccounts } from "../accounts.ts";
import { ALLOWED_ORIGINS, buildApp } from "../app.ts";
import { createEmailOutbox } from "../emails/outbox.ts";
import type { Auth } from "../plugins/auth.ts";
import { createCacheProvider } from "../providers/cache.ts";
import { createEmailProvider } from "../providers/email.ts";
import { localConfig } from "./integration.ts";

export interface AuthTestApp {
  app: FastifyInstance;
  auth: Auth;
  database: TestDatabase;
  close: () => Promise<void>;
}

export async function startAuthTestApp(): Promise<AuthTestApp> {
  // Its own key for the attempt counters, so counts left in Redis by earlier runs (all from
  // 127.0.0.1, within the same hour) can't use up this run's limits.
  const config = { ...localConfig(), DATA_ENCRYPTION_KEY: `test-${randomUUID()}` };
  const database = await createTestDatabase();
  await runMigrations(database.url);
  const log = pino({ level: "silent" });
  const email = createEmailProvider(config);
  const emails = createEmailOutbox({ host: config.REDIS_HOST, port: config.REDIS_PORT }, email);
  const cache = createCacheProvider(config, log);
  // Wait for Redis, or the first limit checks would be let through as "Redis unavailable".
  if (!cache.isReady()) await new Promise((ready) => cache.redis.once("ready", ready));
  const accounts = createAccounts({
    config,
    db: database.db,
    redis: cache.redis,
    outbox: emails.outbox,
    log,
    trustedOrigins: ALLOWED_ORIGINS,
  });
  const { auth } = accounts;
  const app = await buildApp(config, { logLevel: "silent", accounts });
  return {
    app,
    auth,
    database,
    close: async () => {
      await app.close();
      await emails.close();
      await email.close();
      await cache.close();
      await database.drop();
    },
  };
}

/** A unique test email address (Mailpit keeps old messages, so every test uses its own). */
export function testEmail(label: string): string {
  return `${label}-${randomUUID()}@example.test`;
}

/**
 * An existing account with a confirmed email and a password, made through Better Auth's own
 * internals (the sign-up flow arrives in T5). `termsAccepted` false imitates a first Google sign-in.
 */
export async function createUser(
  auth: Auth,
  options: { email: string; password: string; termsAccepted?: boolean },
): Promise<string> {
  const context = await auth.$context;
  const accepted = options.termsAccepted === false ? {} : { termsVersion: "draft-1", termsAcceptedAt: new Date() };
  const created = await context.internalAdapter.createUser(
    { name: "Test Person", email: options.email, emailVerified: true, ...accepted },
    { method: "email-password" },
  );
  await context.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await context.password.hash(options.password),
  });
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
