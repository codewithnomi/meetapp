// Join link, join code and requests to join (F01 design.md section 8; AC-F01-19, 20). Workspace
// routes answer 404 to anyone who isn't a member (plugins/workspace-access.ts); lookups and requests
// are open to any signed-in person, limited per person and per network address.
import {
  joinLinkSchema,
  joinLookupResponseSchema,
  joinRequestParamsSchema,
  joinRequestResponseSchema,
  joinRequestsResponseSchema,
  linkOrCodeBodySchema,
  setJoinLinkBodySchema,
  workspaceParamsSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FastifyRequest } from "fastify";
import { signedInUser } from "../../plugins/session.ts";
import { idParam, memberOf, workspaceAccess, type MembershipLookup } from "../../plugins/workspace-access.ts";
import type { JoinLinkService } from "./join-link.service.ts";
import type { JoinRequestsService } from "./join-requests.service.ts";

const tags = ["join"];
const NOT_A_MEMBER = "404 when the caller isn't a member of the workspace.";
const route = <S extends object>(summary: string, description: string, schema: S) => ({
  schema: { summary, description, tags, ...schema },
});

const LINK = "/api/v1/workspaces/:workspaceId/join-link";
const REQUESTS = "/api/v1/workspaces/:workspaceId/requests";

const GET_LINK = route("The join link and code", `Any member, while they are on. ${NOT_A_MEMBER}`, {
  params: workspaceParamsSchema,
  response: { 200: joinLinkSchema },
});
const SET_LINK = route(
  "Turn the join link and code on or off",
  `Owner and admins. Off stops them at once. ${NOT_A_MEMBER}`,
  {
    params: workspaceParamsSchema,
    body: setJoinLinkBodySchema,
    response: { 200: joinLinkSchema },
  },
);
const REPLACE_LINK = route(
  "Replace the join link and code",
  `Owner and admins. The old ones stop at once. ${NOT_A_MEMBER}`,
  {
    params: workspaceParamsSchema,
    response: { 200: joinLinkSchema },
  },
);
const LOOKUP = route(
  "Look a join link or code up",
  "Only the workspace name and size. Any wrong, switched-off or replaced link or code: the same 404. 429 after 20 an hour.",
  {
    body: linkOrCodeBodySchema,
    response: { 200: joinLookupResponseSchema },
  },
);
const REQUEST = route(
  "Ask to join",
  "Creates a pending request; the owner and admins are told. 409 PENDING_REQUEST if one is waiting.",
  {
    body: linkOrCodeBodySchema,
    response: { 200: joinRequestResponseSchema, 201: joinRequestResponseSchema },
  },
);
const LIST = route("Pending requests", `Owner and admins. ${NOT_A_MEMBER}`, {
  params: workspaceParamsSchema,
  response: { 200: joinRequestsResponseSchema },
});
const DECIDE = (verb: string) =>
  route(
    `${verb} a request`,
    `Owner and admins; decided once (409 ALREADY_DECIDED), 410 REQUEST_EXPIRED after 14 days. ${NOT_A_MEMBER}`,
    {
      params: joinRequestParamsSchema,
    },
  );

const asker = (request: FastifyRequest) => ({ user: signedInUser(request), address: request.ip });

export const joinRequestsRoutes: FastifyPluginAsyncZod<{
  joinLink: JoinLinkService;
  joinRequests: JoinRequestsService;
  lookup: MembershipLookup;
}> = async (app, { joinLink, joinRequests, lookup }) => {
  app.addHook("preValidation", workspaceAccess(lookup));

  app.get(LINK, GET_LINK, async (request) => joinLink.get(memberOf(request)));
  app.put(LINK, SET_LINK, async (request) => joinLink.set(memberOf(request), request.body.enabled));
  app.post(`${LINK}/replace`, REPLACE_LINK, async (request) => joinLink.replace(memberOf(request)));

  app.post("/api/v1/join/lookup", LOOKUP, async (request) =>
    joinRequests.lookup(asker(request), request.body.linkOrCode),
  );
  app.post("/api/v1/join/request", REQUEST, async (request, reply) => {
    const answer = await joinRequests.request(asker(request), request.body.linkOrCode);
    return reply.status(answer.status === "pending" ? 201 : 200).send(answer);
  });

  app.get(REQUESTS, LIST, async (request) => joinRequests.list(memberOf(request)));
  app.post(`${REQUESTS}/:requestId/approve`, DECIDE("Approve"), async (request, reply) => {
    await joinRequests.decide(memberOf(request), idParam(request.params.requestId), "approved");
    return reply.status(204).send();
  });
  app.post(`${REQUESTS}/:requestId/reject`, DECIDE("Reject"), async (request, reply) => {
    await joinRequests.decide(memberOf(request), idParam(request.params.requestId), "rejected");
    return reply.status(204).send();
  });
};
