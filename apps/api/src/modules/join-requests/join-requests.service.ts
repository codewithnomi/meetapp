// Requests to join (F01 design.md section 5; AC-F01-19, 20): look a link or code up, ask to join, and
// the owner's or an admin's decision. Every wrong, switched-off or replaced link or code gets the same
// 404, and lookups count toward the limits either way. A request not decided in 14 days expires.
import type { Outbox } from "../../emails/outbox.ts";
import { AppError, tooManyAttempts } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { SignedInUser } from "../../plugins/session.ts";
import { ensureAllowed, type Membership } from "../workspaces/workspaces.permissions.ts";
import type { DecisionOutcome, JoinRequestsRepository } from "./join-requests.repository.ts";
import type { JoinSecrets } from "./join-secret.ts";

const EXPIRE_MS = 14 * 24 * 60 * 60 * 1_000;

export interface JoinRequestsDependencies {
  repository: JoinRequestsRepository;
  secrets: JoinSecrets;
  limiter: RateLimiter;
  outbox: Outbox;
  isMember: (workspaceId: string, userId: string) => Promise<boolean>;
  now?: () => Date;
}

/** Who is asking, from where. */
interface Asker {
  user: SignedInUser;
  address: string;
}

const notValid = () => new AppError(404, "NOT_FOUND", "This link or code isn't valid.");
const alreadyDecided = () => new AppError(409, "ALREADY_DECIDED", "This request was already decided.");

export function createJoinRequestsService(deps: JoinRequestsDependencies) {
  return { ...askerSide(deps), ...deciderSide(deps) };
}

/** The owner and admins get an email naming the person (the app shows a count too). */
async function tellManagers(
  { repository, outbox }: Pick<JoinRequestsDependencies, "repository" | "outbox">,
  person: SignedInUser,
  workspace: { id: string; name: string },
): Promise<void> {
  for (const manager of await repository.managers(workspace.id)) {
    await outbox.enqueue({
      to: manager.email,
      template: { kind: "joinRequest", person: person.name, email: person.email, workspace: workspace.name },
    });
  }
}

function askerSide({
  repository,
  secrets,
  limiter,
  outbox,
  isMember,
  now = () => new Date(),
}: JoinRequestsDependencies) {
  /** Counts the try (per person and per address), then finds the workspace: 404 for anything wrong. */
  async function find({ user, address }: Asker, typed: string) {
    const waits = [
      await limiter.take(RATE_RULES.joinPerUser, user.id),
      await limiter.take(RATE_RULES.joinPerAddress, address),
    ];
    const wait = waits.find((seconds) => seconds !== undefined);
    if (wait !== undefined) throw tooManyAttempts(wait);
    const workspace = await repository.findByLookup(secrets.lookupFor(typed));
    if (!workspace) throw notValid();
    return { ...workspace, member: await isMember(workspace.id, user.id) };
  }

  return {
    async lookup(asker: Asker, typed: string) {
      const workspace = await find(asker, typed);
      const memberCount = await repository.memberCount(workspace.id);
      if (workspace.member)
        return { name: workspace.name, memberCount, alreadyMember: true, workspaceId: workspace.id };
      return { name: workspace.name, memberCount, alreadyMember: false };
    },
    /** "pending" for a new request; "alreadyMember" changes nothing (AC-F01-20). */
    async request(asker: Asker, typed: string) {
      const workspace = await find(asker, typed);
      if (workspace.member) return { status: "alreadyMember" as const, workspaceId: workspace.id };
      const cutoff = new Date(now().getTime() - EXPIRE_MS);
      const created = await repository.create(
        { workspaceId: workspace.id, userId: asker.user.id, via: workspace.via },
        cutoff,
      );
      if (!created)
        throw new AppError(409, "PENDING_REQUEST", "You already asked to join; the owner or an admin will answer.");
      await tellManagers({ repository, outbox }, asker.user, workspace);
      return { status: "pending" as const };
    },
  };
}

function deciderSide({ repository, outbox, now = () => new Date() }: JoinRequestsDependencies) {
  const cutoff = () => new Date(now().getTime() - EXPIRE_MS);

  return {
    async list(membership: Membership) {
      ensureAllowed(membership, "decideRequests");
      const rows = await repository.listPending(membership.workspaceId);
      const oldest = cutoff();
      return {
        requests: rows.map((row) => ({
          id: row.id,
          person: { id: row.personId, name: row.name, email: row.email },
          via: row.via,
          status: row.createdAt <= oldest ? ("expired" as const) : ("pending" as const),
          removedEarlier: row.removedEarlier,
          createdAt: row.createdAt.toISOString(),
        })),
      };
    },
    /** Decided once: a second decision answers 409 ALREADY_DECIDED; an old request 410 REQUEST_EXPIRED. */
    async decide(membership: Membership, requestId: string, outcome: DecisionOutcome): Promise<void> {
      ensureAllowed(membership, "decideRequests");
      const row = await repository.findRequest(membership.workspaceId, requestId);
      if (!row) throw new AppError(404, "NOT_FOUND", "Not found.");
      if (row.status !== "pending") throw alreadyDecided();
      if (row.createdAt <= cutoff()) throw new AppError(410, "REQUEST_EXPIRED", "This request has expired.");
      const request = { workspaceId: membership.workspaceId, requestId, userId: row.userId };
      if (!(await repository.decide(request, { outcome, decidedBy: membership.userId, at: now() })))
        throw alreadyDecided();
      await outbox.enqueue({
        to: row.email,
        template: { kind: "requestDecided", outcome, workspace: membership.name },
      });
    },
    /** The daily job (design.md section 10). */
    expireOld: () => repository.expireOlderThan(cutoff()),
  };
}

export type JoinRequestsService = ReturnType<typeof createJoinRequestsService>;
