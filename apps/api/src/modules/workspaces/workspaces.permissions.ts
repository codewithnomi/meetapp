// Who may do what in a workspace (F01 design.md section 5, AC-F01-21, 32). The one place role checks
// live: every service asks here, and a refusal is 403 FORBIDDEN.
import type { MemberRole, WorkspaceAction } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";

const EVERYONE: readonly MemberRole[] = ["owner", "admin", "member"];
const OWNER_AND_ADMINS: readonly MemberRole[] = ["owner", "admin"];
const OWNER_ONLY: readonly MemberRole[] = ["owner"];

/** The design's table, row by row. Every action must have a row (the type makes a missing one an error). */
export const ROLE_TABLE: Record<WorkspaceAction, readonly MemberRole[]> = {
  viewMembers: EVERYONE,
  copyJoinLink: EVERYONE,
  inviteMember: EVERYONE,
  inviteAdmin: OWNER_AND_ADMINS,
  cancelAnyInvitation: OWNER_AND_ADMINS,
  cancelOwnInvitation: EVERYONE,
  manageJoinLink: OWNER_AND_ADMINS,
  decideRequests: OWNER_AND_ADMINS,
  rename: OWNER_AND_ADMINS,
  promoteMember: OWNER_AND_ADMINS,
  removeMember: OWNER_AND_ADMINS,
  demoteAdmin: OWNER_ONLY,
  removeAdmin: OWNER_ONLY,
  transfer: OWNER_ONLY,
  // The owner hands over first (409 OWNER_MUST_TRANSFER).
  leave: ["admin", "member"],
};

/** Not allowed in a personal workspace at all (AC-F01-14): 409 PERSONAL_WORKSPACE. */
const NOT_IN_PERSONAL = new Set<WorkspaceAction>([
  "copyJoinLink",
  "inviteMember",
  "inviteAdmin",
  "cancelAnyInvitation",
  "cancelOwnInvitation",
  "manageJoinLink",
  "decideRequests",
  "rename",
  "promoteMember",
  "removeMember",
  "demoteAdmin",
  "removeAdmin",
  "transfer",
  "leave",
]);

export interface Membership {
  workspaceId: string;
  userId: string;
  name: string;
  kind: "personal" | "company";
  role: MemberRole;
}

export function can(role: MemberRole | undefined, action: WorkspaceAction): boolean {
  return role !== undefined && ROLE_TABLE[action].includes(role);
}

/** 409 PERSONAL_WORKSPACE: only company workspaces have other people, names to change and owners to swap. */
export function ensureCompany(membership: Membership): void {
  if (membership.kind === "personal") {
    throw new AppError(409, "PERSONAL_WORKSPACE", "This can't be done in your personal workspace.");
  }
}

/** Refuses with 409 in a personal workspace and 403 when the role doesn't allow it. */
export function ensureAllowed(membership: Membership, action: WorkspaceAction): void {
  if (NOT_IN_PERSONAL.has(action)) ensureCompany(membership);
  if (!can(membership.role, action)) throw new AppError(403, "FORBIDDEN", "Your role doesn't allow this.");
}

/** What the caller may do here, so the app offers only those (TC-F01-55). */
export function allowedActions(membership: Membership): WorkspaceAction[] {
  return (Object.keys(ROLE_TABLE) as WorkspaceAction[]).filter(
    (action) => can(membership.role, action) && !(membership.kind === "personal" && NOT_IN_PERSONAL.has(action)),
  );
}

/** Changing someone's role is decided by the role they have now; nobody can change the owner. */
export function roleChangeAction(targetRole: MemberRole): WorkspaceAction | undefined {
  if (targetRole === "owner") return undefined;
  return targetRole === "admin" ? "demoteAdmin" : "promoteMember";
}

/** Removing someone is decided by their role; nobody can remove the owner. */
export function removalAction(targetRole: MemberRole): WorkspaceAction | undefined {
  if (targetRole === "owner") return undefined;
  return targetRole === "admin" ? "removeAdmin" : "removeMember";
}
