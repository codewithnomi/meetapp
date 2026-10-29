// Timeouts and ending (F15 T5; design.md 3.3, 3.5; AC-F15-08, 09, 14, 19). Real routes, database, live lines.
// Time is moved by setting timestamps back in the database. Own database.
import type { LineServerMessage } from "@meetapp/contracts";
import { callAttendances, callRings, calls, chatMessages } from "@meetapp/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  caller,
  errorCode,
  namedPerson,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";

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
type Stop = Extract<LineServerMessage, { t: "ring_stop" }>;

const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
async function until<T>(read: () => T | undefined, ms = 3000): Promise<T> {
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
const stopFor = (callId: string, reason: string) => (l: Opened) =>
  l.got.find((m): m is Stop => m.t === "ring_stop" && m.callId === callId && m.reason === reason);

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
const startCall = async (person: Person, id: string) => {
  const response = await call(person.token, "POST", `/api/v1/conversations/${id}/calls`, { media: "video" });
  expect(response.statusCode).toBe(201);
  return response.json<{ call: { callId: string } }>().call.callId;
};
const accept = (p: Person, callId: string) => call(p.token, "POST", `/api/v1/calls/${callId}/accept`);

const ringsOf = (callId: string) => t.database.db.select().from(callRings).where(eq(callRings.callId, callId));
const stateOf = async (callId: string, userId: string) =>
  (await ringsOf(callId)).find((r) => r.userId === userId)?.state;
const callRow = async (callId: string) => (await t.database.db.select().from(calls).where(eq(calls.id, callId)))[0];
const seatsOf = (callId: string, userId: string) =>
  t.database.db
    .select()
    .from(callAttendances)
    .where(and(eq(callAttendances.callId, callId), eq(callAttendances.userId, userId)));
const ago = (ms: number) => new Date(Date.now() - ms);
const ringAge = (callId: string, ms: number) =>
  t.database.db
    .update(callRings)
    .set({ rangAt: ago(ms) })
    .where(eq(callRings.callId, callId));

/** The call server reported the person connected (F02 way: joined_at set, in the call). */
const connect = (callId: string, userId: string) =>
  t.database.db
    .update(callAttendances)
    .set({ status: "in_call", joinedAt: new Date() })
    .where(and(eq(callAttendances.callId, callId), eq(callAttendances.userId, userId)));
/** The person left and the report reached the end rules. */
async function leave(callId: string, userId: string) {
  await t.database.db
    .update(callAttendances)
    .set({ status: "left", leftAt: new Date(), leftReason: "leave" })
    .where(and(eq(callAttendances.callId, callId), eq(callAttendances.userId, userId)));
  await t.accounts.callEnd.left(callId);
}
async function notes(conversationId: string, event: string, callId: string) {
  const rows = await t.database.db
    .select({ system: chatMessages.system })
    .from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.kind, "system")));
  return rows
    .map((r) => r.system as { event?: string; forUserId?: string; callId?: string; seconds?: number; names?: string[] })
    .filter((s) => s.event === event && s.callId === callId);
}

