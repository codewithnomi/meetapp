// Other devices and transfer (F15 design section 5; AC-F15-33): the person's running calls with their
// seats, and moving a call to this device. Signed in; only the person's own calls and seats.
import { activeCallsSchema, callParamsSchema, joinedSchema, transferCallBodySchema } from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { TransferService } from "./transfer.service.ts";

const tags = ["calls"];

export const transferRoutes: FastifyPluginAsyncZod<{ transfers: TransferService }> = async (app, { transfers }) => {
  app.get(
    "/api/v1/me/calls/active",
    {
      schema: {
        summary: "My running calls, with my devices in them",
        description: "For \"You're in a call on another device\". Only the signed-in person's own chat calls.",
        tags,
        response: { 200: activeCallsSchema },
      },
    },
    async (request) => transfers.active(signedInUser(request).id),
  );
  app.post(
    "/api/v1/calls/:callId/transfer",
    {
      schema: {
        summary: "Move a call to this device",
        description:
          "Gives this device a seat that replaces one of your seats in the call; the old seat leaves once this one connects. If this device never connects, nothing changes. 404 unless it is your seat in this call.",
        tags,
        params: callParamsSchema,
        body: transferCallBodySchema,
        response: { 200: joinedSchema },
      },
    },
    async (request) =>
      transfers.transfer(signedInUser(request).id, idParam(request.params.callId), request.body.fromAttendanceId),
  );
};
