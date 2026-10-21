// Group chats (F14 design.md 3.6 and 5; AC-F14-14–18): rename, add people with a history choice, remove
// anyone, leave. Only accepted members of the group; anyone else gets the same 404 as for a chat that
// doesn't exist (AC-F14-31).
import {
  addPeopleBodySchema,
  chatMemberParamsSchema,
  conversationParamsSchema,
  renameBodySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ChatsGroupsService } from "./chats-groups.service.ts";

const tags = ["chats"];
const MEMBERS_ONLY = "Any accepted member of the group (as in Teams); anyone else gets 404.";

const RENAME = {
  schema: {
    summary: "Name or rename a group chat",
    description: MEMBERS_ONLY,
    tags,
    params: conversationParamsSchema,
    body: renameBodySchema,
  },
};
const ADD = {
  schema: {
    summary: "Add people to a group chat",
    description: `${MEMBERS_ONLY} History: none, the last 1–365 days, or all (default). People from outside get a request. Past 250 people: 409 CHAT_GROUP_FULL.`,
    tags,
    params: conversationParamsSchema,
    body: addPeopleBodySchema,
  },
};
const REMOVE = {
  schema: {
    summary: "Remove someone from a group chat",
    description: MEMBERS_ONLY,
    tags,
    params: chatMemberParamsSchema,
  },
};
const LEAVE = {
  schema: { summary: "Leave a group chat", description: MEMBERS_ONLY, tags, params: conversationParamsSchema },
};

export const chatsGroupsRoutes: FastifyPluginAsyncZod<{ groups: ChatsGroupsService }> = async (app, { groups }) => {
  app.patch("/api/v1/conversations/:conversationId", RENAME, async (request, reply) => {
    await groups.rename(signedInUser(request).id, idParam(request.params.conversationId), request.body.name);
    return reply.status(204).send();
  });
  app.post("/api/v1/conversations/:conversationId/members", ADD, async (request, reply) => {
    await groups.addPeople(signedInUser(request).id, idParam(request.params.conversationId), request.body);
    return reply.status(204).send();
  });
  app.delete("/api/v1/conversations/:conversationId/members/:userId", REMOVE, async (request, reply) => {
    const id = idParam(request.params.conversationId);
    await groups.remove(signedInUser(request).id, id, request.params.userId);
    return reply.status(204).send();
  });
  app.post("/api/v1/conversations/:conversationId/leave", LEAVE, async (request, reply) => {
    await groups.leave(signedInUser(request).id, idParam(request.params.conversationId));
    return reply.status(204).send();
  });
};
