// Making meetings and their options (F02 design.md section 6). Creating needs membership of the
// workspace (plugins/workspace-access.ts, 404 otherwise); a meeting's details and options are for its
// organizer and co-organizers only, and anyone else gets the same 404 as for no meeting (S1, S2).
import {
  createMeetingBodySchema,
  idempotencyHeadersSchema,
  meetingCreatedSchema,
  meetingDetailsSchema,
  meetingLookupBodySchema,
  meetingLookupResponseSchema,
  meetingParamsSchema,
  updateMeetingBodySchema,
  workspaceParamsSchema,
} from "@meetapp/contracts";
import type { FastifyPluginAsyncZod } from "@fastify/type-provider-zod";
import type { Idempotency } from "../../plugins/idempotency.ts";
import { signedInUser } from "../../plugins/session.ts";
import { idParam, memberOf, workspaceAccess, type MembershipLookup } from "../../plugins/workspace-access.ts";
import type { LookupService } from "./lookup.service.ts";
import type { MeetingsService } from "./meetings.service.ts";

const tags = ["meetings"];
const ONLY_MANAGERS = "Organizer and co-organizers; anyone else gets 404, as for a meeting that doesn't exist.";

const CREATE = {
  schema: {
    summary: "Make a meeting (Meet now or Get a meeting link)",
    description:
      "Any member of the workspace; 50 an hour per person (429 TOO_MANY_ATTEMPTS). Send an Idempotency-Key header: the same key within 10 minutes returns the first meeting. 404 when the caller isn't a member.",
    tags,
    headers: idempotencyHeadersSchema,
    params: workspaceParamsSchema,
    body: createMeetingBodySchema,
    response: { 201: meetingCreatedSchema },
  },
};

const GET = {
  schema: {
    summary: "A meeting's details (Meeting info)",
    description: ONLY_MANAGERS,
    tags,
    params: meetingParamsSchema,
    response: { 200: meetingDetailsSchema },
  },
};

const UPDATE = {
  schema: {
    summary: "Change a meeting's title or options",
    description: `${ONLY_MANAGERS} Only the organizer names co-organizers (403): up to 10, all in the meeting's workspace (400). A link meeting gets another 60 days.`,
    tags,
    params: meetingParamsSchema,
    body: updateMeetingBodySchema,
    response: { 200: meetingDetailsSchema },
  },
};

const LOOKUP = {
  config: { access: "optional" as const },
  schema: {
    summary: "Find a meeting by its link, or its ID and passcode",
    description:
      "Signed in or as a guest. Only the title, the caller's group and a 15-minute lookup token. Every miss: the same 404 MEETING_NOT_FOUND after the same time; the right secret of an expired meeting: 410 MEETING_EXPIRED. 20 wrong tries a minute per person and per address, and 20 wrong passcodes a minute per meeting ID (429 TOO_MANY_ATTEMPTS).",
    tags,
    body: meetingLookupBodySchema,
    response: { 200: meetingLookupResponseSchema },
  },
};

export const meetingsRoutes: FastifyPluginAsyncZod<{
  meetings: MeetingsService;
  lookups: LookupService;
  lookup: MembershipLookup;
  idempotency: Idempotency;
}> = async (app, { meetings, lookups, lookup, idempotency }) => {
  app.addHook("preValidation", workspaceAccess(lookup));

  app.post("/api/v1/workspaces/:workspaceId/meetings", CREATE, async (request, reply) => {
    const caller = signedInUser(request);
    const membership = memberOf(request);
    const created = await idempotency.once(`meetings:${caller.id}`, request.headers["idempotency-key"], () =>
      meetings.create(caller, membership, request.body.kind, request.body.title),
    );
    return reply.status(201).send(created);
  });

  app.post("/api/v1/meeting-lookups", LOOKUP, async (request) =>
    lookups.lookup({ ...request.body, userId: request.user?.id, address: request.ip }),
  );

  app.get("/api/v1/meetings/:meetingId", GET, async (request) =>
    meetings.get(signedInUser(request), idParam(request.params.meetingId)),
  );

  app.patch("/api/v1/meetings/:meetingId/options", UPDATE, async (request) =>
    meetings.update(signedInUser(request), idParam(request.params.meetingId), request.body),
  );
};
