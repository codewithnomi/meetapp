// What people do to chat messages during a call (F03 design.md section 8): edit, delete, react, pin.
// All take the meeting ticket (X-Meeting-Ticket); anything not allowed gets 404 (S1, S2).
import {
  chatMessageParamsSchema,
  chatMessageSchema,
  chatParamsSchema,
  editMessageBodySchema,
  meetingTicketHeadersSchema,
  pinBodySchema,
  pinnedListSchema,
  reactionBodySchema,
  reactionParamsSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FastifyRequest } from "fastify";
import { ticketOf } from "../../plugins/meeting-ticket.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ChatActionsService } from "./chat-actions.service.ts";

const tags = ["chat"];
const config = { access: "optional" as const };
const TICKET =
  "Needs the meeting ticket (X-Meeting-Ticket) of someone in this call whose role allows it; otherwise 404.";
const MESSAGE = "/api/v1/calls/:callId/chat/messages/:messageId";

const route = <S extends object>(summary: string, schema: S) => ({
  config,
  schema: { summary, description: TICKET, tags, headers: meetingTicketHeadersSchema, ...schema },
});

const on = (request: FastifyRequest<{ Params: { callId: string; messageId: string } }>) => ({
  callId: idParam(request.params.callId),
  ticketHash: ticketOf(request),
  messageId: idParam(request.params.messageId),
});
interface NoContent {
  status: (code: number) => { send: () => unknown };
}
const done = async (work: Promise<unknown>, reply: NoContent) => {
  await work;
  return reply.status(204).send();
};

export const chatActionsRoutes: FastifyPluginAsyncZod<{ actions: ChatActionsService }> = async (app, { actions }) => {
  app.patch(
    MESSAGE,
    route("Edit your own message", {
      params: chatMessageParamsSchema,
      body: editMessageBodySchema,
      response: { 200: chatMessageSchema },
    }),
    (request) => actions.edit(on(request), request.body.body),
  );
  app.delete(MESSAGE, route("Delete a message", { params: chatMessageParamsSchema }), (request, reply) =>
    done(actions.delete(on(request)), reply),
  );
  app.post(
    `${MESSAGE}/reactions`,
    route("React to a message", { params: chatMessageParamsSchema, body: reactionBodySchema }),
    (request, reply) => done(actions.react(on(request), request.body.emoji), reply),
  );
  app.delete(
    `${MESSAGE}/reactions/:emoji`,
    route("Take back a reaction (the emoji URL-encoded)", { params: reactionParamsSchema }),
    (request, reply) => done(actions.unreact(on(request), request.params.emoji), reply),
  );
  app.get(
    "/api/v1/calls/:callId/chat/pins",
    route("Pinned messages", { params: chatParamsSchema, response: { 200: pinnedListSchema } }),
    (request) => actions.pinned(idParam(request.params.callId), ticketOf(request)),
  );
  app.post(
    "/api/v1/calls/:callId/chat/pins",
    route("Pin a message for everyone", { params: chatParamsSchema, body: pinBodySchema }),
    (request, reply) =>
      done(
        actions.pin({
          callId: idParam(request.params.callId),
          ticketHash: ticketOf(request),
          messageId: idParam(request.body.messageId),
        }),
        reply,
      ),
  );
  app.delete(
    "/api/v1/calls/:callId/chat/pins/:messageId",
    route("Unpin a message", { params: chatMessageParamsSchema }),
    (request, reply) => done(actions.unpin(on(request)), reply),
  );
};
