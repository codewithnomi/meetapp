// Controls inside a call (F02 design.md section 6). All take the meeting ticket (X-Meeting-Ticket);
// the caller's meeting role decides, and anything not allowed gets the same 404 as a call that doesn't
// exist (AC-F02-50). 30 actions a minute per ticket (S5).
import {
  callParamsSchema,
  handBodySchema,
  lockBodySchema,
  meetingDetailsSchema,
  meetingTicketHeadersSchema,
  participantParamsSchema,
  roleBodySchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { ticketOf } from "../../plugins/meeting-ticket.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { ControlsService } from "./controls.service.ts";

const tags = ["calls"];
const config = { access: "optional" as const };
const TICKET =
  "Needs the meeting ticket (X-Meeting-Ticket) of someone in this call whose role allows it; otherwise 404.";
const PEOPLE = "/api/v1/calls/:callId/participants/:attendanceId";

const route = <S extends object>(summary: string, schema: S) => ({
  config,
  schema: { summary, description: TICKET, tags, headers: meetingTicketHeadersSchema, ...schema },
});
const onPerson = (summary: string) => route(summary, { params: participantParamsSchema });

interface NoContent {
  status: (code: number) => { send: () => unknown };
}
const done = async (work: Promise<unknown>, reply: NoContent) => {
  await work;
  return reply.status(204).send();
};

/** Mute, remove, lower a hand, change a role: aimed at one person in the call. */
const personControls: FastifyPluginAsyncZod<{ controls: ControlsService }> = async (app, { controls }) => {
  app.post(`${PEOPLE}/lower-hand`, onPerson("Lower someone's hand"), (request, reply) =>
    done(
      controls.lowerHand(idParam(request.params.callId), ticketOf(request), idParam(request.params.attendanceId)),
      reply,
    ),
  );
  app.post(`${PEOPLE}/mute`, onPerson("Mute someone"), (request, reply) =>
    done(controls.mute(idParam(request.params.callId), ticketOf(request), idParam(request.params.attendanceId)), reply),
  );
  app.post(`${PEOPLE}/remove`, onPerson("Remove someone from the meeting"), (request, reply) =>
    done(
      controls.remove(idParam(request.params.callId), ticketOf(request), idParam(request.params.attendanceId)),
      reply,
    ),
  );
  app.patch(
    `${PEOPLE}/role`,
    route("Make someone a presenter or attendee", { params: participantParamsSchema, body: roleBodySchema }),
    (request, reply) =>
      done(
        controls.setRole(
          idParam(request.params.callId),
          ticketOf(request),
          idParam(request.params.attendanceId),
          request.body.role,
        ),
        reply,
      ),
  );
};

export const controlsRoutes: FastifyPluginAsyncZod<{ controls: ControlsService }> = async (app, { controls }) => {
  await app.register(personControls, { controls });
  app.get(
    "/api/v1/calls/:callId/meeting",
    route("Meeting info: link, ID and passcode", { params: callParamsSchema, response: { 200: meetingDetailsSchema } }),
    async (request) => controls.info(idParam(request.params.callId), ticketOf(request)),
  );
  app.post(
    "/api/v1/calls/:callId/hand",
    route("Raise or lower your hand", { params: callParamsSchema, body: handBodySchema }),
    (request, reply) =>
      done(controls.hand(idParam(request.params.callId), ticketOf(request), request.body.raised), reply),
  );
  app.post(
    "/api/v1/calls/:callId/mute-all",
    route("Mute everyone except me", { params: callParamsSchema }),
    (request, reply) => done(controls.muteAll(idParam(request.params.callId), ticketOf(request)), reply),
  );
  app.patch(
    "/api/v1/calls/:callId",
    route("Lock or unlock the meeting", { params: callParamsSchema, body: lockBodySchema }),
    (request, reply) =>
      done(controls.lock(idParam(request.params.callId), ticketOf(request), request.body.locked), reply),
  );
  app.post(
    "/api/v1/calls/:callId/end",
    route("End the meeting for everyone", { params: callParamsSchema }),
    (request, reply) => done(controls.end(idParam(request.params.callId), ticketOf(request)), reply),
  );
};
