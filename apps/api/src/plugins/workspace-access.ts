// Workspace access (security rule S2, F01 design.md section 5, AC-F01-31): every route with
// `:workspaceId` first loads the caller's membership of that workspace. Someone who isn't a member gets
// the same 404 as for a workspace that doesn't exist, so outsiders learn nothing. The check reads the
// database on every request, so a removed person's very next request is refused (AC-F01-23). It runs
// before the body is checked, so an outsider gets 404 whatever they send.
import type { FastifyRequest, preValidationAsyncHookHandler } from "fastify";
import type { Membership } from "../modules/workspaces/workspaces.permissions.ts";
import { AppError } from "./errors.ts";
import { signedInUser } from "./session.ts";

declare module "fastify" {
  interface FastifyRequest {
    membership?: Membership;
  }
}

export type MembershipLookup = (workspaceId: string, userId: string) => Promise<Membership | undefined>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new AppError(404, "NOT_FOUND", "Not found.");

/** A hook for a routes plugin: runs on its routes that have `:workspaceId`. */
export function workspaceAccess(lookup: MembershipLookup): preValidationAsyncHookHandler {
  return async (request) => {
    if (!request.routeOptions.url?.includes(":workspaceId")) return;
    const { workspaceId } = request.params as { workspaceId?: string };
    // A malformed id is just another workspace that doesn't exist.
    if (!workspaceId || !UUID.test(workspaceId)) throw notFound();
    const membership = await lookup(workspaceId, signedInUser(request).id);
    if (!membership) throw notFound();
    request.membership = membership;
  };
}

/** The caller's membership on a route behind `workspaceAccess`. */
export function memberOf(request: FastifyRequest): Membership {
  if (!request.membership) throw notFound();
  return request.membership;
}

/** An id in the address (`:userId`, `:invitationId`) that can't be anyone's is one that doesn't exist: 404. */
export function idParam(value: string): string {
  if (!UUID.test(value)) throw notFound();
  return value;
}