describe("timeouts and ending", { timeout: 120_000 }, () => {
  it("TC-F15-18 [AC-F15-08, AC-F15-19] a one-to-one ring stays at 29 s and is missed at 30 s", async () => {
    const { people, workspaceId } = await team("e18", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const m1Line = await line(m1);
    const m2Line = await line(m2);
    const callId = await startCall(m1, id);

    await ringAge(callId, 29_000);
    await t.accounts.callEnd.ringTimeout(callId);
    expect(await stateOf(callId, m2.id)).toBe("ringing");
    expect((await callRow(callId))?.endedAt).toBeNull();

    await ringAge(callId, 30_500);
    await t.accounts.callEnd.ringTimeout(callId);
    expect(await stateOf(callId, m2.id)).toBe("missed");
    expect(await until(() => stopFor(callId, "missed")(m2Line))).toBeTruthy();
    expect(await until(() => stopFor(callId, "missed")(m1Line))).toBeTruthy();
    expect((await callRow(callId))?.endedAt).not.toBeNull();
    const missed = await notes(id, "call_missed", callId);
    expect(missed.map((n) => n.forUserId)).toEqual([m2.id]);
    for (const l of [m1Line, m2Line]) l.ws.terminate();
  });

  it("TC-F15-19 [AC-F15-08] group: nobody joined ends the call; one who joined keeps it running", async () => {
    const { people, workspaceId } = await team("e19", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);

    const nobody = await startCall(m1, id);
    await ringAge(nobody, 30_500);
    await t.accounts.callEnd.ringTimeout(nobody);
    expect(await stateOf(nobody, m2.id)).toBe("missed");
    expect(await stateOf(nobody, m3.id)).toBe("missed");
    expect((await callRow(nobody))?.endedAt).not.toBeNull();
    expect((await notes(id, "call_missed", nobody)).map((n) => n.forUserId).sort()).toEqual([m2.id, m3.id].sort());

    const running = await startCall(m1, id);
    expect((await accept(m2, running)).statusCode).toBe(200);
    await connect(running, m1.id);
    await connect(running, m2.id);
    await ringAge(running, 30_500);
    await t.accounts.callEnd.ringTimeout(running);
    expect(await stateOf(running, m2.id)).toBe("accepted");
    expect(await stateOf(running, m3.id)).toBe("missed");
    expect((await notes(id, "call_missed", running)).map((n) => n.forUserId)).toEqual([m3.id]);
    expect((await callRow(running))?.endedAt).toBeNull();
  });

  it("TC-F15-20 [AC-F15-08] accepting after the ring became missed gives RING_OVER and no seat", async () => {
    const { people, workspaceId } = await team("e20", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const callId = await startCall(m1, id);
    await ringAge(callId, 30_500);
    await t.accounts.callEnd.ringTimeout(callId);

    const late = await accept(m2, callId);
    expect(late.statusCode).toBe(409);
    expect(errorCode(late)).toBe("RING_OVER");
    expect(await seatsOf(callId, m2.id)).toEqual([]);
  });

  it("TC-F15-21 [AC-F15-09] the starter cancels a group call: every ring cancelled, one note each, then leaving ends it", async () => {
    const { people, workspaceId } = await team("e21", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const lines = [await line(m2), await line(m3)];
    const callId = await startCall(m1, id);

    expect((await call(m1.token, "DELETE", `/api/v1/calls/${callId}/ring`)).statusCode).toBe(204);
    expect(await stateOf(callId, m2.id)).toBe("cancelled");
    expect(await stateOf(callId, m3.id)).toBe("cancelled");
    for (const l of lines) expect(await until(() => stopFor(callId, "cancelled")(l))).toBeTruthy();
    expect((await notes(id, "call_missed", callId)).map((n) => n.forUserId).sort()).toEqual([m2.id, m3.id].sort());

    await leave(callId, m1.id);
    expect((await callRow(callId))?.endedAt).not.toBeNull();
    expect(await notes(id, "call_missed", callId)).toHaveLength(2);
    for (const l of lines) l.ws.terminate();
  });

  it("TC-F15-80 [AC-F15-03] joining while rung answers the ring: the caller's Calling moves into the call", async () => {
    const { people, workspaceId } = await team("fx9j", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const [caller1, rung] = [await line(m1), await line(m2)];
    const callId = await startCall(m1, id);
    expect((await call(m2.token, "POST", `/api/v1/calls/${callId}/join`)).statusCode).toBe(200);
    expect(await until(() => stopFor(callId, "accepted")(caller1))).toBeTruthy();
    expect(await until(() => stopFor(callId, "accepted")(rung))).toBeTruthy();
    expect(await stateOf(callId, m2.id)).toBe("accepted");
    caller1.ws.terminate();
    rung.ws.terminate();
  });

  it("T-fix-9 [AC-F15-09] Cancel, then the app's own Leave, ends a call the caller never connected to", async () => {
    const { people, workspaceId } = await team("fx9", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const started = await call(m1.token, "POST", `/api/v1/conversations/${id}/calls`, { media: "audio" });
    const seat = started.json<{ attendanceId: string; ticket: string; call: { callId: string } }>();
    expect((await call(m1.token, "DELETE", `/api/v1/calls/${seat.call.callId}/ring`)).statusCode).toBe(204);
    // No call-server report will come: the caller was still on "Calling…".
    const left = await t.app.inject({
      method: "DELETE",
      url: `/api/v1/attendances/${seat.attendanceId}`,
      headers: { origin: "app://meetapp", authorization: `Bearer ${m1.token}`, "x-meeting-ticket": seat.ticket },
    });
    expect(left.statusCode).toBe(204);
    expect((await callRow(seat.call.callId))?.endedAt).not.toBeNull();
    const running = await call(m1.token, "GET", `/api/v1/conversations/${id}/call`);
    expect(running.json<{ call: unknown }>().call).toBeNull();
  });

  it("TC-F15-22 [AC-F15-09] the caller leaves alone: all rings cancelled and the call ends; with another inside it goes on", async () => {
    const { people, workspaceId } = await team("e22", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const lines = [await line(m2), await line(m3)];

    const alone = await startCall(m1, id);
    await connect(alone, m1.id);
    await leave(alone, m1.id);
    expect(await stateOf(alone, m2.id)).toBe("cancelled");
    expect(await stateOf(alone, m3.id)).toBe("cancelled");
    for (const l of lines) expect(await until(() => stopFor(alone, "cancelled")(l))).toBeTruthy();
    expect((await notes(id, "call_missed", alone)).map((n) => n.forUserId).sort()).toEqual([m2.id, m3.id].sort());
    expect((await callRow(alone))?.endedAt).not.toBeNull();

    const together = await startCall(m1, id);
    expect((await accept(m2, together)).statusCode).toBe(200);
    await connect(together, m1.id);
    await connect(together, m2.id);
    await leave(together, m1.id);
    expect(await stateOf(together, m3.id)).toBe("ringing");
    expect((await callRow(together))?.endedAt).toBeNull();
    for (const l of lines) l.ws.terminate();
  });

  it("TC-F15-31 [AC-F15-14] one-to-one ends when one of two leaves; a group when the last leaves; one ended note", async () => {
    const { people, workspaceId } = await team("e31", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const direct = await chatOf(m1, workspaceId, [m2]);
    const dCall = await startCall(m1, direct);
    expect((await accept(m2, dCall)).statusCode).toBe(200);
    await connect(dCall, m1.id);
    await connect(dCall, m2.id);
    await leave(dCall, m2.id);
    expect((await callRow(dCall))?.endedAt).not.toBeNull();
    await t.accounts.callEnd.ended(dCall);
    const dNotes = await notes(direct, "call_ended", dCall);
    expect(dNotes).toHaveLength(1);
    expect(typeof dNotes[0]?.seconds).toBe("number");
    expect([...(dNotes[0]?.names ?? [])].sort()).toEqual(["Person 1", "Person 2"]);

    const group = await chatOf(m1, workspaceId, [m2, m3]);
    const gCall = await startCall(m1, group);
    expect((await accept(m2, gCall)).statusCode).toBe(200);
    expect((await accept(m3, gCall)).statusCode).toBe(200);
    for (const p of people) await connect(gCall, p.id);
    await leave(gCall, m2.id);
    await leave(gCall, m3.id);
    expect((await callRow(gCall))?.endedAt).toBeNull();
    await leave(gCall, m1.id);
    expect((await callRow(gCall))?.endedAt).not.toBeNull();
    expect(await notes(group, "call_ended", gCall)).toHaveLength(1);
  });

  it("TC-F15-32 [AC-F15-14] at 30 hours the call ends and notes; the warning does not throw", async () => {
    const { people, workspaceId } = await team("e32", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const callId = await startCall(m1, id);
    expect((await accept(m2, callId)).statusCode).toBe(200);
    await connect(callId, m1.id);
    await connect(callId, m2.id);
    await t.database.db
      .update(calls)
      .set({ startedAt: ago(30 * 3600_000 + 60_000) })
      .where(eq(calls.id, callId));

    await expect(t.accounts.callJobs.endingSoon(callId)).resolves.toBeUndefined();
    await t.accounts.callJobs.timeLimit(callId);
    const row = await callRow(callId);
    expect(row?.endedAt).not.toBeNull();
    expect(row?.endReason).toBe("time_limit");
    expect(await notes(id, "call_ended", callId)).toHaveLength(1);
  });

  it("TC-F15-62 [AC-F15-19] the clean-up sweep stops rings older than 35 s, leaves younger ones", async () => {
    const { people, workspaceId } = await team("e62", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const other = await chatOf(m2, workspaceId, [m3]);
    const lines = [await line(m2), await line(m3)];
    const old = await startCall(m1, id);
    const young = await startCall(m2, other);
    await ringAge(old, 36_000);
    await ringAge(young, 20_000);

    await t.accounts.callEnd.sweep();
    expect(await stateOf(old, m2.id)).toBe("missed");
    expect(await stateOf(old, m3.id)).toBe("missed");
    for (const l of lines) expect(await until(() => stopFor(old, "missed")(l))).toBeTruthy();
    expect((await callRow(old))?.endedAt).not.toBeNull();
    expect((await notes(id, "call_missed", old)).map((n) => n.forUserId).sort()).toEqual([m2.id, m3.id].sort());
    expect(await stateOf(young, m3.id)).toBe("ringing");
    expect((await callRow(young))?.endedAt).toBeNull();
    for (const l of lines) l.ws.terminate();
  });

  it("TC-F15-62 [AC-F15-19] the every-minute clean-up runs the sweep", async () => {
    const { people, workspaceId } = await team("e62b", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const callId = await startCall(m1, id);
    await ringAge(callId, 36_000);
    await t.accounts.callJobs.cleanUp();
    expect(await stateOf(callId, m2.id)).toBe("missed");
  });
});

describe("status during a chat call", { timeout: 60_000 }, () => {
  const statusOf = async (viewer: Person, target: Person) =>
    (await call(viewer.token, "GET", `/api/v1/people/status?ids=${target.id}`)).json<{
      statuses: { userId: string; status: string }[];
    }>().statuses[0]?.status;

  it("TC-F15-38 [AC-F15-16] in a chat call colleagues see In a call; after leaving it goes back; others see nothing", async () => {
    const { people, workspaceId } = await team("st38", 2);
    const [m1, m2] = people as [Person, Person];
    const stranger = await namedPerson(t, "st38-x", "Stranger");
    const m2Line = await line(m2);
    expect(await statusOf(m1, m2)).toBe("available");
    const callId = await startCall(m2, await chatOf(m2, workspaceId, [m1]));
    await connect(callId, m2.id);
    expect(await statusOf(m1, m2)).toBe("in_call");
    expect(await statusOf(stranger, m2)).toBeUndefined();
    await leave(callId, m2.id);
    expect(await statusOf(m1, m2)).toBe("available");
    m2Line.ws.terminate();
  });
});
