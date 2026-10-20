// Meeting chat endpoints during a call (F03 design.md section 8). All take the meeting ticket
// (X-Meeting-Ticket); anything not allowed gets the same 404 as a call that doesn't exist (S1, S2).
import {
  chatMessageParamsSchema,
  chatMessageSchema,
  chatParamsSchema,
  eventsPageSchema,
  eventsQuerySchema,
  meetingTicketHeadersSchema,
  messagesPageSchema,
  messagesQuerySchema,
  sendMessageBodySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { ticketOf } from "../../plugins/meeting-ticket.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ChatService } from "./chat.service.ts";

const tags = ["chat"];
const config = { access: "optional" as const };
const TICKET = "Needs the meeting ticket (X-Meeting-Ticket) of someone in this call; otherwise 404.";
const BASE = "/api/v1/calls/:callId/chat";

const route = <S extends object>(summary: string, schema: S) => ({
  config,
  schema: { summary, description: TICKET, tags, headers: meetingTicketHeadersSchema, ...schema },
});

export const chatRoutes: FastifyPluginAsyncZod<{ chat: ChatService }> = async (app, { chat }) => {
  app.post(
    `${BASE}/messages`,
    route("Send a message to everyone in the meeting", {
      params: chatParamsSchema,
      body: sendMessageBodySchema,
      response: { 200: chatMessageSchema },
    }),
    (request) => chat.send(idParam(request.params.callId), ticketOf(request), request.body),
  );
  app.get(
    `${BASE}/messages`,
    route("The meeting's chat, newest 50 first", {
      params: chatParamsSchema,
      querystring: messagesQuerySchema,
      response: { 200: messagesPageSchema },
    }),
    (request) => chat.page(idParam(request.params.callId), ticketOf(request), request.query),
  );
  app.get(
    `${BASE}/messages/:messageId`,
    route("One chat message", { params: chatMessageParamsSchema, response: { 200: chatMessageSchema } }),
    (request) => chat.one(idParam(request.params.callId), ticketOf(request), idParam(request.params.messageId)),
  );
  app.get(
    `${BASE}/events`,
    route("Chat news missed while disconnected", {
      params: chatParamsSchema,
      querystring: eventsQuerySchema,
      response: { 200: eventsPageSchema },
    }),
    (request) => chat.events(idParam(request.params.callId), ticketOf(request), request.query.after),
  );
};
