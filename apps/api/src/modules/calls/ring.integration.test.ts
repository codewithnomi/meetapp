// Ringing (F15 T4; design.md 3.3, 3.4; AC-F15-05–09, 20, 34). Real routes, database, live lines and Redis.
// Own database.
import type { LineServerMessage } from "@meetapp/contracts";
import type { WebSocket } from "@fastify/websocket";
import { EventEmitter } from "node:events";
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
import { createLineHub } from "../chats/chats-line.ts";

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
type Stop = Extract<LineServerMessage, { t: "ring_stop" }>;

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

function fakeSocket() {
  const socket = Object.assign(new EventEmitter(), {
    OPEN: 1,
    readyState: 1,
    sent: [] as LineServerMessage[],
    send(data: string) {
      socket.sent.push(JSON.parse(data) as LineServerMessage);
    },
    close() {
      socket.readyState = 3;
    },
  });
  return socket;
}

const ringIn = (got: LineServerMessage[]) => got.find((m): m is Ring => m.t === "ring");
const stopIn = (got: LineServerMessage[]) => got.find((m): m is Stop => m.t === "ring_stop");

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
const decline = (p: Person, callId: string) => call(p.token, "POST", `/api/v1/calls/${callId}/decline`);
const cancel = (p: Person, callId: string) => call(p.token, "DELETE", `/api/v1/calls/${callId}/ring`);

const ringsOf = (callId: string) => t.database.db.select().from(callRings).where(eq(callRings.callId, callId));
const stateOf = async (callId: string, userId: string) =>
  (await ringsOf(callId)).find((r) => r.userId === userId)?.state;
const callRow = async (callId: string) => (await t.database.db.select().from(calls).where(eq(calls.id, callId)))[0];
const seatsOf = (callId: string, userId: string) =>
  t.database.db
    .select()
    .from(callAttendances)
    .where(and(eq(callAttendances.callId, callId), eq(callAttendances.userId, userId)));
async function missedNotes(conversationId: string) {
  const rows = await t.database.db
    .select({ system: chatMessages.system })
    .from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.kind, "system")));
  return rows
    .map((r) => r.system as { event?: string; forUserId?: string; callId?: string } | null)
    .filter((s) => s?.event === "call_missed");
}

