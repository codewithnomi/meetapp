// `GET /api/v1/realtime`: the live line (D064; F14 design.md 3.4). The sign-in check runs before the
// line opens, like any route (no token, a bad or an expired one: 401, no upgrade). Messages over 64 KB
// close the line. Each server has its own hub of open lines. A page from another site can't open one: a
// browser always names the page's origin on an upgrade, and only the app's own are accepted (security S5).
import websocket from "@fastify/websocket";
import { CHATS_LIMITS, statusQuerySchema, statusesSchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FastifyInstance } from "fastify";
import { signedInUser, type SessionReader } from "../../plugins/session.ts";
import { createLineHub, type LineDeps } from "./chats-line.ts";
import type { ChatsStatusService } from "./chats-status.service.ts";

/** WebSocket support for the whole server (registered at the top, so tests can open lines too). */
export const registerWebSockets = (app: FastifyInstance) =>
  app.register(websocket, { options: { maxPayload: CHATS_LIMITS.lineMessageBytes } });

export const chatsLineRoutes: FastifyPluginAsyncZod<{
  line: LineDeps;
  sessions: SessionReader;
  status: ChatsStatusService;
  /** The app's own pages; an upgrade naming any other origin is refused (403). */
  allowedOrigins: string[];
}> = async (app, { line, sessions, status, allowedOrigins }) => {
  app.get(
    "/api/v1/people/status",
    {
      schema: {
        summary: "Statuses of people (Available, Away, In a call, Offline)",
        description:
          "Only colleagues in shared team workspaces and accepted contacts; anyone else (blocked, pending, strangers) is left out of the answer. Up to 100 ids, comma-separated.",
        tags: ["chats"],
        querystring: statusQuerySchema,
        response: { 200: statusesSchema },
      },
    },
    async (request) => {
      const found = await status.visible(signedInUser(request).id, request.query.ids);
      return { statuses: [...found].map(([userId, value]) => ({ userId, status: value })) };
    },
  );
  const hub = createLineHub(line);
  app.addHook("onClose", () => hub.close());
  app.get(
    "/api/v1/realtime",
    {
      websocket: true,
      // Apps outside a browser send no origin and sign in with a token, which another site can't use.
      preValidation: async (request, reply) => {
        const origin = request.headers.origin;
        if (origin !== undefined && !allowedOrigins.includes(origin)) {
          await reply
            .code(403)
            .send({ error: { code: "FORBIDDEN", message: "Not allowed from this page.", requestId: request.id } });
        }
      },
      schema: {
        summary: "The live line (WebSocket)",
        description:
          "News of your chats, typing, Seen, status and list changes. The app may send only typing, active and ping; anything else, or a message over 64 KB, closes the line. Closes within 2 seconds of signing out (code 4401), after 2 minutes without a ping (4408), and when a 6th line opens for you (4001).",
        tags: ["chats"],
      },
    },
    async (socket, request) => {
      const { id } = signedInUser(request);
      await hub.open(socket, id, async () => (await sessions.read(request))?.id === id);
    },
  );
};
