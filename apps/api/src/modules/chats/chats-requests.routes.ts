// Chat requests and blocking (F14 design.md 3.7 and 5; AC-F14-10–13). Only the person asked can see,
// accept or delete a request; anyone else gets the same 404 as for a chat that doesn't exist (AC-F14-31).
import {
  blockBodySchema,
  blockedParamsSchema,
  blockedPeopleSchema,
  chatRequestsSchema,
  conversationParamsSchema,
  declineBodySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ChatsRequestsService } from "./chats-requests.service.ts";

const tags = ["chats"];
const ONLY_ASKED = "Only the person asked; anyone else, or a request older than 30 days, gets 404.";

const REQUESTS = {
  schema: {
    summary: "Chat requests waiting for me",
    description: "Requests from people outside your workspaces, with up to 10 messages to preview.",
    tags,
    response: { 200: chatRequestsSchema },
  },
};
const ACCEPT = {
  schema: { summary: "Accept a chat request", description: ONLY_ASKED, tags, params: conversationParamsSchema },
};
const DECLINE = {
  schema: {
    summary: "Delete a chat request (and maybe block)",
    description: `${ONLY_ASKED} The sender isn't told and can't ask again for 30 days.`,
    tags,
    params: conversationParamsSchema,
    body: declineBodySchema,
  },
};
const BLOCKED = {
  schema: { summary: "People I blocked", tags, response: { 200: blockedPeopleSchema } },
};
const BLOCK = {
  schema: {
    summary: "Block a person outside my workspaces",
    description: "Colleagues in a shared team workspace can't be blocked (400).",
    tags,
    body: blockBodySchema,
  },
};
const UNBLOCK = { schema: { summary: "Unblock a person", tags, params: blockedParamsSchema } };

export const chatsRequestsRoutes: FastifyPluginAsyncZod<{ requests: ChatsRequestsService }> = async (
  app,
  { requests },
) => {
  app.get("/api/v1/me/chat-requests", REQUESTS, (request) => requests.waitingFor(signedInUser(request).id));
  app.post("/api/v1/conversations/:conversationId/accept", ACCEPT, async (request, reply) => {
    await requests.accept(signedInUser(request).id, idParam(request.params.conversationId));
    return reply.status(204).send();
  });
  app.post("/api/v1/conversations/:conversationId/decline", DECLINE, async (request, reply) => {
    const id = idParam(request.params.conversationId);
    await requests.decline(signedInUser(request).id, id, request.body.block);
    return reply.status(204).send();
  });
  app.get("/api/v1/me/blocked", BLOCKED, (request) => requests.blocked(signedInUser(request).id));
  app.post("/api/v1/me/blocked", BLOCK, async (request, reply) => {
    await requests.block(signedInUser(request).id, request.body.userId);
    return reply.status(204).send();
  });
  app.delete("/api/v1/me/blocked/:userId", UNBLOCK, async (request, reply) => {
    await requests.unblock(signedInUser(request).id, request.params.userId);
    return reply.status(204).send();
  });
};
