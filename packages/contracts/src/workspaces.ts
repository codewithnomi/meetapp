// Workspaces, roles and members (F01 design.md sections 5 and 8; AC-F01-14, 15, 21, 22, 23).
import { z } from "zod";

export const WORKSPACE_KINDS = ["personal", "company"] as const;
export const MEMBER_ROLES = ["owner", "admin", "member"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

/** 2–60 characters after trimming; two workspaces may share a name (AC-F01-15). */
export const workspaceNameSchema = z.string().trim().min(2).max(60);

/** A workspace as one of its members sees it, with that member's role and its guest switch (AC-F02-40). */
export const workspaceSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    kind: z.enum(WORKSPACE_KINDS),
    role: z.enum(MEMBER_ROLES),
    allowGuests: z.boolean(),
    /** GIFs in meeting chat (AC-F03-27). */
    allowGifs: z.boolean(),
    /** Chat with people outside the workspace (AC-F14-27). */
    allowOutsideChat: z.boolean(),
  })
  .meta({ id: "Workspace" });

export type WorkspaceSummary = z.infer<typeof workspaceSchema>;

export const createWorkspaceBodySchema = z.object({ name: workspaceNameSchema }).meta({ id: "CreateWorkspace" });

/** The `Idempotency-Key` header: the same key within 10 minutes returns the first result (AC-F01-29). */
export const idempotencyHeadersSchema = z.object({
  "idempotency-key": z
    .string()
    .regex(/^[A-Za-z0-9_-]{8,100}$/)
    .optional(),
});

/** The creator is the owner; `switchTo` tells the app to open the new workspace (AC-F01-15). */
export const workspaceCreatedSchema = z
  .object({ workspace: workspaceSchema, switchTo: z.uuid() })
  .meta({ id: "WorkspaceCreated" });

export const renameWorkspaceBodySchema = z.object({ name: workspaceNameSchema }).meta({ id: "RenameWorkspace" });

/** The `:workspaceId` (and `:userId`) in an address; anything that isn't a member's workspace is 404 (AC-F01-31). */
export const workspaceParamsSchema = z.object({ workspaceId: z.string() });
export const memberParamsSchema = z.object({ workspaceId: z.string(), userId: z.string() });

/**
 * Everything the caller's role allows in this workspace (design.md section 5), so the app offers only
 * those. The server checks every action again on its own (AC-F01-32).
 */
export const WORKSPACE_ACTIONS = [
  "viewMembers",
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
  // F02: switch guests on or off for the workspace's meetings (AC-F02-40).
  "manageGuests",
] as const;
export type WorkspaceAction = (typeof WORKSPACE_ACTIONS)[number];

/** One person in the member list (AC-F01-21, D046). `photoUrl` is empty without a photo. */
const memberSchema = z
  .object({
    userId: z.uuid(),
    name: z.string(),
    email: z.string(),
    role: z.enum(MEMBER_ROLES),
    joinedAt: z.iso.datetime(),
    photoUrl: z.string().nullable(),
  })
  .meta({ id: "Member" });

export const membersResponseSchema = z
  .object({ members: z.array(memberSchema), yourActions: z.array(z.enum(WORKSPACE_ACTIONS)) })
  .meta({ id: "Members" });

export type MembersResponse = z.infer<typeof membersResponseSchema>;

/** Nobody can be made the owner this way: that is the hand-over (AC-F01-22). */
export const changeRoleBodySchema = z.object({ role: z.enum(["admin", "member"]) }).meta({ id: "ChangeRole" });

/** `confirm` is the app's confirmation step (AC-F01-22). */
export const transferBodySchema = z
  .object({ userId: z.uuid(), confirm: z.literal(true) })
  .meta({ id: "TransferOwnership" });
