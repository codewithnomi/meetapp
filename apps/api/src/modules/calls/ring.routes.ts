// Answering a chat call's ring (F15 design.md section 5): accept, decline, and the caller's cancel. Signed
// in; a person may answer only their own ring (others get 404), and only while it rings (409 RING_OVER).
import { callParamsSchema, joinedSchema, ringPeopleBodySchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { FastifyReply } from "fastify";
import { signedInUser } from "../../plugins/session.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { RingService } from "./ring.service.ts";

const tags = ["calls"];
const done = (reply: FastifyReply) => reply.code(204).send();

const ACCEPT = {
  schema: {
    summary: "Accept a call you are being rung for",
    description:
      "Joins the call (the first answer wins; every window of yours stops ringing). 409 RING_OVER when it was already answered, cancelled or missed; 404 when it isn't your ring or you are no longer in the chat.",
    tags,
    params: callParamsSchema,
    response: { 200: joinedSchema },
  },
};

const DECLINE = {
  schema: {
    summary: "Decline a call",
    description: "Stops the ringing in every window; a one-to-one call ends. 409 RING_OVER, 404 as for accept.",
    tags,
    params: callParamsSchema,
  },
};

const ADD = {
  schema: {
    summary: "Add people to a call",
    description:
      "Someone in the call rings members of the chat who aren't in it (up to 20 ids). People already in the call or ringing are skipped. 404 when anyone isn't a member; 409 CALL_FULL at 20 people; 429 CALL_RATE (each person rung counts toward 10 a minute).",
    tags,
    params: callParamsSchema,
    body: ringPeopleBodySchema,
  },
};

const CANCEL = {
  schema: {
    summary: "Cancel the ringing of a call you started",
    description:
      "Everyone still ringing stops and gets a missed call. Only the person who started the call; others get 404.",
    tags,
    params: callParamsSchema,
  },
};

export const ringRoutes: FastifyPluginAsyncZod<{ rings: RingService }> = async (app, { rings }) => {
  app.post("/api/v1/calls/:callId/accept", ACCEPT, async (request) =>
    rings.accept(signedInUser(request).id, idParam(request.params.callId)),
  );
  app.post("/api/v1/calls/:callId/decline", DECLINE, async (request, reply) => {
    await rings.decline(signedInUser(request).id, idParam(request.params.callId));
    return done(reply);
  });
  app.post("/api/v1/calls/:callId/ring", ADD, async (request, reply) => {
    await rings.addPeople(signedInUser(request).id, idParam(request.params.callId), request.body.userIds);
    return done(reply);
  });
  app.delete("/api/v1/calls/:callId/ring", CANCEL, async (request, reply) => {
    await rings.cancel(signedInUser(request).id, idParam(request.params.callId));
    return done(reply);
  });
};
