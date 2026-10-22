// `GET /api/v1/realtime`: the live line (D064; F14 design.md 3.4). The sign-in check runs before the
// line opens, like any route (no token, a bad or an expired one: 401, no upgrade). Messages over 64 KB
// close the line. Each server has its own hub of open lines.
import websocket from "@fastify/websocket";
import { CHATS_LIMITS } from "@meetapp/contracts";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { signedInUser, type SessionReader } from "../../plugins/session.ts";
import { createLineHub, type LineDeps } from "./chats-line.ts";

/** WebSocket support for the whole server (registered at the top, so tests can open lines too). */
export const registerWebSockets = (app: FastifyInstance) =>
  app.register(websocket, { options: { maxPayload: CHATS_LIMITS.lineMessageBytes } });

export const chatsLineRoutes: FastifyPluginAsync<{ line: LineDeps; sessions: SessionReader }> = async (
  app,
  { line, sessions },
) => {
  const hub = createLineHub(line);
  app.addHook("onClose", () => hub.close());
  app.get(
    "/api/v1/realtime",
    {
      websocket: true,
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
