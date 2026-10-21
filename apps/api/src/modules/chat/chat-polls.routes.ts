// Polls in meeting chat during a call (F03 design.md section 8). All take the meeting ticket
// (X-Meeting-Ticket); anything not allowed gets 404 (S1, S2).
import {
  chatParamsSchema,
  createPollBodySchema,
  pollParamsSchema,
  pollSchema,
  voteBodySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FastifyRequest } from "fastify";
import { chatRoute } from "./chat-route.ts";
import { ticketOf } from "../../plugins/meeting-ticket.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ChatPollsService } from "./chat-polls.service.ts";

const POLL = "/api/v1/calls/:callId/chat/polls/:pollId";

const on = (request: FastifyRequest<{ Params: { callId: string; pollId: string } }>) => ({
  callId: idParam(request.params.callId),
  ticketHash: ticketOf(request),
  pollId: idParam(request.params.pollId),
});

export const chatPollsRoutes: FastifyPluginAsyncZod<{ polls: ChatPollsService }> = async (app, { polls }) => {
  app.post(
    "/api/v1/calls/:callId/chat/polls",
    chatRoute("Create a poll (organizer, co-organizers, presenters)", {
      params: chatParamsSchema,
      body: createPollBodySchema,
      response: { 200: pollSchema },
    }),
    (request) => polls.create(idParam(request.params.callId), ticketOf(request), request.body),
  );
  app.get(
    POLL,
    chatRoute("A poll, with results if you may see them", { params: pollParamsSchema, response: { 200: pollSchema } }),
    (request) => polls.get(on(request)),
  );
  app.put(
    `${POLL}/vote`,
    chatRoute("Vote, or change your vote", {
      params: pollParamsSchema,
      body: voteBodySchema,
      response: { 200: pollSchema },
    }),
    (request) => polls.vote(on(request), request.body.optionIds),
  );
  app.post(`${POLL}/close`, chatRoute("Close a poll", { params: pollParamsSchema }), async (request, reply) => {
    await polls.close(on(request));
    return reply.status(204).send();
  });
};
