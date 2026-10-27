// Calls from chats (F15 design.md section 5): start or join the chat's call, see whether one is running.
// Signed in; the chat's membership and read-only rules are checked by the service on every request.
import {
  callParamsSchema,
  conversationParamsSchema,
  joinedSchema,
  runningCallSchema,
  startCallBodySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ChatCallsService } from "./chat-calls.service.ts";

const tags = ["calls"];

const START = {
  schema: {
    summary: "Start a call from a chat (or join the one running)",
    description:
      "Video or audio. The caller joins at once (no lobby); the chat's other members are rung (none in a group of more than 20). A call already running is joined instead, ringing nobody. 403 CHAT_READ_ONLY in a read-only chat, 409 CALL_FULL at 20 people; others get 404.",
    tags,
    params: conversationParamsSchema,
    body: startCallBodySchema,
    response: { 201: joinedSchema },
  },
};

export const chatCallsRoutes: FastifyPluginAsyncZod<{ chatCalls: ChatCallsService }> = async (app, { chatCalls }) => {
  app.post("/api/v1/conversations/:conversationId/calls", START, async (request, reply) => {
    const answer = await chatCalls.start(
      signedInUser(request).id,
      idParam(request.params.conversationId),
      request.body.media,
    );
    return reply.code(201).send(answer);
  });
  app.get(
    "/api/v1/conversations/:conversationId/call",
    {
      schema: {
        summary: "The chat's running call, for Join",
        description: "None when no call runs. Only for people who may call in this chat; others get 404.",
        tags,
        params: conversationParamsSchema,
        response: { 200: runningCallSchema },
      },
    },
    async (request) => chatCalls.running(signedInUser(request).id, idParam(request.params.conversationId)),
  );
  app.post(
    "/api/v1/calls/:callId/join",
    {
      schema: {
        summary: "Join a chat's running call",
        description:
          "From Join in the chat. Membership is checked now. 409 CALL_ENDED when it ended meanwhile, 409 CALL_FULL at 20 people.",
        tags,
        params: callParamsSchema,
        response: { 200: joinedSchema },
      },
    },
    async (request) => chatCalls.join(signedInUser(request).id, idParam(request.params.callId)),
  );
};
