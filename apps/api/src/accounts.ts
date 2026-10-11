// Puts the accounts pieces together (F01): Better Auth, the rate limiter, and the accounts, sign-up,
// passwords and desktop sign-in services. Used by server.ts and by the integration tests, so both run the same wiring.
import type { Database } from "@meetapp/db";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import { signInProviders, type Config } from "./config/config.ts";
import type { Outbox } from "./emails/outbox.ts";
import { createAccountsRepository } from "./modules/accounts/accounts.repository.ts";
import { createAccountsService } from "./modules/accounts/accounts.service.ts";
import { createDesktopSignInsRepository } from "./modules/accounts/desktop-sign-ins.repository.ts";
import { createDesktopSignInService } from "./modules/accounts/desktop-sign-in.service.ts";
import { createPasswordsService } from "./modules/accounts/passwords.service.ts";
import { createProviderPhotoImporter, type ProviderPhotoDependencies } from "./modules/accounts/provider-photo.ts";
import { createPendingSignUpsRepository } from "./modules/accounts/pending-sign-ups.repository.ts";
import { createSignUpService } from "./modules/accounts/sign-up.service.ts";
import { createWorkspacesRepository } from "./modules/workspaces/workspaces.repository.ts";
import { createAuth, hashPassword, issueSession } from "./plugins/auth.ts";
import { passwordAuth, providerAuth } from "./plugins/auth-bridges.ts";
import { createRateLimiter } from "./plugins/rate-limit.ts";

export interface AccountsWiring {
  config: Config;
  db: Database;
  redis: Redis;
  outbox: Outbox;
  log: FastifyBaseLogger;
  trustedOrigins: string[];
  /** Where profile photos are kept (F00 storage). */
  storage: ProviderPhotoDependencies["storage"];
}

export function createAccounts({ config, db, redis, outbox, log, trustedOrigins, storage }: AccountsWiring) {
  const auth = createAuth({ config, db, outbox, log, trustedOrigins });
  const limiter = createRateLimiter({
    store: redis,
    secret: config.DATA_ENCRYPTION_KEY,
    onStoreError: (error) => log.warn({ err: error }, "rate limits unavailable; requests let through"),
  });
  const accountsRepository = createAccountsRepository(db);
  const workspaces = createWorkspacesRepository(db);
  const service = createAccountsService(accountsRepository, workspaces);
  const signUp = createSignUpService({
    accounts: accountsRepository,
    pending: createPendingSignUpsRepository(redis),
    outbox,
    limiter,
    hashPassword: (password) => hashPassword(auth, password),
    issueSession: (userId) => issueSession(auth, userId),
  });
  const passwords = createPasswordsService({ auth: passwordAuth(auth), limiter });
  const providers = signInProviders(config);
  const desktopSignIn = createDesktopSignInService({
    repository: createDesktopSignInsRepository(redis),
    auth: providerAuth(auth),
    enabled: providers,
    publicUrl: config.APP_PUBLIC_URL,
    secret: config.BETTER_AUTH_SECRET,
    workspaces,
    limiter,
    importPhoto: createProviderPhotoImporter({
      users: accountsRepository,
      storage,
      // Only the kind of problem: a network error could carry the photo's address.
      onProblem: (problem) =>
        log.warn({ problem: problem instanceof Error ? problem.name : "unknown" }, "provider photo not copied"),
    }),
  });
  return { auth, limiter, service, signUp, passwords, desktopSignIn, providers };
}

export type Accounts = ReturnType<typeof createAccounts>;
