// Puts the accounts pieces together (F01): Better Auth, the rate limiter, the accounts, sign-up and
// passwords services. Used by server.ts and by the integration tests, so both run the same wiring.
import type { Database } from "@meetapp/db";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { Config } from "./config/config.ts";
import type { Outbox } from "./emails/outbox.ts";
import { createAccountsRepository } from "./modules/accounts/accounts.repository.ts";
import { createAccountsService } from "./modules/accounts/accounts.service.ts";
import { createPasswordsService } from "./modules/accounts/passwords.service.ts";
import { createPendingSignUpsRepository } from "./modules/accounts/pending-sign-ups.repository.ts";
import { createSignUpService } from "./modules/accounts/sign-up.service.ts";
import { createWorkspacesRepository } from "./modules/workspaces/workspaces.repository.ts";
import { createAuth, hashPassword, issueSession, passwordAuth } from "./plugins/auth.ts";
import { createRateLimiter } from "./plugins/rate-limit.ts";

export interface AccountsWiring {
  config: Config;
  db: Database;
  redis: Redis;
  outbox: Outbox;
  log: FastifyBaseLogger;
  trustedOrigins: string[];
}

export function createAccounts({ config, db, redis, outbox, log, trustedOrigins }: AccountsWiring) {
  const auth = createAuth({ config, db, outbox, log, trustedOrigins });
  const limiter = createRateLimiter({
    store: redis,
    secret: config.DATA_ENCRYPTION_KEY,
    onStoreError: (error) => log.warn({ err: error }, "rate limits unavailable; requests let through"),
  });
  const accountsRepository = createAccountsRepository(db);
  const service = createAccountsService(accountsRepository, createWorkspacesRepository(db));
  const signUp = createSignUpService({
    accounts: accountsRepository,
    pending: createPendingSignUpsRepository(redis),
    outbox,
    limiter,
    hashPassword: (password) => hashPassword(auth, password),
    issueSession: (userId) => issueSession(auth, userId),
  });
  const passwords = createPasswordsService({ auth: passwordAuth(auth), limiter });
  return { auth, limiter, service, signUp, passwords };
}

export type Accounts = ReturnType<typeof createAccounts>;
