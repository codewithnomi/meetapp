// Workspaces: business rules (F01 design.md section 5; AC-F01-14, 15, 21, 22, 23, 32). Callers come
// through plugins/workspace-access.ts, so `membership` is always the caller's own, already checked.
import type { MembersResponse, WorkspaceSettings, WorkspaceSummary } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import {
  allowedActions,
  ensureAllowed,
  ensureCompany,
  removalAction,
  roleChangeAction,
  type Membership,
} from "./workspaces.permissions.ts";
import type { WorkspacesRepository } from "./workspaces.repository.ts";

/** At most this many company workspaces owned at a time (AC-F01-15; plans in F10 may change it). */
const OWNED_WORKSPACE_LIMIT = 20;

const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");
const ownerUntouchable = () => new AppError(403, "FORBIDDEN", "Nobody can change or remove the owner.");
const limitReached = (who: "you" | "they") =>
  new AppError(
    409,
    "WORKSPACE_LIMIT",
    `${who === "you" ? "You" : "They"} can own at most ${String(OWNED_WORKSPACE_LIMIT)} workspaces.`,
  );

/** What other features do when someone stops being a member (F14: they leave the workspace's chats). */
export interface MembershipHooks {
  memberGone: (workspaceId: string, userId: string) => Promise<void>;
}

const NO_HOOKS: MembershipHooks = { memberGone: () => Promise.resolve() };

export function createWorkspacesService(repository: WorkspacesRepository, hooks: MembershipHooks = NO_HOOKS) {
  return { ...workspaceRules(repository), ...peopleRules(repository), ...departureRules(repository, hooks) };
}

/** Creating, renaming and listing. */
function workspaceRules(repository: WorkspacesRepository) {
  return {
    listForUser: (userId: string) => repository.listForUser(userId),
    async create(userId: string, name: string): Promise<{ workspace: WorkspaceSummary; switchTo: string }> {
      const workspace = await repository.createCompany(userId, name, OWNED_WORKSPACE_LIMIT);
      if (!workspace) throw limitReached("you");
      return { workspace, switchTo: workspace.id };
    },
    /** The guest and GIF switches: owner and admins (AC-F02-40, AC-F03-27). */
    async setSettings(membership: Membership, settings: WorkspaceSettings): Promise<void> {
      ensureAllowed(membership, "manageGuests");
      await repository.setSettings(membership.workspaceId, settings);
    },
    async rename(membership: Membership, name: string): Promise<void> {
      ensureAllowed(membership, "rename");
      await repository.rename(membership.workspaceId, name);
    },
    async members(membership: Membership): Promise<MembersResponse> {
      ensureAllowed(membership, "viewMembers");
      const rows = await repository.listMembers(membership.workspaceId);
      return {
        members: rows.map(({ avatarKey, joinedAt, ...member }) => ({
          ...member,
          joinedAt: joinedAt.toISOString(),
          photoUrl: avatarKey ? `/api/v1/users/${member.userId}/avatar?v=${avatarKey}` : null,
        })),
        yourActions: allowedActions(membership),
      };
    },
  };
}

/** Roles, removal, leaving and the hand-over. */
/** The other person's current role here; 404 when they aren't a member. */
async function targetRole(repository: WorkspacesRepository, membership: Membership, userId: string) {
  const role = await repository.memberRole(membership.workspaceId, userId);
  if (role === undefined) throw notFound();
  return role;
}

function peopleRules(repository: WorkspacesRepository) {
  return {
    async changeRole(membership: Membership, userId: string, role: "admin" | "member"): Promise<void> {
      ensureCompany(membership);
      const current = await targetRole(repository, membership, userId);
      const action = roleChangeAction(current);
      if (!action) throw ownerUntouchable();
      ensureAllowed(membership, action);
      if (!(await repository.setRole(membership.workspaceId, userId, current, role))) throw notFound();
    },
    async transfer(membership: Membership, userId: string): Promise<void> {
      ensureAllowed(membership, "transfer");
      if (userId === membership.userId) throw new AppError(400, "BAD_REQUEST", "Choose another member.");
      const outcome = await repository.transfer(
        membership.workspaceId,
        membership.userId,
        userId,
        OWNED_WORKSPACE_LIMIT,
      );
      if (outcome === "not-owner") throw new AppError(403, "FORBIDDEN", "Your role doesn't allow this.");
      if (outcome === "not-member") throw notFound();
      if (outcome === "limit") throw limitReached("they");
    },
  };
}

export type WorkspacesService = ReturnType<typeof createWorkspacesService>;

/** Removing someone and leaving: other features hear about it (F14: chats, AC-F14-34). */
function departureRules(repository: WorkspacesRepository, hooks: MembershipHooks) {
  return {
    async remove(membership: Membership, userId: string): Promise<void> {
      ensureCompany(membership);
      const current = await targetRole(repository, membership, userId);
      const action = removalAction(current);
      if (!action) throw ownerUntouchable();
      ensureAllowed(membership, action);
      const removed = await repository.remove(membership.workspaceId, userId, current, membership.userId);
      if (!removed) throw notFound();
      await hooks.memberGone(membership.workspaceId, userId);
    },
    async leave(membership: Membership): Promise<void> {
      ensureCompany(membership);
      if (membership.role === "owner") {
        throw new AppError(409, "OWNER_MUST_TRANSFER", "Hand the workspace over to someone else before leaving.");
      }
      ensureAllowed(membership, "leave");
      // Nothing removed: they were removed meanwhile, or made the owner by a hand-over just now.
      if (!(await repository.leave(membership.workspaceId, membership.userId))) throw notFound();
      await hooks.memberGone(membership.workspaceId, membership.userId);
    },
  };
}
