// Being called (F15 T14; design.md 3.3, 3.4, 3.8; AC-F15-06, 10, 11). Real routes, database, live lines and Redis.
// Own database.
import type { LineServerMessage } from "@meetapp/contracts";
import { callAttendances, callRings } from "@meetapp/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { caller, namedPerson, seedWorkspace, type Call, type Person } from "../../test-support/workspaces-setup.ts";
import { joined, meetingWithTeam, withTicket } from "../../test-support/meetings-setup.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

interface Opened {
  ws: Awaited<ReturnType<AuthTestApp["app"]["injectWS"]>>;
  got: LineServerMessage[];
}
type Ring = Extract<LineServerMessage, { t: "ring" }>;

const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
async function until<T>(read: () => T | undefined, ms = 2000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error("nothing arrived in time");
    await settle(50);
  }
}

async function line(person: Person): Promise<Opened> {
  const ws = await t.app.injectWS("/api/v1/realtime", {
    headers: { origin: "app://meetapp", ...bearer(person.token) },
  });
  const got: LineServerMessage[] = [];
  ws.on("message", (data: Buffer) => got.push(JSON.parse(data.toString()) as LineServerMessage));
  await settle();
  return { ws, got };
}

const ringIn = (got: LineServerMessage[]) => got.find((m): m is Ring => m.t === "ring");

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
const startCall = async (person: Person, id: string, media = "video") => {
  const response = await call(person.token, "POST", `/api/v1/conversations/${id}/calls`, { media });
  expect(response.statusCode).toBe(201);
  return response.json<{ call: { callId: string } }>().call.callId;
};
const accept = (p: Person, callId: string) => call(p.token, "POST", `/api/v1/calls/${callId}/accept`);

const joinCall = (p: Person, callId: string) => call(p.token, "POST", `/api/v1/calls/${callId}/join`);
const ringsOf = (callId: string) => t.database.db.select().from(callRings).where(eq(callRings.callId, callId));
const seatsOf = (callId: string, userId: string) =>
  t.database.db
    .select()
    .from(callAttendances)
    .where(and(eq(callAttendances.callId, callId), eq(callAttendances.userId, userId)));
const ringAge = (callId: string, ms: number) =>
  t.database.db
    .update(callRings)
    .set({ rangAt: new Date(Date.now() - ms) })
    .where(eq(callRings.callId, callId));

describe("being called", { timeout: 120_000 }, () => {
  it("TC-F15-14 [AC-F15-06] a second window joins as a second participant; the person counts once", async () => {
    const { people, workspaceId } = await team("b14", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const callId = await startCall(m1, id);
    expect((await accept(m2, callId)).statusCode).toBe(200);
    const second = await joinCall(m2, callId);
    expect(second.statusCode).toBe(200);
    const seats = await seatsOf(callId, m2.id);
    expect(seats).toHaveLength(2);
    expect(new Set(seats.map((s) => s.id)).size).toBe(2);
    const running = (await call(m1.token, "GET", `/api/v1/conversations/${id}/call`)).json<{
      call: { people: number } | null;
    }>();
    expect(running.call?.people).toBe(2); // M1 and M2, M2 once
  });

  it("TC-F15-24 [AC-F15-10] people in a meeting or another call are still rung; accepting after leaving ends the old seat first", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "b24", 3);
    const [m1, m2, m3] = members as [Person, Person, Person];
    const toM2 = await chatOf(organizer, meeting.workspaceId, [m2]);
    const toM3 = await chatOf(organizer, meeting.workspaceId, [m3]);
    const other = await chatOf(m1, meeting.workspaceId, [m3]);

    const inMeeting = await joined(t, meeting, m2);
    const otherCall = await startCall(m1, other);
    expect((await accept(m3, otherCall)).statusCode).toBe(200);
    const m2Line = await line(m2);
    const m3Line = await line(m3);

    const ring2 = await startCall(organizer, toM2);
    const ring3 = await startCall(organizer, toM3);
    expect(await until(() => ringIn(m2Line.got))).toMatchObject({ callId: ring2 });
    expect(await until(() => ringIn(m3Line.got))).toMatchObject({ callId: ring3 });

    // The app leaves the current call first, then accepts.
    const left = await withTicket(t, inMeeting.ticket, {
      method: "DELETE",
      url: `/api/v1/attendances/${inMeeting.attendanceId}`,
    });
    expect(left.statusCode).toBe(204);
    expect((await accept(m2, ring2)).statusCode).toBe(200);
    const [old] = await t.database.db
      .select()
      .from(callAttendances)
      .where(eq(callAttendances.id, inMeeting.attendanceId));
    const [fresh] = await seatsOf(ring2, m2.id);
    expect(old?.status).toBe("left");
    expect(old?.leftAt?.getTime()).toBeLessThanOrEqual(fresh?.createdAt.getTime() ?? 0);
    for (const l of [m2Line, m3Line]) l.ws.terminate();
  });

  it("TC-F15-26 [AC-F15-11] with no window open nothing rings; the ring is missed and the note counts as unread 1", async () => {
    const { people, workspaceId } = await team("b26", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const callId = await startCall(m1, id);
    await ringAge(callId, 30_500);
    await t.accounts.callEnd.ringTimeout(callId);
    expect((await ringsOf(callId)).find((r) => r.userId === m2.id)?.state).toBe("missed");

    const late = await line(m2);
    expect(ringIn(late.got)).toBeUndefined();
    const list = (await call(m2.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`)).json<{
      conversations: { id: string; unread: number }[];
    }>();
    expect(list.conversations.find((c) => c.id === id)?.unread).toBe(1);
    late.ws.terminate();
  });
});
