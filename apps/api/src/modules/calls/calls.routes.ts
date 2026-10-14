// Joining and the lobby (F02 design.md section 6). Joining is open to guests and signed-in people
// alike (`access: "optional"`); everything after it is authenticated with the meeting ticket in the
// X-Meeting-Ticket header, never the sign-in, so members and guests follow the same rules.
import {
  attendanceParamsSchema,
  attendanceSchema,
  callParamsSchema,
  joinMeetingBodySchema,
  joinedSchema,
  lobbyDecisionBodySchema,
  lobbyDecisionResponseSchema,
  lobbyResponseSchema,
  meetingTicketHeadersSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { ticketOf } from "../../plugins/meeting-ticket.ts";
import { idParam } from "../../plugins/workspace-access.ts";
import type { JoinService } from "./join.service.ts";
import type { LobbyService } from "./lobby.service.ts";

const tags = ["calls"];
const config = { access: "optional" as const };
const TICKET = "Needs the meeting ticket (X-Meeting-Ticket); anything else is the same 404.";

const JOIN = {
  config,
  schema: {
    summary: "Join a meeting, or wait in its lobby",
    description:
      "With a lookup token from POST /meeting-lookups (or from making the meeting). Answers the meeting ticket, and the pass when the person may enter. 403 GUESTS_NOT_ALLOWED or MEETING_LOCKED, 409 MEETING_FULL or LOBBY_FULL, 410 MEETING_EXPIRED; 10 joins a minute per address and per token.",
    tags,
    body: joinMeetingBodySchema,
    response: { 200: joinedSchema },
  },
};
const STATUS = {
  config,
  schema: {
    summary: "My status: waiting, let in (with the pass) or the outcome",
    description: `Asked every 2 seconds while waiting; not counted against any limit. ${TICKET}`,
    tags,
    headers: meetingTicketHeadersSchema,
    params: attendanceParamsSchema,
    response: { 200: attendanceSchema },
  },
};
const LEAVE = {
  config,
  schema: {
    summary: "Leave the lobby or the call",
    description: TICKET,
    tags,
    headers: meetingTicketHeadersSchema,
    params: attendanceParamsSchema,
  },
};
const LOBBY = {
  config,
  schema: {
    summary: "Who waits in the lobby",
    description: `The organizer, co-organizers and presenters of this call. ${TICKET}`,
    tags,
    headers: meetingTicketHeadersSchema,
    params: callParamsSchema,
    response: { 200: lobbyResponseSchema },
  },
};
const decision = (verb: string) => ({
  config,
  schema: {
    summary: `${verb} people waiting in the lobby`,
    description: `The organizer, co-organizers and presenters. Admit lets people in in arrival order up to the free places. ${TICKET}`,
    tags,
    headers: meetingTicketHeadersSchema,
    params: callParamsSchema,
    body: lobbyDecisionBodySchema,
    response: { 200: lobbyDecisionResponseSchema },
  },
});

export const callsRoutes: FastifyPluginAsyncZod<{ join: JoinService; lobby: LobbyService }> = async (
  app,
  { join, lobby },
) => {
  app.post("/api/v1/meetings/join", JOIN, async (request) =>
    join.join({ ...request.body, user: request.user, address: request.ip }),
  );
  app.get("/api/v1/attendances/:attendanceId", STATUS, async (request, reply) => {
    void reply.header("cache-control", "no-store");
    return lobby.status(idParam(request.params.attendanceId), ticketOf(request));
  });
  app.delete("/api/v1/attendances/:attendanceId", LEAVE, async (request, reply) => {
    await lobby.leave(idParam(request.params.attendanceId), ticketOf(request));
    return reply.status(204).send();
  });
  app.get("/api/v1/calls/:callId/lobby", LOBBY, async (request) =>
    lobby.lobby(idParam(request.params.callId), ticketOf(request)),
  );
  app.post("/api/v1/calls/:callId/lobby/admit", decision("Admit"), async (request) =>
    lobby.admit(idParam(request.params.callId), ticketOf(request), request.body),
  );
  app.post("/api/v1/calls/:callId/lobby/deny", decision("Deny"), async (request) =>
    lobby.deny(idParam(request.params.callId), ticketOf(request), request.body),
  );
};
