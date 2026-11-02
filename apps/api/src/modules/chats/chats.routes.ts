// The chat list and starting chats (F14 design.md section 5). Workspace routes need membership
// (plugins/workspace-access.ts, 404 otherwise); a conversation's routes check the caller is in it, and
// anyone else gets the same 404 as for a chat that doesn't exist (S1, S2, AC-F14-31).
import {
  conversationListSchema,
  conversationParamsSchema,
  inviteToMeetAppBodySchema,
  peopleQuerySchema,
  peopleResultSchema,
  listQuerySchema,
  myChatSettingsBodySchema,
  readMarkBodySchema,
  startConversationBodySchema,
  startedConversationSchema,
  workspaceParamsSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam, memberOf, workspaceAccess, type MembershipLookup } from "../../plugins/workspace-access.ts";
import type { ChatsPeopleService } from "./chats-people.service.ts";
import type { ChatsService } from "./chats.service.ts";

const tags = ["chats"];
const IN_CHAT = "Only people in the chat (or who may read a meeting's chat); anyone else gets 404.";

const LIST = {
  schema: {
    summary: "The chat list: one-to-one, group and meeting chats",
    description:
      "Members of the workspace. Pinned chats first, then newest activity; unread counts; filters all, unread, chats, meetings; `q` matches names (not message text), ignoring case and accents. In Personal, chats with people outside appear too.",
    tags,
    params: workspaceParamsSchema,
    querystring: listQuerySchema,
    response: { 200: conversationListSchema },
  },
};

const START = {
  schema: {
    summary: "Start a chat",
    description:
      "One person opens the pair's one-to-one chat (the existing one if any); two or more make a group (up to 250 people, 409 CHAT_GROUP_FULL).",
    tags,
    params: workspaceParamsSchema,
    body: startConversationBodySchema,
    response: { 200: startedConversationSchema },
  },
};

const MINE = {
  schema: {
    summary: "Pin, mute or hide a chat for yourself",
    description: `${IN_CHAT} Up to 15 pinned chats (409 CHAT_PIN_LIMIT).`,
    tags,
    params: conversationParamsSchema,
    body: myChatSettingsBodySchema,
  },
};

const READ = {
  schema: {
    summary: "Mark a chat read up to a news number",
    description: `${IN_CHAT} The mark never moves back.`,
    tags,
    params: conversationParamsSchema,
    body: readMarkBodySchema,
  },
};

const PEOPLE = {
  schema: {
    summary: "Find people for New chat",
    description:
      "Members of the workspace. A name matches the workspace's members; an exact email finds that one account anywhere, or says no account uses it (30 email lookups a minute, 429). Never a list of emails.",
    tags,
    params: workspaceParamsSchema,
    querystring: peopleQuerySchema,
    response: { 200: peopleResultSchema },
  },
};

const INVITE = {
  schema: {
    summary: "Invite someone to MeetApp by email (Personal)",
    description:
      'Sends a "Join me on MeetApp" email; 20 a day per person (429). The answer is the same whether or not the email has an account.',
    tags,
    body: inviteToMeetAppBodySchema,
  },
};

export const chatsRoutes: FastifyPluginAsyncZod<{
  chats: ChatsService;
  people: ChatsPeopleService;
  lookup: MembershipLookup;
}> = async (app, { chats, people, lookup }) => {
  app.addHook("preValidation", workspaceAccess(lookup));

  app.get("/api/v1/workspaces/:workspaceId/conversations", LIST, (request) =>
    chats.list(memberOf(request), request.query),
  );
  app.post("/api/v1/workspaces/:workspaceId/conversations", START, (request) =>
    chats.start(memberOf(request), request.body),
  );
  app.get("/api/v1/workspaces/:workspaceId/people", PEOPLE, (request) =>
    people.find(memberOf(request), request.query.q),
  );
  app.post("/api/v1/me/invitations", INVITE, async (request, reply) => {
    const { id, name } = signedInUser(request);
    await people.inviteToMeetApp({ id, name }, request.body.email);
    return reply.status(204).send();
  });
  app.patch("/api/v1/conversations/:conversationId/me", MINE, async (request, reply) => {
    await chats.setMine(signedInUser(request).id, idParam(request.params.conversationId), request.body);
    return reply.status(204).send();
  });
  app.put("/api/v1/conversations/:conversationId/read", READ, async (request, reply) => {
    await chats.markRead(signedInUser(request).id, idParam(request.params.conversationId), request.body.seq);
    return reply.status(204).send();
  });
};
