// Email invitations: business rules (F01 design.md section 5; AC-F01-17, 18). The link's token is 32
// random bytes; only its SHA-256 is stored, valid 7 days. Only the invited, verified email can join,
// and an admin invitation becomes a member one if the sender is no longer the owner or an admin.
import { createHash, randomBytes } from "node:crypto";
import type { MemberRole, WorkspaceSummary } from "@meetapp/contracts";
import type { Outbox } from "../../emails/outbox.ts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import { can, ensureAllowed, type Membership } from "../workspaces/workspaces.permissions.ts";
import type { InvitationsRepository } from "./invitations.repository.ts";
import type { InvitationPage } from "./page/invitation-page.ts";

const VALID_MS = 7 * 24 * 60 * 60 * 1_000;

export interface InvitationsDependencies {
  repository: InvitationsRepository;
  /** The sender's role in the workspace now (re-checked when an admin invitation is accepted). */
  memberRole: (workspaceId: string, userId: string) => Promise<MemberRole | undefined>;
  limiter: RateLimiter;
  outbox: Outbox;
  /** The backend's address as browsers reach it (APP_PUBLIC_URL), for the link in the email. */
  publicUrl: string;
  now?: () => Date;
}

interface Sender {
  id: string;
  name: string;
}

type InvitationRow = Awaited<ReturnType<InvitationsRepository["listPending"]>>[number];

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");
const gone = () => new AppError(410, "INVITATION_GONE", "This invitation is no longer valid; ask for a new one.");

