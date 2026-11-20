// Scheduled meetings and the calendar (F13 design.md "Backend endpoints"). Creating and reading the
// calendar need membership of the workspace (plugins/workspace-access.ts, 404 otherwise); a meeting's
// schedule is for its organizer, co-organizers and invited members, and anyone else gets the same 404
// as for no meeting (S1, S2, AC-F13-26).
import {
  calendarQuerySchema,
  calendarResponseSchema,
  meetingParamsSchema,
  scheduleBodySchema,
  scheduleDetailsSchema,
  workspaceParamsSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam, memberOf, workspaceAccess, type MembershipLookup } from "../../plugins/workspace-access.ts";
import type { SchedulingService } from "./scheduling.service.ts";

const tags = ["scheduling"];

const CREATE = {
  schema: {
    summary: "Schedule a meeting",
    description:
      "Any member of the workspace. 400 with the field for a wrong one (a start more than 5 minutes ago: /startsAt; a member invitee not in the workspace: /invitees). 50 meetings an hour per person, shared with Meet now and links (429 TOO_MANY_ATTEMPTS).",
    tags,
    params: workspaceParamsSchema,
    body: scheduleBodySchema,
    response: { 201: z.object({ meetingId: z.uuid() }) },
  },
};

const CALENDAR = {
  schema: {
    summary: "The caller's meetings in a time range",
    description:
      "Occurrences of the scheduled meetings the caller organizes or is invited to in this workspace; at most 42 days per request, nothing beyond a year from now, at most 500 (then truncated).",
    tags,
    params: workspaceParamsSchema,
    querystring: calendarQuerySchema,
    response: { 200: calendarResponseSchema },
  },
};

const DETAILS = {
  schema: {
    summary: "A scheduled meeting's details",
    description:
      "Organizer, co-organizers and invited members; anyone else gets 404. Outside invitees' addresses only for organizers and co-organizers.",
    tags,
    params: meetingParamsSchema,
    response: { 200: scheduleDetailsSchema },
  },
};

const RESEND = {
  schema: {
    summary: "Send again the invites that couldn't be sent",
    description:
      "Organizer and co-organizers (an invitee: 403; anyone else: 404). Counts toward the 1,000 meeting emails an hour (429).",
    tags,
    params: meetingParamsSchema,
    response: { 200: z.object({ resent: z.number().int() }) },
  },
};

export const schedulingRoutes: FastifyPluginAsyncZod<{
  scheduling: SchedulingService;
  lookup: MembershipLookup;
}> = async (app, { scheduling, lookup }) => {
  app.addHook("preValidation", workspaceAccess(lookup));

  app.post("/api/v1/workspaces/:workspaceId/scheduled-meetings", CREATE, async (request, reply) =>
    reply.status(201).send(await scheduling.create(signedInUser(request), memberOf(request), request.body)),
  );

  app.get("/api/v1/workspaces/:workspaceId/calendar", CALENDAR, async (request) =>
    scheduling.calendar(signedInUser(request), memberOf(request), {
      from: new Date(request.query.from),
      to: new Date(request.query.to),
    }),
  );

  app.post("/api/v1/meetings/:meetingId/schedule/resend", RESEND, async (request) =>
    scheduling.resend(signedInUser(request), idParam(request.params.meetingId)),
  );

  app.get("/api/v1/meetings/:meetingId/schedule", DETAILS, async (request) =>
    scheduling.details(signedInUser(request), idParam(request.params.meetingId)),
  );
};
