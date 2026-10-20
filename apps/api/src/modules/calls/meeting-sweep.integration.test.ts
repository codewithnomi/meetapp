// TC-F02-102 (AC-F02-50, AC-F02-01), security: the outsider sweep for every meeting route (read from the
// server). Someone signed out, a person of another workspace, a member of the meeting's workspace who
// isn't in the meeting, and a guest of another meeting each get 401 or the same 404 as for a meeting that
// doesn't exist, with real ids, and nothing changes. Own database; needs the `pnpm dev` services.
import { callAttendances, calls, meetings, workspaces } from "@meetapp/db";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listRoutes, type RouteSummary } from "../../app.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { joined, meetingWithTeam, newAddress, type Joined } from "../../test-support/meetings-setup.ts";
import { newPerson, seedWorkspace, type Person } from "../../test-support/workspaces-setup.ts";

const SLOW = { timeout: 120_000 };
const NOWHERE = "00000000-0000-4000-8000-00000000dead";
/** Open to anyone by design, each with its own checks (lookups, join: TC-F02-15, 105; webhook: TC-F02-106). */
const OPEN = new Set(["POST /api/v1/meeting-lookups", "POST /api/v1/meetings/join", "POST /api/v1/livekit/webhook"]);
/** Every field any meeting route reads, filled with something an attacker would want. */
const PAYLOAD = {
  kind: "link",
  title: "Hijacked",
  allowGuests: false,
  lobbyBypass: "everyone",
  coOrganizerIds: [] as string[],
  attendanceIds: [] as string[],
  all: true,
  raised: true,
  role: "presenter",
  // F03: a valid chat message, so only the caller decides the answer.
  clientId: "00000000-0000-4000-8000-000000000001",
  messageId: "00000000-0000-4000-8000-000000000002",
  emoji: "👍",
  body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: "Hijacked" }] }] },
  locked: true,
};

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

type Method = "GET" | "POST" | "PATCH" | "DELETE";
type Caller = { label: string; headers: Record<string, string> };
const key = (route: RouteSummary) => `${route.method} ${route.url}`;
const withoutRequestId = (body: string) => body.replace(/"requestId":"[^"]*"/, "");
const isMeetingRoute = (route: RouteSummary) =>
  /^\/api\/v1\/(meetings|calls|attendances|meeting-lookups|livekit)\b/.test(route.url) ||
  /^\/api\/v1\/workspaces\/:workspaceId\/(meetings|settings)$/.test(route.url);

interface Ids {
  workspaceId: string;
  meetingId: string;
  callId: string;
  attendanceId: string;
}

const fill = (url: string, ids: Ids) =>
  url
    .replace(":workspaceId", ids.workspaceId)
    .replace(":meetingId", ids.meetingId)
    .replace(":callId", ids.callId)
    .replace(":attendanceId", ids.attendanceId)
    .replace(":messageId", ids.attendanceId);

/** Everything a refused call must leave unchanged. */
async function snapshot(ids: Ids): Promise<string> {
  const db = t.database.db;
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, ids.workspaceId));
  const [meeting] = await db.select().from(meetings).where(eq(meetings.id, ids.meetingId));
  const callRows = await db.select().from(calls).where(eq(calls.meetingId, ids.meetingId));
  const people = await db
    .select()
    .from(callAttendances)
    .where(eq(callAttendances.meetingId, ids.meetingId))
    .orderBy(asc(callAttendances.id));
  return JSON.stringify({ workspace, meeting, callRows, people });
}

/** A running call in W1 with the organizer inside; a member of W1 who isn't in it; W2 with its own meeting. */
async function scene() {
  const { meeting, organizer, members } = await meetingWithTeam(t, "sweep", 1);
  const [member] = members;
  if (!member) throw new Error("member missing");
  const host = await joined(t, meeting, organizer);
  const outsider = await newPerson(t, "sweep-outsider");
  await seedWorkspace(t, [[outsider, "owner"]], "Other team");
  const other = await meetingWithTeam(t, "sweep-other");
  await joined(t, other.meeting, other.organizer);
  const otherGuest = await joined(t, other.meeting, undefined, { guestName: "Other Guest" });
  const ids: Ids = {
    workspaceId: meeting.workspaceId,
    meetingId: meeting.id,
    callId: host.call?.callId ?? "",
    attendanceId: host.attendanceId,
  };
  return { ids, member, outsider, otherGuest };
}

const bearer = (who: Person) => ({ authorization: `Bearer ${who.token}` });
const ticket = (who: Joined) => ({ "x-meeting-ticket": who.ticket });

function send(route: RouteSummary, url: string, headers: Record<string, string>) {
  const method = route.method as Method;
  return t.app.inject({
    method,
    url,
    ...(method === "GET" || method === "DELETE" ? {} : { payload: PAYLOAD }),
    remoteAddress: newAddress(),
    headers: { origin: "app://meetapp", ...headers },
  });
}

/** The member of W1 may create meetings and gets 403 on the settings (TC-F01-79), so those two are left out. */
const memberMay = (route: RouteSummary) => /\/workspaces\/:workspaceId\/(meetings|settings)$/.test(route.url);

describe("TC-F02-102 meeting outsider sweep", () => {
  it(
    "TC-F02-102 [AC-F02-50] [AC-F02-01] strangers get 401 or the 'no such meeting' answer on every meeting route; nothing changes",
    SLOW,
    async () => {
      const { ids, member, outsider, otherGuest } = await scene();
      const routes = listRoutes(t.app).filter((route) => isMeetingRoute(route) && !OPEN.has(key(route)));
      expect(routes.length).toBeGreaterThanOrEqual(20);
      const callers: Caller[] = [
        { label: "signed out", headers: {} },
        { label: "other workspace", headers: bearer(outsider) },
        { label: "member not in the meeting", headers: bearer(member) },
        { label: "guest of another meeting", headers: ticket(otherGuest) },
      ];
      const nowhere: Ids = { workspaceId: NOWHERE, meetingId: NOWHERE, callId: NOWHERE, attendanceId: NOWHERE };
      const before = await snapshot(ids);
      for (const route of routes) {
        for (const caller of callers) {
          if (caller.label === "member not in the meeting" && memberMay(route)) continue;
          const label = `${key(route)} as ${caller.label}`;
          const real = await send(route, fill(route.url, ids), caller.headers);
          expect([401, 404], `${label}: ${real.body}`).toContain(real.statusCode);
          if (real.statusCode === 401) continue;
          // The same caller with ids that don't exist; a ticket route is compared without the ticket.
          const missingHeaders = route.access === "optional" ? {} : caller.headers;
          const missing = await send(route, fill(route.url, nowhere), missingHeaders);
          expect(withoutRequestId(real.body), label).toBe(withoutRequestId(missing.body));
        }
      }
      expect(await snapshot(ids)).toBe(before);
    },
  );
});
