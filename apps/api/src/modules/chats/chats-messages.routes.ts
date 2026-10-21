// Messages in one-to-one and group chats (F14 design.md 3.3 and 5; AC-F14-19, 21, 22, 24): F03's
// message, reaction and reply routes per conversation, "who has seen" and the read-receipts setting.
// Only people in the chat; anyone else gets the same 404 as for a chat that doesn't exist (AC-F14-31).
import {
  chatMessageSchema,
  conversationMessageParamsSchema,
  conversationParamsSchema,
  conversationReactionParamsSchema,
  editMessageBodySchema,
  eventsPageSchema,
  eventsQuerySchema,
  messagesPageSchema,
  messagesQuerySchema,
  myChatPrefsBodySchema,
  reactionBodySchema,
  seenSchema,
  sendMessageBodySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ChatsMessagesService } from "./chats-messages.service.ts";

const tags = ["chats"];
const BASE = "/api/v1/conversations/:conversationId";
const IN_CHAT = "People in the chat only; anyone else gets 404. Left or removed people read what they saw.";
const route = <S extends object>(summary: string, schema: S) => ({
  schema: { summary, description: IN_CHAT, tags, ...schema },
});

type MessageParams = { conversationId: string; messageId: string };
const on = (request: { params: MessageParams }, userId: string) => ({
  userId,
  conversationId: idParam(request.params.conversationId),
  messageId: request.params.messageId,
});

type App = Parameters<FastifyPluginAsyncZod>[0];

/** Reading: pages, one message, catch-up news and who has seen. */
function readingRoutes(app: App, messages: ChatsMessagesService) {
  app.get(
    `${BASE}/messages`,
    route("A page of a chat's messages", {
      params: conversationParamsSchema,
      querystring: messagesQuerySchema,
      response: { 200: messagesPageSchema },
    }),
    (request) => messages.page(signedInUser(request).id, idParam(request.params.conversationId), request.query),
  );
  app.get(
    `${BASE}/messages/:messageId`,
    route("One message", { params: conversationMessageParamsSchema, response: { 200: chatMessageSchema } }),
    (request) => messages.one(on(request, signedInUser(request).id)),
  );
  app.get(
    `${BASE}/messages/:messageId/seen`,
    route("Who has seen a message (groups up to 20, read receipts on)", {
      params: conversationMessageParamsSchema,
      response: { 200: seenSchema },
    }),
    (request) => messages.seen(on(request, signedInUser(request).id)),
  );
  app.get(
    `${BASE}/events`,
    route("News missed since a number", {
      params: conversationParamsSchema,
      querystring: eventsQuerySchema,
      response: { 200: eventsPageSchema },
    }),
    (request) => messages.events(signedInUser(request).id, idParam(request.params.conversationId), request.query.after),
  );
}

/** Writing: send, edit, delete, react, and the read-receipts setting. */
function writingRoutes(app: App, messages: ChatsMessagesService) {
  app.post(
    `${BASE}/messages`,
    route("Send a message (10 at most while a chat request waits: 403 CHAT_REQUEST_LIMIT)", {
      params: conversationParamsSchema,
      body: sendMessageBodySchema,
      response: { 200: chatMessageSchema },
    }),
    (request) => messages.send(signedInUser(request).id, idParam(request.params.conversationId), request.body),
  );
  app.patch(
    `${BASE}/messages/:messageId`,
    route("Edit your own message (any time)", {
      params: conversationMessageParamsSchema,
      body: editMessageBodySchema,
      response: { 200: chatMessageSchema },
    }),
    (request) => messages.edit(on(request, signedInUser(request).id), request.body.body),
  );
  app.delete(
    `${BASE}/messages/:messageId`,
    route("Delete your own message (any time)", { params: conversationMessageParamsSchema }),
    async (request, reply) => {
      await messages.delete(on(request, signedInUser(request).id));
      return reply.status(204).send();
    },
  );
  app.post(
    `${BASE}/messages/:messageId/reactions`,
    route("React (one reaction per person)", { params: conversationMessageParamsSchema, body: reactionBodySchema }),
    async (request, reply) => {
      await messages.react(on(request, signedInUser(request).id), request.body.emoji);
      return reply.status(204).send();
    },
  );
  app.delete(
    `${BASE}/messages/:messageId/reactions/:emoji`,
    route("Remove your reaction", { params: conversationReactionParamsSchema }),
    async (request, reply) => {
      await messages.unreact(on(request, signedInUser(request).id), request.params.emoji);
      return reply.status(204).send();
    },
  );
}

/** The read-receipts setting (AC-F14-24). */
function settingsRoutes(app: App, messages: ChatsMessagesService) {
  app.patch(
    "/api/v1/me/settings",
    { schema: { summary: "My chat settings: read receipts", tags, body: myChatPrefsBodySchema } },
    async (request, reply) => {
      await messages.setReadReceipts(signedInUser(request).id, request.body.readReceipts);
      return reply.status(204).send();
    },
  );
}

export const chatsMessagesRoutes: FastifyPluginAsyncZod<{ messages: ChatsMessagesService }> = async (
  app,
  { messages },
) => {
  readingRoutes(app, messages);
  writingRoutes(app, messages);
  settingsRoutes(app, messages);
};
