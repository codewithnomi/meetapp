// Meeting chat after the meeting (F03 design.md section 8): signed in, for people who took part.
// Read-only, except organizers and co-organizers removing a message. Anyone else gets 404 (S1, S2).
import {
  attachmentLinkQuerySchema,
  attachmentLinkSchema,
  meetingAttachmentParamsSchema,
  meetingChatMessageParamsSchema,
  meetingChatParamsSchema,
  messagesPageSchema,
  messagesQuerySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ChatAfterService } from "./chat-after.service.ts";

const BASE = "/api/v1/meetings/:meetingId/chat";
const WHO =
  'Signed-in people who took part and weren\'t removed; with chat "In-meeting only", the organizer and co-organizers only. Anyone else gets 404.';
const route = <S extends object>(summary: string, schema: S) => ({
  schema: { summary, description: WHO, tags: ["chat"], ...schema },
});

export const chatAfterRoutes: FastifyPluginAsyncZod<{ after: ChatAfterService }> = async (app, { after }) => {
  app.get(
    `${BASE}/messages`,
    route("A past meeting's chat, newest 50 first", {
      params: meetingChatParamsSchema,
      querystring: messagesQuerySchema,
      response: { 200: messagesPageSchema },
    }),
    (request) => after.page(signedInUser(request).id, idParam(request.params.meetingId), request.query),
  );
  app.get(
    `${BASE}/attachments/:attachmentId/link`,
    route("A 5-minute download link", {
      params: meetingAttachmentParamsSchema,
      querystring: attachmentLinkQuerySchema,
      response: { 200: attachmentLinkSchema },
    }),
    (request) =>
      after.link(
        signedInUser(request).id,
        idParam(request.params.meetingId),
        idParam(request.params.attachmentId),
        request.query.preview === "true",
      ),
  );
  app.delete(
    `${BASE}/messages/:messageId`,
    route("Remove a message (organizer and co-organizers)", { params: meetingChatMessageParamsSchema }),
    async (request, reply) => {
      const meetingId = idParam(request.params.meetingId);
      await after.delete(signedInUser(request).id, meetingId, idParam(request.params.messageId));
      return reply.status(204).send();
    },
  );
};
