// Join link, join code and requests to join (F01 design.md sections 5 and 8; AC-F01-19, 20).
import { z } from "zod";

/** What any member may copy while it is on; both empty while off. */
export const joinLinkSchema = z
  .object({ enabled: z.boolean(), link: z.url().nullable(), code: z.string().nullable() })
  .meta({ id: "JoinLink" });

/** Turning on makes a new link and code; turning off stops the old ones at once. */
export const setJoinLinkBodySchema = z.object({ enabled: z.boolean() }).meta({ id: "SetJoinLink" });

/** The whole link as copied, or the 10-character code (spaces, dashes and case don't matter). */
export const linkOrCodeBodySchema = z
  .object({ linkOrCode: z.string().trim().min(1).max(500) })
  .meta({ id: "LinkOrCode" });

/**
 * Only the name and size for someone outside (AC-F01-19). A member gets `alreadyMember` and the
 * workspace id, so the app opens it with "You're already a member" (AC-F01-20).
 */
export const joinLookupResponseSchema = z
  .object({
    name: z.string(),
    memberCount: z.number().int(),
    alreadyMember: z.boolean(),
    workspaceId: z.uuid().optional(),
  })
  .meta({ id: "JoinLookup" });

export const joinRequestResponseSchema = z
  .object({ status: z.enum(["pending", "alreadyMember"]), workspaceId: z.uuid().optional() })
  .meta({ id: "JoinRequestSent" });

/** A request as the owner and admins see it. `expired` once 14 days old, even before the daily job. */
const pendingRequestSchema = z
  .object({
    id: z.uuid(),
    person: z.object({ id: z.uuid(), name: z.string(), email: z.string() }),
    via: z.enum(["link", "code"]),
    status: z.enum(["pending", "expired"]),
    /** The person was removed from this workspace before (the "removed earlier" badge). */
    removedEarlier: z.boolean(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: "JoinRequest" });

export const joinRequestsResponseSchema = z
  .object({ requests: z.array(pendingRequestSchema) })
  .meta({ id: "JoinRequests" });

export const joinRequestParamsSchema = z.object({ workspaceId: z.string(), requestId: z.string() });
