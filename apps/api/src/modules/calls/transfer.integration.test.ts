// Other devices and transfer (F15 T10; design 3.8, 5; AC-F15-33, AC-F15-20). Real routes, database and
// signed call server reports. Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { callAttendances, calls } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { localConfig } from "../../test-support/integration.ts";
import { webhookBody, webhookSignature, type FakeEvent } from "../../test-support/livekit-events.ts";
import { caller, namedPerson, seedWorkspace, type Call, type Person } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

interface Answer {
  attendanceId: string;
  ticket: string;
  call: { callId: string; pass: string };
}
interface Active {
  calls: {
    callId: string;
    conversationId: string;
    meetingId: null;
    title: string;
    media: string;
    seats: { attendanceId: string; joinedAt: string }[];
  }[];
}

const config = () => ({ ...localConfig(), DATA_ENCRYPTION_KEY: "x".repeat(40) });

async function team(label: string, size: number) {
  const people = await Promise.all(
    Array.from({ length: size }, (_, i) => namedPerson(t, `${label}-${String(i)}`, `Person ${String(i + 1)}`)),
  );
  const workspaceId = await seedWorkspace(
    t,
    people.map((p, i) => [p, i === 0 ? "owner" : "member"]),
  );
  return { people, workspaceId };
}
const chatOf = async (person: Person, workspaceId: string, others: Person[]) =>
  (
    await call(person.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, {
      userIds: others.map((p) => p.id),
    })
  ).json<{ id: string }>().id;
async function startCall(p: Person, id: string) {
  const response = await call(p.token, "POST", `/api/v1/conversations/${id}/calls`, { media: "video" });
  expect(response.statusCode).toBe(201);
  return response.json<Answer>();
}
async function accept(p: Person, callId: string) {
  const response = await call(p.token, "POST", `/api/v1/calls/${callId}/accept`);
  expect(response.statusCode).toBe(200);
  return response.json<Answer>();
}
const seatsOf = (callId: string) =>
  t.database.db.select().from(callAttendances).where(eq(callAttendances.callId, callId));
const seatById = async (callId: string, id: string) => (await seatsOf(callId)).find((s) => s.id === id);
const callRow = async (callId: string) => (await t.database.db.select().from(calls).where(eq(calls.id, callId)))[0];
const setInCall = (attendanceId: string) =>
  t.database.db
    .update(callAttendances)
    .set({ status: "in_call", joinedAt: new Date() })
    .where(eq(callAttendances.id, attendanceId));
async function report(event: FakeEvent) {
  const body = webhookBody(event);
  return t.app.inject({
    method: "POST",
    url: "/api/v1/livekit/webhook",
    payload: body,
    headers: { "content-type": "application/webhook+json", authorization: await webhookSignature(config(), body) },
  });
}
const reportJoined = (callId: string, attendanceId: string) =>
  report({ event: "participant_joined", room: callId, identity: attendanceId });
const transferRaw = (p: Person, callId: string, fromAttendanceId: string) =>
  call(p.token, "POST", `/api/v1/calls/${callId}/transfer`, { fromAttendanceId });
const active = (p: Person) => call(p.token, "GET", "/api/v1/me/calls/active");

/** A DM with M1 and M2 both connected. */
async function dmCall(label: string) {
  const { people, workspaceId } = await team(label, 2);
  const [m1, m2] = people as [Person, Person];
  const id = await chatOf(m1, workspaceId, [m2]);
  const first = await startCall(m1, id);
  const second = await accept(m2, first.call.callId);
  await setInCall(first.attendanceId);
  await setInCall(second.attendanceId);
  return { m1, m2, workspaceId, id, callId: first.call.callId, seat1: first, seat2: second };
}

describe("my running calls", { timeout: 60_000 }, () => {
  it("TC-F15-40 [AC-F15-33] lists only the signed-in person's own running calls with their seats", async () => {
    const { m1, m2, id, callId, seat2 } = await dmCall("t40");
    const outsider = await namedPerson(t, "t40-x", "Outsider");
    await seedWorkspace(t, [[outsider, "owner"]], "Other");

    const mine = await active(m2);
    expect(mine.statusCode).toBe(200);
    const body = mine.json<Active>();
    expect(body.calls).toHaveLength(1);
    const [entry] = body.calls;
    expect(entry?.callId).toBe(callId);
    expect(entry?.conversationId).toBe(id);
    expect(entry?.meetingId).toBeNull();
    expect(entry?.title.length).toBeGreaterThan(0);
    expect(entry?.seats.map((s) => s.attendanceId)).toEqual([seat2.attendanceId]);

    // M1 sees only M1's seat, never M2's.
    const theirs = (await active(m1)).json<Active>();
    expect(theirs.calls.flatMap((c) => c.seats.map((s) => s.attendanceId))).not.toContain(seat2.attendanceId);

    const none = await active(outsider);
    expect(none.statusCode).toBe(200);
    expect(none.json()).toEqual({ calls: [] });

    const signedOut = await t.app.inject({
      method: "GET",
      url: "/api/v1/me/calls/active",
      headers: { origin: "app://meetapp" },
    });
    expect(signedOut.statusCode).toBe(401);
  });
});