describe("ringing", { timeout: 120_000 }, () => {
  it("TC-F15-10 [AC-F15-05, AC-F15-34] every window of the called person gets the ring, for group and one-to-one calls", async () => {
    const { people, workspaceId } = await team("r10", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const group = await chatOf(m1, workspaceId, [m2, m3]);
    const direct = await chatOf(m1, workspaceId, [m2]);
    const a = await line(m2);
    const b = await line(m2);
    const hub = createLineHub(t.accounts.chatsLine);
    const socket = fakeSocket();
    await hub.open(socket as unknown as WebSocket, m2.id, () => Promise.resolve(true));
    await settle();
    const m1Line = await line(m1);

    for (const [id, isGroup] of [
      [group, true],
      [direct, false],
    ] as const) {
      const callId = await startCall(m1, id, "audio");
      const [row] = await ringsOf(callId).then((rows) => rows.filter((r) => r.userId === m2.id));
      const expected = (row?.rangAt.getTime() ?? 0) + 30_000;
      for (const got of [a.got, b.got, socket.sent]) {
        const ring = await until(() => got.find((m): m is Ring => m.t === "ring" && m.callId === callId));
        expect(ring).toMatchObject({
          conversationId: id,
          media: "audio",
          from: { userId: m1.id, name: "Person 1", photoUrl: null },
        });
        expect(ring.groupName === null).toBe(!isGroup);
        expect(typeof ring.groupName).toBe(isGroup ? "string" : "object");
        expect(Math.abs(new Date(ring.expiresAt).getTime() - expected)).toBeLessThan(1000);
      }
      // The caller is not rung.
      expect(m1Line.got.some((m) => m.t === "ring" && m.callId === callId)).toBe(false);
      await cancel(m1, callId);
      await t.database.db.update(calls).set({ endedAt: new Date(), endReason: "ended" }).where(eq(calls.id, callId));
    }
    await hub.close();
    for (const l of [a, b, m1Line]) l.ws.terminate();
  });

  it("TC-F15-13 [AC-F15-06, AC-F15-34] two accepts at once: one wins, the other gets RING_OVER (10 times)", async () => {
    for (let round = 0; round < 10; round += 1) {
      const { people, workspaceId } = await team(`r13-${String(round)}`, 2);
      const [m1, m2] = people as [Person, Person];
      const id = await chatOf(m1, workspaceId, [m2]);
      const m2Lines = [await line(m2), await line(m2)];
      const callId = await startCall(m1, id);
      await until(() => ringIn((m2Lines[0] as Opened).got));

      const results = await Promise.all([accept(m2, callId), accept(m2, callId)]);
      const codes = results.map((r) => r.statusCode).sort();
      expect(codes).toEqual([200, 409]);
      const lost = results.find((r) => r.statusCode === 409);
      expect(errorCode(lost as NonNullable<typeof lost>)).toBe("RING_OVER");
      expect(await stateOf(callId, m2.id)).toBe("accepted");
      for (const l of m2Lines) expect(await until(() => stopIn(l.got))).toMatchObject({ callId, reason: "accepted" });
      expect(await seatsOf(callId, m2.id)).toHaveLength(1);
      for (const l of m2Lines) l.ws.terminate();
    }
  });

  it("TC-F15-15 [AC-F15-07] declining a one-to-one call ends it, stops every window and notes it once", async () => {
    const { people, workspaceId } = await team("r15", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const m2Lines = [await line(m2), await line(m2)];
    const m1Line = await line(m1);
    const callId = await startCall(m1, id);
    for (const l of m2Lines) await until(() => ringIn(l.got));

    expect((await decline(m2, callId)).statusCode).toBe(204);
    expect(await stateOf(callId, m2.id)).toBe("declined");
    for (const l of m2Lines) expect(await until(() => stopIn(l.got))).toMatchObject({ callId, reason: "declined" });
    expect(await until(() => stopIn(m1Line.got))).toMatchObject({ callId, reason: "declined" });
    expect((await callRow(callId))?.endedAt).not.toBeNull();
    const notes = (await missedNotes(id)).filter((n) => n?.callId === callId);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.forUserId).toBe(m2.id);
    for (const l of [...m2Lines, m1Line]) l.ws.terminate();
  });

  it("TC-F15-02 [AC-F15-01, AC-F15-06] when someone accepts, the caller's line is told (Calling screen moves into the call)", async () => {
    const { people, workspaceId } = await team("r02", 2);
    const [m1, m2] = people as [Person, Person];
    const callerLine = await line(m1);
    const callId = await startCall(m1, await chatOf(m1, workspaceId, [m2]));
    expect((await accept(m2, callId)).statusCode).toBe(200);
    const told = await until(() => callerLine.got.find((m): m is Stop => m.t === "ring_stop" && m.callId === callId));
    expect(told.reason).toBe("accepted");
    callerLine.ws.terminate();
  });

  it("TC-F15-16 [AC-F15-07] in a group, one decline leaves the others ringing and the call running", async () => {
    const { people, workspaceId } = await team("r16", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const callId = await startCall(m1, id);
    expect((await decline(m2, callId)).statusCode).toBe(204);
    expect(await stateOf(callId, m2.id)).toBe("declined");
    expect(await stateOf(callId, m3.id)).toBe("ringing");
    expect((await callRow(callId))?.endedAt).toBeNull();
    expect((await accept(m3, callId)).statusCode).toBe(200);
    expect(await seatsOf(callId, m3.id)).toHaveLength(1);
  });

  it("TC-F15-44 [AC-F15-34] a decline stops every window; a window opened meanwhile still gets the ring", async () => {
    const { people, workspaceId } = await team("r44", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const lines = [await line(m2), await line(m2), await line(m2)];
    const callId = await startCall(m1, id);
    for (const l of lines) await until(() => ringIn(l.got));

    const late = await line(m2);
    expect(await until(() => ringIn(late.got))).toMatchObject({ callId, conversationId: id });

    expect((await decline(m2, callId)).statusCode).toBe(204);
    for (const l of [...lines, late])
      expect(await until(() => stopIn(l.got))).toMatchObject({ callId, reason: "declined" });
    // After the stop, a new window is not rung.
    const after = await line(m2);
    expect(ringIn(after.got)).toBeUndefined();
    for (const l of [...lines, late, after]) l.ws.terminate();
  });

  it("TC-F15-74 [AC-F15-20, AC-F15-09] only your own ring can be answered; only the starter can cancel", async () => {
    const { people, workspaceId } = await team("r74", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const other = await chatOf(m2, workspaceId, [m3]);
    const callId = await startCall(m1, id);
    const otherCall = await startCall(m2, other);
    const m2Line = await line(m2);
    const m3Line = await line(m3);

    expect((await cancel(m2, callId)).statusCode).toBe(404);
    expect((await decline(m2, otherCall)).statusCode).toBe(404);
    expect((await accept(m2, otherCall)).statusCode).toBe(404);
    expect((await call(m1.token, "POST", `/api/v1/calls/${callId}/decline`)).statusCode).toBe(404);
    expect(await stateOf(callId, m2.id)).toBe("ringing");
    expect(await stateOf(callId, m3.id)).toBe("ringing");
    expect((await callRow(otherCall))?.endedAt).toBeNull();

    expect((await cancel(m1, callId)).statusCode).toBe(204);
    expect(await stateOf(callId, m2.id)).toBe("cancelled");
    expect(await stateOf(callId, m3.id)).toBe("cancelled");
    for (const l of [m2Line, m3Line])
      expect(await until(() => l.got.find((m): m is Stop => m.t === "ring_stop" && m.callId === callId))).toMatchObject(
        {
          reason: "cancelled",
        },
      );
    const notes = (await missedNotes(id)).filter((n) => n?.callId === callId);
    expect(notes.map((n) => n?.forUserId).sort()).toEqual([m2.id, m3.id].sort());
    expect((await accept(m2, callId)).statusCode).toBe(409);
    m2Line.ws.terminate();
    m3Line.ws.terminate();
  });

  it("TC-F15-64 [AC-F15-20] a person removed from the group while rung can't accept", async () => {
    const { people, workspaceId } = await team("r64", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const callId = await startCall(m1, id);
    expect((await call(m2.token, "DELETE", `/api/v1/conversations/${id}/members/${m3.id}`)).statusCode).toBe(204);

    const refused = await accept(m3, callId);
    expect(refused.statusCode).toBe(404);
    expect(refused.body).not.toContain("pass");
    expect(await seatsOf(callId, m3.id)).toEqual([]);
  });
});
