// Email invitations (F01 design.md section 8; AC-F01-17, 18). Workspace routes answer 404 to anyone
// who isn't a member (plugins/workspace-access.ts); "my invitations" only ever match the caller's own
// verified email. `GET /invite/:token` is the public web page the email's button opens.
import {
  invitationAcceptedSchema,
  invitationCreatedSchema,
  invitationParamsSchema,
  inviteBodySchema,
  myInvitationParamsSchema,
  myInvitationsResponseSchema,
  sentInvitationsResponseSchema,
  workspaceParamsSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam, memberOf, workspaceAccess, type MembershipLookup } from "../../plugins/workspace-access.ts";
import type { InvitationsService } from "./invitations.service.ts";
import { INVITATION_PAGE_HEADERS, renderInvitationPage } from "./page/invitation-page.ts";

const tags = ["invitations"];
const NOT_A_MEMBER = "404 when the caller isn't a member of the workspace.";

const route = <S extends object>(summary: string, description: string, schema: S) => ({
  schema: { summary, description, tags, ...schema },
});

const LIST = route("Pending invitations", `Owner and admins see all; others see the ones they sent. ${NOT_A_MEMBER}`, {
  params: workspaceParamsSchema,
  response: { 200: sentInvitationsResponseSchema },
});
const INVITE = route(
  "Invite an email address",
  `Members invite as member; the owner and admins also as admin. Replaces a pending invitation for the same email. 409 ALREADY_MEMBER; 429 after 50 invitation emails a day. ${NOT_A_MEMBER}`,
  { params: workspaceParamsSchema, body: inviteBodySchema, response: { 201: invitationCreatedSchema } },
);
const CANCEL = route("Cancel an invitation", `The owner, admins or the sender. ${NOT_A_MEMBER}`, {
  params: invitationParamsSchema,
});
const RESEND = route("Send an invitation again", `A new link and email; the old link stops. ${NOT_A_MEMBER}`, {
  params: invitationParamsSchema,
  response: { 201: invitationCreatedSchema },
});
const MINE = route("Invitations for me", "Pending invitations sent to the signed-in person's verified email.", {
  response: { 200: myInvitationsResponseSchema },
});
const ACCEPT = route("Join with an invitation", "Only the invited email. 410 INVITATION_GONE if it can't be used.", {
  params: myInvitationParamsSchema,
  response: { 200: invitationAcceptedSchema },
});
const DECLINE = route("Decline an invitation", "Only the invited email. 410 INVITATION_GONE if it can't be used.", {
  params: myInvitationParamsSchema,
});
const PAGE = { config: { access: "public" as const }, schema: { hide: true, params: z.object({ token: z.string() }) } };

const BASE = "/api/v1/workspaces/:workspaceId/invitations";

export const invitationsRoutes: FastifyPluginAsyncZod<{
  invitations: InvitationsService;
  lookup: MembershipLookup;
}> = async (app, { invitations, lookup }) => {
  app.addHook("preValidation", workspaceAccess(lookup));
  const sender = (request: Parameters<typeof signedInUser>[0]) => {
    const { id, name } = signedInUser(request);
    return { id, name };
  };

  app.get(BASE, LIST, async (request) => invitations.listSent(memberOf(request)));
  app.post(BASE, INVITE, async (request, reply) =>
    reply.status(201).send(await invitations.invite(memberOf(request), sender(request), request.body)),
  );
  app.delete(`${BASE}/:invitationId`, CANCEL, async (request, reply) => {
    await invitations.cancel(memberOf(request), idParam(request.params.invitationId));
    return reply.status(204).send();
  });
  app.post(`${BASE}/:invitationId/resend`, RESEND, async (request, reply) => {
    const invitationId = idParam(request.params.invitationId);
    return reply.status(201).send(await invitations.resend(memberOf(request), sender(request), invitationId));
  });

  app.get("/api/v1/me/invitations", MINE, async (request) => invitations.mine(signedInUser(request).id));
  app.post("/api/v1/invitations/:invitationId/accept", ACCEPT, async (request) =>
    invitations.accept(signedInUser(request).id, idParam(request.params.invitationId)),
  );
  app.post("/api/v1/invitations/:invitationId/decline", DECLINE, async (request, reply) => {
    await invitations.decline(signedInUser(request).id, idParam(request.params.invitationId));
    return reply.status(204).send();
  });

  app.get("/invite/:token", PAGE, async (request, reply) => {
    const page = await invitations.page(request.params.token);
    // Every unusable invitation gets the same status and page (TC-F01-47).
    return reply
      .status(page.page === "valid" ? 200 : 404)
      .headers(INVITATION_PAGE_HEADERS)
      .send(renderInvitationPage(page));
  });
};
