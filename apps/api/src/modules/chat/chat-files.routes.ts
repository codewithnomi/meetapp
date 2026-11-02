// Chat files (F03 design.md section 6 and 8). Upload: the file itself is the body and its name is in
// X-File-Name (URL-encoded), as the F01 photo upload does. Download: a signed 5-minute link to this
// backend, answered with headers that stop browsers guessing or showing the file (S12, AC-F03-31).
import {
  attachmentLinkQuerySchema,
  attachmentLinkSchema,
  attachmentParamsSchema,
  chatParamsSchema,
  fileTokenParamsSchema,
  uploadedSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { ticketOf } from "../../plugins/meeting-ticket.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import { chatRoute } from "./chat-route.ts";
import type { ChatFilesService } from "./chat-files.service.ts";
import { BODY_LIMIT, fileNameOf, rawBodies } from "./upload-body.ts";

/** `attachment; filename*=UTF-8''…`: the browser always saves, never shows (RFC 6266). */
const attachmentHeader = (fileName: string) => `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`;

const uploads: FastifyPluginAsyncZod<{ files: ChatFilesService }> = async (app, { files }) => {
  rawBodies(app);
  app.post(
    "/api/v1/calls/:callId/chat/attachments",
    {
      ...chatRoute("Upload a file to send in chat", { params: chatParamsSchema, response: { 200: uploadedSchema } }),
      bodyLimit: BODY_LIMIT,
    },
    (request) =>
      files.upload({
        callId: idParam(request.params.callId),
        ticketHash: ticketOf(request),
        fileName: fileNameOf(request.headers["x-file-name"]),
        bytes: new Uint8Array(request.body as Buffer),
      }),
  );
};

export const chatFilesRoutes: FastifyPluginAsyncZod<{ files: ChatFilesService }> = async (app, { files }) => {
  await app.register(uploads, { files });
  app.get(
    "/api/v1/calls/:callId/chat/attachments/:attachmentId/link",
    chatRoute("A 5-minute download link", {
      params: attachmentParamsSchema,
      querystring: attachmentLinkQuerySchema,
      response: { 200: attachmentLinkSchema },
    }),
    (request) =>
      files.link(
        idParam(request.params.callId),
        ticketOf(request),
        idParam(request.params.attachmentId),
        request.query.preview === "true",
      ),
  );
  app.get(
    "/api/v1/chat-files/:token",
    {
      config: { access: "public" as const },
      schema: {
        summary: "Download a chat file with a link from the link route",
        description: "The link itself is the permission; it works for 5 minutes. Otherwise 404.",
        tags: ["chat"],
        params: fileTokenParamsSchema,
      },
    },
    async (request, reply) => {
      const file = await files.download(request.params.token);
      return reply
        .header("content-type", file.mediaType)
        .header("content-disposition", attachmentHeader(file.fileName))
        .header("x-content-type-options", "nosniff")
        .header("cache-control", "private, no-store")
        .header("content-security-policy", "default-src 'none'; sandbox")
        .send(Buffer.from(file.bytes));
    },
  );
};
