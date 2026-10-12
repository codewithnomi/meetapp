// Workspaces, roles and members (F01 design.md section 8). Routes with `:workspaceId` answer 404 to
// anyone who isn't a member (plugins/workspace-access.ts); the role table decides the rest (403).
import {
  changeRoleBodySchema,
  createWorkspaceBodySchema,
  idempotencyHeadersSchema,
  memberParamsSchema,
  membersResponseSchema,
  renameWorkspaceBodySchema,
  transferBodySchema,
  workspaceCreatedSchema,
  workspaceParamsSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { Idempotency } from "../../plugins/idempotency.ts";
import { signedInUser } from "../../plugins/session.ts";
import { memberOf, idParam, workspaceAccess, type MembershipLookup } from "../../plugins/workspace-access.ts";
import type { WorkspacesService } from "./workspaces.service.ts";

const tags = ["workspaces"];
const NOT_A_MEMBER = "404 when the caller isn't a member (the same as for a workspace that doesn't exist).";

const CREATE = {
  schema: {
    summary: "Create a company workspace",
    description:
      "The caller becomes its owner. At most 20 owned at a time (409 WORKSPACE_LIMIT). Send an Idempotency-Key header: the same key within 10 minutes returns the first result.",
    tags,
    headers: idempotencyHeadersSchema,
    body: createWorkspaceBodySchema,
    response: { 201: workspaceCreatedSchema },
  },
};

const RENAME = {
  schema: {
    summary: "Rename a workspace",
    description: `Owner and admins. 409 PERSONAL_WORKSPACE for the personal workspace. ${NOT_A_MEMBER}`,
    tags,
    params: workspaceParamsSchema,
    body: renameWorkspaceBodySchema,
  },
};

const MEMBERS = {
  schema: {
    summary: "List the members",
    description: `Name, photo, email, role and join date of everyone, plus what the caller's role allows. ${NOT_A_MEMBER}`,
    tags,
    params: workspaceParamsSchema,
    response: { 200: membersResponseSchema },
  },
};

const CHANGE_ROLE = {
  schema: {
    summary: "Make a member an admin, or an admin a member",
    description: `Owner and admins can make a member an admin; only the owner can make an admin a member. Nobody can change the owner (403). ${NOT_A_MEMBER}`,
    tags,
    params: memberParamsSchema,
    body: changeRoleBodySchema,
  },
};

const REMOVE = {
  schema: {
    summary: "Remove someone from the workspace",
    description: `Owner and admins can remove members; only the owner can remove admins. Nobody can remove the owner (403). Their next request here is refused at once. ${NOT_A_MEMBER}`,
    tags,
    params: memberParamsSchema,
  },
};

const LEAVE = {
  schema: {
    summary: "Leave the workspace",
    description: `Admins and members. The owner hands over first (409 OWNER_MUST_TRANSFER). ${NOT_A_MEMBER}`,
    tags,
    params: workspaceParamsSchema,
  },
};

const TRANSFER = {
  schema: {
    summary: "Hand the workspace over to another member",
    description: `Owner only, with confirm: true. The new owner takes over; the old owner becomes an admin. ${NOT_A_MEMBER}`,
    tags,
    params: workspaceParamsSchema,
    body: transferBodySchema,
  },
};

export const workspacesRoutes: FastifyPluginAsyncZod<{
  workspaces: WorkspacesService;
  lookup: MembershipLookup;
  idempotency: Idempotency;
}> = async (app, { workspaces, lookup, idempotency }) => {
  app.addHook("preValidation", workspaceAccess(lookup));

  app.post("/api/v1/workspaces", CREATE, async (request, reply) => {
    const { id } = signedInUser(request);
    const created = await idempotency.once(`workspaces:${id}`, request.headers["idempotency-key"], () =>
      workspaces.create(id, request.body.name),
    );
    return reply.status(201).send(created);
  });

  app.patch("/api/v1/workspaces/:workspaceId", RENAME, async (request, reply) => {
    await workspaces.rename(memberOf(request), request.body.name);
    return reply.status(204).send();
  });

  app.get("/api/v1/workspaces/:workspaceId/members", MEMBERS, async (request) => workspaces.members(memberOf(request)));

  app.patch("/api/v1/workspaces/:workspaceId/members/:userId", CHANGE_ROLE, async (request, reply) => {
    await workspaces.changeRole(memberOf(request), idParam(request.params.userId), request.body.role);
    return reply.status(204).send();
  });

  app.delete("/api/v1/workspaces/:workspaceId/members/:userId", REMOVE, async (request, reply) => {
    await workspaces.remove(memberOf(request), idParam(request.params.userId));
    return reply.status(204).send();
  });

  app.post("/api/v1/workspaces/:workspaceId/leave", LEAVE, async (request, reply) => {
    await workspaces.leave(memberOf(request));
    return reply.status(204).send();
  });

  app.post("/api/v1/workspaces/:workspaceId/transfer", TRANSFER, async (request, reply) => {
    await workspaces.transfer(memberOf(request), request.body.userId);
    return reply.status(204).send();
  });
};
