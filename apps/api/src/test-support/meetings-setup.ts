// Test helpers for the meeting tests (F02): a team with a meeting, finding it, joining as a member or a
// guest, and calls with the meeting ticket. Each call uses its own network address, so the per-address
// limits of one step don't touch another.
import { randomBytes } from "node:crypto";
import { callAttendances } from "@meetapp/db";
import { eq } from "drizzle-orm";
import type { AuthTestApp } from "./auth-app.ts";
import { newPerson, seedWorkspace, type Person } from "./workspaces-setup.ts";

export interface TestMeeting {
  id: string;
  workspaceId: string;
  link: string;
  meetingNumber: string;
  passcode: string;
  organizer: Person;
}

export interface Joined {
  attendanceId: string;
  ticket: string;
  status: string;
  group: string;
  title: string;
  call?: { callId: string; pass: string; role: string; serverUrl: string };
}

let addressCounter = 0;
export const newAddress = () =>
  `10.9.${String(Math.floor(addressCounter / 250) % 250)}.${String((addressCounter++ % 250) + 1)}`;
export const newDeviceKey = () => randomBytes(32).toString("base64url");

const headers = (who?: Person) => ({
  origin: "app://meetapp",
  ...(who ? { authorization: `Bearer ${who.token}` } : {}),
});

/** A company workspace (organizer = owner, plus members) with one link meeting. */
export async function meetingWithTeam(t: AuthTestApp, label: string, memberCount = 0, options: object = {}) {
  const organizer = await newPerson(t, `${label}-organizer`);
  const members = await Promise.all(
    Array.from({ length: memberCount }, (_, i) => newPerson(t, `${label}-m${String(i)}`)),
  );
  const workspaceId = await seedWorkspace(t, [
    [organizer, "owner"],
    ...members.map((m): [Person, "member"] => [m, "member"]),
  ]);
  const created = await t.app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${workspaceId}/meetings`,
    payload: { kind: "link", title: `${label} meeting` },
    headers: headers(organizer),
  });
  const meeting = { ...created.json<Omit<TestMeeting, "workspaceId" | "organizer">>(), workspaceId, organizer };
  if (Object.keys(options).length > 0) {
    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/meetings/${meeting.id}/options`,
      payload: options,
      headers: headers(organizer),
    });
  }
  return { meeting, organizer, members };
}

export async function lookupToken(t: AuthTestApp, meeting: TestMeeting, who?: Person): Promise<string> {
  const found = await t.app.inject({
    method: "POST",
    url: "/api/v1/meeting-lookups",
    payload: { link: meeting.link },
    remoteAddress: newAddress(),
    headers: headers(who),
  });
  return found.json<{ lookupToken: string }>().lookupToken;
}

/** Joins as `who` (signed in), or as a guest when `who` is undefined. */
export async function join(
  t: AuthTestApp,
  meeting: TestMeeting,
  who?: Person,
  extra: { guestName?: string; deviceKey?: string; token?: string } = {},
) {
  return t.app.inject({
    method: "POST",
    url: "/api/v1/meetings/join",
    payload: {
      lookupToken: extra.token ?? (await lookupToken(t, meeting, who)),
      deviceKey: extra.deviceKey ?? newDeviceKey(),
      ...(who ? {} : { guestName: extra.guestName ?? "Guest Person" }),
    },
    remoteAddress: newAddress(),
    headers: headers(who),
  });
}

export async function joined(t: AuthTestApp, meeting: TestMeeting, who?: Person, extra = {}): Promise<Joined> {
  const answer = await join(t, meeting, who, extra);
  if (answer.statusCode !== 200) throw new Error(`join answered ${String(answer.statusCode)}: ${answer.body}`);
  return answer.json<Joined>();
}

/** A call with the meeting ticket. */
export function withTicket(
  t: AuthTestApp,
  ticket: string | undefined,
  request: { method: "GET" | "POST" | "PATCH" | "DELETE"; url: string; payload?: object },
) {
  return t.app.inject({
    method: request.method,
    url: request.url,
    ...(request.payload ? { payload: request.payload } : {}),
    remoteAddress: newAddress(),
    headers: { origin: "app://meetapp", ...(ticket ? { "x-meeting-ticket": ticket } : {}) },
  });
}

export const statusOf = async (t: AuthTestApp, person: Joined) =>
  (await withTicket(t, person.ticket, { method: "GET", url: `/api/v1/attendances/${person.attendanceId}` })).json<
    Joined & { actedByName?: string; leftReason?: string }
  >();

/**
 * The limits count per clock minute. A test that counts tries in the last seconds of a minute would see
 * the count start again halfway, so it waits for a fresh minute first.
 */
export async function freshMinute(): Promise<void> {
  const intoMinute = Date.now() % 60_000;
  if (intoMinute > 40_000) await new Promise((done) => setTimeout(done, 60_000 - intoMinute + 200));
}

/** A call with the organizer, a co-organizer, a presenter and two attendees. */
export async function roomOfFive(t: AuthTestApp, label: string) {
  const { meeting, organizer, members } = await meetingWithTeam(t, label, 4);
  const [coPerson, presenterPerson, first, second] = members;
  if (!coPerson || !presenterPerson || !first || !second) throw new Error("people missing");
  await t.app.inject({
    method: "PATCH",
    url: `/api/v1/meetings/${meeting.id}/options`,
    payload: { coOrganizerIds: [coPerson.id] },
    headers: { origin: "app://meetapp", authorization: `Bearer ${organizer.token}` },
  });
  const host = await joined(t, meeting, organizer);
  const co = await joined(t, meeting, coPerson);
  const presenter = await joined(t, meeting, presenterPerson);
  const attendees = [await joined(t, meeting, first), await joined(t, meeting, second)];
  for (const attendee of attendees) {
    await t.database.db
      .update(callAttendances)
      .set({ roleOverride: "attendee" })
      .where(eq(callAttendances.id, attendee.attendanceId));
  }
  const callId = host.call?.callId ?? "";
  return {
    meeting,
    organizer,
    host,
    co,
    presenter,
    attendees,
    callId,
    people: { coPerson, presenterPerson, first, second },
  };
}