function sentView(row: InvitationRow) {
  return {
    id: row.id,
    email: row.email,
    role: row.role === "admin" ? ("admin" as const) : ("member" as const),
    invitedBy: row.invitedById && row.invitedByName !== null ? { id: row.invitedById, name: row.invitedByName } : null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

/** 50 invitation emails per sender per day, across all workspaces (AC-F01-17). */
async function countInvitationEmail(limiter: RateLimiter, senderId: string): Promise<void> {
  const retryAfter = await limiter.take(RATE_RULES.invitationEmails, senderId);
  if (retryAfter !== undefined) {
    throw new AppError(429, "TOO_MANY_ATTEMPTS", "Invite limit reached, try again tomorrow.", retryAfter);
  }
}

export function createInvitationsService(deps: InvitationsDependencies) {
  return { ...workspaceSide(deps), ...inviteeSide(deps) };
}

/** Stores the invitation (replacing a pending one) and emails its link. */
async function issue(
  deps: InvitationsDependencies,
  {
    membership,
    sender,
    email,
    role,
  }: { membership: Membership; sender: Sender; email: string; role: "admin" | "member" },
) {
  const token = randomBytes(32).toString("base64url");
  const now = deps.now ?? (() => new Date());
  const row = await deps.repository.create({
    workspaceId: membership.workspaceId,
    email,
    role,
    tokenHash: hashToken(token),
    invitedBy: sender.id,
    expiresAt: new Date(now().getTime() + VALID_MS),
  });
  const link = `${deps.publicUrl}/invite/${token}`;
  await deps.outbox.enqueue({
    to: email,
    template: { kind: "invitation", inviter: sender.name, workspace: membership.name, role, email, link },
  });
  return { invitation: sentView({ ...row, invitedById: sender.id, invitedByName: sender.name }) };
}

/** Invite, list, cancel and send again, inside a workspace the caller belongs to. */
function workspaceSide(deps: InvitationsDependencies) {
  const { repository, limiter } = deps;
  const now = deps.now ?? (() => new Date());

  async function invite(membership: Membership, sender: Sender, body: { email: string; role: "admin" | "member" }) {
    ensureAllowed(membership, body.role === "admin" ? "inviteAdmin" : "inviteMember");
    if (await repository.isMemberByEmail(membership.workspaceId, body.email)) {
      throw new AppError(409, "ALREADY_MEMBER", `${body.email} is already a member`);
    }
    await countInvitationEmail(limiter, sender.id);
    return issue(deps, { membership, sender, ...body });
  }

  /** The invitation, if the caller may cancel or resend it: the owner and admins any, others their own. */
  async function ownedOrManaged(membership: Membership, invitationId: string) {
    ensureAllowed(membership, "cancelOwnInvitation");
    const row = await repository.findPending(membership.workspaceId, invitationId, now());
    if (!row) throw notFound();
    const allowed = can(membership.role, "cancelAnyInvitation") || row.invitedById === membership.userId;
    if (!allowed) throw new AppError(403, "FORBIDDEN", "Your role doesn't allow this.");
    return row;
  }

  return {
    invite,
    async listSent(membership: Membership) {
      ensureAllowed(membership, "cancelOwnInvitation");
      const sentBy = can(membership.role, "cancelAnyInvitation") ? undefined : membership.userId;
      return { invitations: (await repository.listPending(membership.workspaceId, now(), sentBy)).map(sentView) };
    },
    async cancel(membership: Membership, invitationId: string): Promise<void> {
      await ownedOrManaged(membership, invitationId);
      if (!(await repository.close(invitationId, "cancelled"))) throw notFound();
    },
    /** A new link and email for the same address and role; the old link stops. */
    async resend(membership: Membership, sender: Sender, invitationId: string) {
      const row = await ownedOrManaged(membership, invitationId);
      return invite(membership, sender, { email: row.email, role: sentView(row).role });
    },
  };
}

/** The invited person's side: their list, join and decline. */
function inviteeSide({ repository, memberRole, limiter, now = () => new Date() }: InvitationsDependencies) {
  /** Theirs and still usable; 404 if it isn't for their verified email, 410 if it can't be used now. */
  async function usable(userId: string, invitationId: string) {
    const row = await repository.findForUser(invitationId, userId);
    if (!row) throw notFound();
    if (row.status !== "pending" || row.expiresAt <= now()) throw gone();
    return row;
  }

  return {
    async mine(userId: string) {
      const rows = await repository.listForUser(userId, now());
      return {
        invitations: rows.map((row) => ({
          id: row.id,
          workspace: { id: row.workspaceId, name: row.workspaceName },
          inviterName: row.inviterName,
          role: row.role === "admin" ? ("admin" as const) : ("member" as const),
          expiresAt: row.expiresAt.toISOString(),
        })),
      };
    },
    async accept(userId: string, invitationId: string): Promise<{ workspace: WorkspaceSummary; switchTo: string }> {
      const row = await usable(userId, invitationId);
      const senderRole = row.invitedBy === null ? undefined : await memberRole(row.workspaceId, row.invitedBy);
      const role = row.role === "admin" && can(senderRole, "inviteAdmin") ? "admin" : "member";
      if (!(await repository.accept(invitationId, { workspaceId: row.workspaceId, userId, role }))) throw gone();
      const joined = (await memberRole(row.workspaceId, userId)) ?? role;
      const { workspaceId: id, workspaceName: name, allowGuests, allowGifs } = row;
      return { workspace: { id, name, kind: "company" as const, role: joined, allowGuests, allowGifs }, switchTo: id };
    },
    /** What the web page shows for a link's token (AC-F01-18): the same "invalid" for every unusable one. */
    async page(token: string, address: string): Promise<InvitationPage> {
      // 60 views an hour per network address (design.md section 9).
      if ((await limiter.take(RATE_RULES.invitationPage, address)) !== undefined) return { page: "busy" };
      const row = await repository.findByTokenHash(hashToken(token));
      if (!row || row.status !== "pending" || row.expiresAt <= now()) return { page: "invalid" };
      return { page: "valid", workspaceName: row.workspaceName, inviterName: row.inviterName, email: row.email };
    },
    async decline(userId: string, invitationId: string): Promise<void> {
      await usable(userId, invitationId);
      if (!(await repository.close(invitationId, "declined"))) throw gone();
    },
  };
}

export type InvitationsService = ReturnType<typeof createInvitationsService>;