describe("moving a call to this device", { timeout: 60_000 }, () => {
  it("TC-F15-41 [AC-F15-33] the old seat leaves once the new seat connects, and the call goes on", async () => {
    const { m2, callId, seat1, seat2 } = await dmCall("t41");

    const moved = await transferRaw(m2, callId, seat2.attendanceId);
    expect(moved.statusCode).toBe(200);
    const fresh = moved.json<Answer>();
    expect(fresh.attendanceId).not.toBe(seat2.attendanceId);
    expect(fresh.call.pass.length).toBeGreaterThan(5);
    expect((await seatById(callId, fresh.attendanceId))?.actedBy).toBe(seat2.attendanceId);
    expect((await seatById(callId, seat2.attendanceId))?.status).toBe("in_call");

    const answer = await reportJoined(callId, fresh.attendanceId);
    expect(answer.statusCode).toBeLessThan(300);

    const old = await seatById(callId, seat2.attendanceId);
    expect(old?.status).toBe("left");
    expect(old?.leftReason).toBe("leave");
    expect((await seatById(callId, fresh.attendanceId))?.status).toBe("in_call");
    expect((await seatById(callId, seat1.attendanceId))?.status).toBe("in_call");
    expect((await callRow(callId))?.endedAt ?? null).toBeNull();
  });

  it("TC-F15-42 [AC-F15-33] a new seat that never connects, or connects too late, leaves the old seat alone; foreign seats are 404", async () => {
    const { m1, m2, callId, seat2 } = await dmCall("t42");

    const moved = await transferRaw(m2, callId, seat2.attendanceId);
    expect(moved.statusCode).toBe(200);
    const fresh = moved.json<Answer>();
    expect((await seatById(callId, seat2.attendanceId))?.status).toBe("in_call");
    expect((await callRow(callId))?.endedAt ?? null).toBeNull();

    // Reported after more than 30 s: the old seat stays.
    await t.database.db
      .update(callAttendances)
      .set({ admittedAt: new Date(Date.now() - 31_000) })
      .where(eq(callAttendances.id, fresh.attendanceId));
    await reportJoined(callId, fresh.attendanceId);
    expect((await seatById(callId, seat2.attendanceId))?.status).toBe("in_call");
    expect((await callRow(callId))?.endedAt ?? null).toBeNull();

    // Someone else's seat, and a seat of another call.
    const own = await transferRaw(m1, callId, seat2.attendanceId);
    expect(own.statusCode).toBe(404);
    const other = await dmCall("t42b");
    const wrongCall = await transferRaw(m2, callId, other.seat2.attendanceId);
    expect(wrongCall.statusCode).toBe(404);
    const unknownSeat = await transferRaw(m2, callId, randomUUID());
    expect(unknownSeat.statusCode).toBe(404);
    expect((await seatById(callId, seat2.attendanceId))?.status).toBe("in_call");
  });
});

describe("access to the transfer routes", { timeout: 60_000 }, () => {
  it("TC-F15-63 [AC-F15-20] outsiders, colleagues and other workspaces get the same 404 as an unknown id", async () => {
    const { people, workspaceId } = await team("t63", 3);
    const [m1, m2, colleague] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const started = await startCall(m1, id);
    const callId = started.call.callId;
    const stranger = await namedPerson(t, "t63-x", "Stranger");
    await seedWorkspace(t, [[stranger, "owner"]], "Other");
    const before = (await seatsOf(callId)).length;

    const strip = (body: string) => {
      const error = { ...(JSON.parse(body) as { error: Record<string, unknown> }).error };
      delete error.requestId;
      return error;
    };
    const reference = await transferRaw(colleague, randomUUID(), randomUUID());
    expect(reference.statusCode).toBe(404);
    for (const person of [colleague, stranger, m2]) {
      const answer = await transferRaw(person, callId, started.attendanceId);
      expect(answer.statusCode).toBe(404);
      expect(strip(answer.body)).toEqual(strip(reference.body));
    }
    const signedOut = await t.app.inject({
      method: "POST",
      url: `/api/v1/calls/${callId}/transfer`,
      payload: { fromAttendanceId: started.attendanceId },
      headers: { origin: "app://meetapp" },
    });
    expect(signedOut.statusCode).toBe(401);

    for (const person of [colleague, stranger]) {
      expect((await active(person)).json()).toEqual({ calls: [] });
    }
    expect(await seatsOf(callId)).toHaveLength(before);
  });
});
