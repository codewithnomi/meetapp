// Puts the accounts pieces together (F01): Better Auth, the rate limiter, and the accounts, sign-up,
// passwords, desktop sign-in, workspaces, invitations and join services, plus meetings (F02). Used by
// server.ts and by the integration tests, so both run the same wiring.
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
import { createProfileRepository } from "./modules/accounts/profile.repository.ts";
import { createProfileService, type PhotoStorage } from "./modules/accounts/profile.service.ts";
import { createProviderPhotoImporter } from "./modules/accounts/provider-photo.ts";
import { createPendingSignUpsRepository } from "./modules/accounts/pending-sign-ups.repository.ts";
import { createSignUpService } from "./modules/accounts/sign-up.service.ts";
import { createWorkspacesRepository } from "./modules/workspaces/workspaces.repository.ts";
import { createInvitationsService } from "./modules/invitations/invitations.service.ts";
import { createInvitationsRepository } from "./modules/invitations/invitations.repository.ts";
import { startExpiryJob } from "./modules/join-requests/expiry-job.ts";
import { createJoinLinkService } from "./modules/join-requests/join-link.service.ts";
import { createJoinRequestsRepository } from "./modules/join-requests/join-requests.repository.ts";
import { createJoinRequestsService } from "./modules/join-requests/join-requests.service.ts";
import { createJoinSecrets } from "./modules/join-requests/join-secret.ts";
import { createWorkspacesService } from "./modules/workspaces/workspaces.service.ts";
import { createLookupService } from "./modules/meetings/lookup.service.ts";
import { createLookupTokens } from "./modules/meetings/lookup-token.ts";
import { createMeetingSecrets } from "./modules/meetings/meeting-secrets.ts";
import { createMeetingsRepository } from "./modules/meetings/meetings.repository.ts";
import { createMeetingsService } from "./modules/meetings/meetings.service.ts";
import { createAuth, hashPassword, issueSession } from "./plugins/auth.ts";
import { createIdempotency, redisIdempotencyStore } from "./plugins/idempotency.ts";
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
  storage: PhotoStorage;
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
  const service = createAccountsService(accountsRepository, workspaces, { supportEmail: config.SUPPORT_EMAIL });
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
  return {
    auth,
    limiter,
    service,
    signUp,
    passwords,
    desktopSignIn,
    providers,
    profile: createProfileService(createProfileRepository(db), storage),
    ...workspacePieces({ config, db, redis, outbox }, limiter),
    ...meetingPieces({ config, db }, limiter),
  };
}

/** Meetings (F02): making them, their secrets and the lookup tokens. */
function meetingPieces(
  { config, db }: Pick<AccountsWiring, "config" | "db">,
  limiter: ReturnType<typeof createRateLimiter>,
) {
  const shared = {
    repository: createMeetingsRepository(db),
    secrets: createMeetingSecrets(config.DATA_ENCRYPTION_KEY, config.APP_PUBLIC_URL),
    lookupTokens: createLookupTokens(config.DATA_ENCRYPTION_KEY),
    limiter,
  };
  return { meetings: createMeetingsService(shared), lookups: createLookupService(shared) };
}

/** Workspaces, invitations, joining, the membership check and repeat-safe creates. */
function workspacePieces(
  { config, db, redis, outbox }: Pick<AccountsWiring, "config" | "db" | "redis" | "outbox">,
  limiter: ReturnType<typeof createRateLimiter>,
) {
  const workspaces = createWorkspacesRepository(db);
  return {
    workspaces: createWorkspacesService(workspaces),
    invitations: createInvitationsService({
      repository: createInvitationsRepository(db),
      memberRole: workspaces.memberRole,
      limiter,
      outbox,
      publicUrl: config.APP_PUBLIC_URL,
    }),
    ...joinPieces({ config, db, outbox }, limiter),
    membershipLookup: workspaces.findMembership,
    idempotency: createIdempotency({ store: redisIdempotencyStore(redis) }),
  };
}

/** The join link and code, requests to join, and the daily expiry job (started by server.ts). */
function joinPieces(
  { config, db, outbox }: Pick<AccountsWiring, "config" | "db" | "outbox">,
  limiter: ReturnType<typeof createRateLimiter>,
) {
  const repository = createJoinRequestsRepository(db);
  const secrets = createJoinSecrets(config.DATA_ENCRYPTION_KEY, config.APP_PUBLIC_URL);
  const workspaces = createWorkspacesRepository(db);
  const joinRequests = createJoinRequestsService({
    repository,
    secrets,
    limiter,
    outbox,
    isMember: async (workspaceId, userId) => (await workspaces.memberRole(workspaceId, userId)) !== undefined,
  });
  return {
    joinLink: createJoinLinkService(repository, secrets),
    joinRequests,
    startExpiryJob: () => startExpiryJob({ host: config.REDIS_HOST, port: config.REDIS_PORT }, joinRequests.expireOld),
  };
}

export type Accounts = ReturnType<typeof createAccounts>;
