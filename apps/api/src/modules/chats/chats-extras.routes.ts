// Pins, polls, files and GIFs in one-to-one and group chats (F14 design.md 5; AC-F14-19): F03's routes
// per conversation. Only people in the chat; anyone else gets the same 404 as for a chat that doesn't
// exist (AC-F14-31).
import {
  attachmentLinkQuerySchema,
  attachmentLinkSchema,
  conversationFileParamsSchema,
  conversationMessageParamsSchema,
  conversationParamsSchema,
  conversationPollParamsSchema,
  createPollBodySchema,
  gifSettingsSchema,
  pinBodySchema,
  pinnedListSchema,
  pollSchema,
  uploadedSchema,
  voteBodySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { BODY_LIMIT, fileNameOf, rawBodies } from "../chat/upload-body.ts";
import { signedInUser } from "../../plugins/session.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ChatsExtrasService } from "./chats-extras.service.ts";

const tags = ["chats"];
const BASE = "/api/v1/conversations/:conversationId";
const IN_CHAT = "People in the chat only; anyone else gets 404.";
const route = <S extends object>(summary: string, schema: S) => ({
  schema: { summary, description: IN_CHAT, tags, ...schema },
});
type App = Parameters<FastifyPluginAsyncZod>[0];
const where = (request: { params: { conversationId: string } }, userId: string) => ({
  userId,
  conversationId: idParam(request.params.conversationId),
});

function pinRoutes(app: App, extras: ChatsExtrasService) {
  app.get(
    `${BASE}/pins`,
    route("Pinned messages", { params: conversationParamsSchema, response: { 200: pinnedListSchema } }),
    (request) => extras.pinned(where(request, signedInUser(request).id)),
  );
  app.post(
    `${BASE}/pins`,
    route("Pin a message (any member; 3 at most: 409 CHAT_PINS_FULL)", {
      params: conversationParamsSchema,
      body: pinBodySchema,
    }),
    async (request, reply) => {
      await extras.pin(where(request, signedInUser(request).id), request.body.messageId);
      return reply.status(204).send();
    },
  );
  app.delete(
    `${BASE}/pins/:messageId`,
    route("Unpin a message", { params: conversationMessageParamsSchema }),
    async (request, reply) => {
      await extras.unpin(where(request, signedInUser(request).id), request.params.messageId);
      return reply.status(204).send();
    },
  );
}

function pollRoutes(app: App, extras: ChatsExtrasService) {
  app.post(
    `${BASE}/polls`,
    route("Create a poll (any member)", {
      params: conversationParamsSchema,
      body: createPollBodySchema,
      response: { 200: pollSchema },
    }),
    (request) => extras.createPoll(where(request, signedInUser(request).id), request.body),
  );
  app.get(
    `${BASE}/polls/:pollId`,
    route("A poll, as you may see it", { params: conversationPollParamsSchema, response: { 200: pollSchema } }),
    (request) => extras.poll(where(request, signedInUser(request).id), idParam(request.params.pollId)),
  );
  app.put(
    `${BASE}/polls/:pollId/vote`,
    route("Vote", { params: conversationPollParamsSchema, body: voteBodySchema, response: { 200: pollSchema } }),
    (request) =>
      extras.vote(where(request, signedInUser(request).id), idParam(request.params.pollId), request.body.optionIds),
  );
  app.post(
    `${BASE}/polls/:pollId/close`,
    route("Close a poll (its creator only)", { params: conversationPollParamsSchema }),
    async (request, reply) => {
      await extras.closePoll(where(request, signedInUser(request).id), idParam(request.params.pollId));
      return reply.status(204).send();
    },
  );
}

const uploads: FastifyPluginAsyncZod<{ extras: ChatsExtrasService }> = async (app, { extras }) => {
  rawBodies(app);
  app.post(
    `${BASE}/attachments`,
    {
      ...route("Upload a file to send (25 MB, 10 a minute, 2 GB per chat)", {
        params: conversationParamsSchema,
        response: { 200: uploadedSchema },
      }),
      bodyLimit: BODY_LIMIT,
    },
    (request) =>
      extras.upload(where(request, signedInUser(request).id), {
        fileName: fileNameOf(request.headers["x-file-name"]),
        bytes: new Uint8Array(request.body as Buffer),
      }),
  );
};

export const chatsExtrasRoutes: FastifyPluginAsyncZod<{ extras: ChatsExtrasService }> = async (app, { extras }) => {
  await app.register(uploads, { extras });
  pinRoutes(app, extras);
  pollRoutes(app, extras);
  app.get(
    `${BASE}/attachments/:attachmentId/link`,
    route("A 5-minute download link", {
      params: conversationFileParamsSchema,
      querystring: attachmentLinkQuerySchema,
      response: { 200: attachmentLinkSchema },
    }),
    (request) =>
      extras.link(where(request, signedInUser(request).id), {
        attachmentId: idParam(request.params.attachmentId),
        preview: request.query.preview === "true",
      }),
  );
  app.get(
    `${BASE}/gif-settings`,
    route("What the app needs to search GIFs (403 CHAT_GIFS_OFF when the workspace turned them off)", {
      params: conversationParamsSchema,
      response: { 200: gifSettingsSchema },
    }),
    (request) => extras.gifSettings(where(request, signedInUser(request).id)),
  );
};
