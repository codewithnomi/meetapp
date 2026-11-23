// Scheduled meetings and the calendar (F13 design.md "Backend endpoints"). Creating and reading the
// calendar need membership of the workspace (plugins/workspace-access.ts, 404 otherwise); a meeting's
// schedule is for its organizer, co-organizers and invited members, and anyone else gets the same 404
// as for no meeting (S1, S2, AC-F13-26).
import {
  calendarQuerySchema,
  calendarResponseSchema,
  meetingParamsSchema,
  reminderDismissBodySchema,
  remindersDueQuerySchema,
  remindersDueSchema,
  scheduleAnswerBodySchema,
  scheduleBodySchema,
  scheduleCancelBodySchema,
  scheduleDetailsSchema,
  scheduleUpdateBodySchema,
  workspaceParamsSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import { z } from "zod";
import { signedInUser } from "../../plugins/session.ts";
import { idParam, memberOf, workspaceAccess, type MembershipLookup } from "../../plugins/workspace-access.ts";
import type { SchedulingChangesService } from "./scheduling-changes.service.ts";
import type { SchedulingService } from "./scheduling.service.ts";
import type { RemindersService } from "./reminders.service.ts";

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
      "Organizer and co-organizers (an invitee: 403; anyone else: 404). Counts toward the 1,000 meeting emails an hour (429 TOO_MANY_EMAILS).",
    tags,
    params: meetingParamsSchema,
    response: { 200: z.object({ resent: z.number().int() }) },
  },
};

const MANAGERS = "Organizer and co-organizers; an invitee gets 403, anyone else 404.";

const UPDATE = {
  schema: {
    summary: "Change a scheduled meeting (this occurrence or the series)",
    description: `${MANAGERS} Moving the series' time resets everyone's answers and drops one-occurrence changes. Invitees change only with the series. Emails: update, invite (added) and cancel (removed), counted toward 1,000 an hour (429 TOO_MANY_EMAILS).`,
    tags,
    params: meetingParamsSchema,
    body: scheduleUpdateBodySchema,
    response: { 200: scheduleDetailsSchema },
  },
};

const CANCEL = {
  schema: {
    summary: "Cancel a scheduled meeting (this occurrence or the series)",
    description: `${MANAGERS} The series' link stops working at once; every invitee gets a cancellation.`,
    tags,
    params: meetingParamsSchema,
    body: scheduleCancelBodySchema,
    response: { 200: z.object({ cancelled: z.boolean() }) },
  },
};

const ANSWER = {
  schema: {
    summary: "Accept, Tentative or Decline (this occurrence or the series)",
    description: "Invited members only; anyone else gets 404. The organizer sees it within seconds.",
    tags,
    params: meetingParamsSchema,
    body: scheduleAnswerBodySchema,
    response: { 200: scheduleDetailsSchema },
  },
};

const DUE = {
  schema: {
    summary: "Reminders that should be showing now",
    description:
      "For the app on start and reconnect (AC-F13-22): due, not dismissed (or snoozed past), meeting not ended. The app's time zone is kept for all-day reminders at 09:00.",
    tags,
    params: workspaceParamsSchema,
    querystring: remindersDueQuerySchema,
    response: { 200: remindersDueSchema },
  },
};

const DISMISS = {
  schema: {
    summary: "Dismiss or snooze (5 minutes) a reminder",
    description: "Closes it in every window and device of this person. 404 for a meeting the caller may not see.",
    tags,
    body: reminderDismissBodySchema,
    response: { 200: z.object({ snoozedUntil: z.iso.datetime().nullable() }) },
  },
};

export const schedulingRoutes: FastifyPluginAsyncZod<{
  scheduling: SchedulingService;
  changes: SchedulingChangesService;
  reminders: RemindersService;
  lookup: MembershipLookup;
}> = async (app, { scheduling, changes, reminders, lookup }) => {
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

  app.patch("/api/v1/meetings/:meetingId/schedule", UPDATE, async (request) =>
    changes.update(signedInUser(request), idParam(request.params.meetingId), request.body),
  );

  app.post("/api/v1/meetings/:meetingId/schedule/cancel", CANCEL, async (request) =>
    changes.cancel(signedInUser(request), idParam(request.params.meetingId), request.body),
  );

  app.put("/api/v1/meetings/:meetingId/schedule/answer", ANSWER, async (request) =>
    changes.answer(signedInUser(request), idParam(request.params.meetingId), request.body),
  );

  app.get("/api/v1/workspaces/:workspaceId/reminders/due", DUE, async (request) =>
    reminders.due(signedInUser(request), memberOf(request), request.query.timeZone),
  );

  app.post("/api/v1/reminders/dismiss", DISMISS, async (request) =>
    reminders.dismiss(signedInUser(request), request.body),
  );

  app.get("/api/v1/meetings/:meetingId/schedule", DETAILS, async (request) =>
    scheduling.details(signedInUser(request), idParam(request.params.meetingId)),
  );
};
