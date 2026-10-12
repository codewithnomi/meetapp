// Email invitations (F01 design.md sections 5 and 8; AC-F01-17, 18).
import { z } from "zod";
import { workspaceSchema } from "./workspaces.ts";

/** Trimmed and lower-cased before it is stored or matched. */
const invitedEmail = z.string().trim().toLowerCase().pipe(z.email().max(254));

/** Members may invite only as member; the owner and admins also as admin. */
export const inviteBodySchema = z
  .object({ email: invitedEmail, role: z.enum(["admin", "member"]).default("member") })
  .meta({ id: "Invite" });

/** A pending invitation as the workspace sees it. `invitedBy` is empty if that account was deleted. */
const sentInvitationSchema = z
  .object({
    id: z.uuid(),
    email: z.string(),
    role: z.enum(["admin", "member"]),
    invitedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: "SentInvitation" });

export const sentInvitationsResponseSchema = z
  .object({ invitations: z.array(sentInvitationSchema) })
  .meta({ id: "SentInvitations" });

export const invitationCreatedSchema = z.object({ invitation: sentInvitationSchema }).meta({ id: "InvitationCreated" });

export const invitationParamsSchema = z.object({ workspaceId: z.string(), invitationId: z.string() });
export const myInvitationParamsSchema = z.object({ invitationId: z.string() });

/** An invitation for the signed-in person's own email (AC-F01-18). */
const myInvitationSchema = z
  .object({
    id: z.uuid(),
    workspace: z.object({ id: z.uuid(), name: z.string() }),
    inviterName: z.string().nullable(),
    role: z.enum(["admin", "member"]),
    expiresAt: z.iso.datetime(),
  })
  .meta({ id: "MyInvitation" });

export const myInvitationsResponseSchema = z
  .object({ invitations: z.array(myInvitationSchema) })
  .meta({ id: "MyInvitations" });

/** Joined: the workspace with the role they got; `switchTo` lets the app open it. */
export const invitationAcceptedSchema = z
  .object({ workspace: workspaceSchema, switchTo: z.uuid() })
  .meta({ id: "InvitationAccepted" });
