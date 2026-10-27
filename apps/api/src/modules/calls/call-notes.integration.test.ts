// Call notes in the chat (F15 T7; design.md 3.6; AC-F15-04, 15). Real routes, database, live lines.
// "Missed call" notes are private to the person who missed the call. Own database.
import { randomUUID } from "node:crypto";
import type { LineServerMessage } from "@meetapp/contracts";
import { callAttendances, calls } from "@meetapp/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
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

interface Opened {
  ws: Awaited<ReturnType<AuthTestApp["app"]["injectWS"]>>;
  got: LineServerMessage[];
}
interface Note {
  id: string;
  system: { event: string; forUserId?: string; seconds?: number; names?: string[]; callId?: string } | null;
}
interface ListItem {
  id: string;
  unread: number;
  lastMessage: { note?: { event: string } | null } | null;
}

const settle = (ms = 300) => new Promise((resolve) => setTimeout(resolve, ms));
async function line(person: Person): Promise<Opened> {
  const ws = await t.app.injectWS("/api/v1/realtime", {
    headers: { origin: "app://meetapp", ...bearer(person.token) },
  });
  const got: LineServerMessage[] = [];
  ws.on("message", (data: Buffer) => got.push(JSON.parse(data.toString()) as LineServerMessage));
  await settle();
  return { ws, got };
}
const newsIds = (l: Opened) =>
  l.got.flatMap((m) => (m.t === "news" && m.event.type === "message_created" ? [m.event.id] : []));

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
const decline = (p: Person, callId: string) => call(p.token, "POST", `/api/v1/calls/${callId}/decline`);
const connect = (callId: string, userId: string) =>
  t.database.db
    .update(callAttendances)
    .set({ status: "in_call", joinedAt: new Date() })
    .where(and(eq(callAttendances.callId, callId), eq(callAttendances.userId, userId)));
async function leave(callId: string, userId: string) {
  await t.database.db
    .update(callAttendances)
    .set({ status: "left", leftAt: new Date(), leftReason: "leave" })
    .where(and(eq(callAttendances.callId, callId), eq(callAttendances.userId, userId)));
  await t.accounts.callEnd.left(callId);
}
const pageOf = async (p: Person, id: string) =>
  (await call(p.token, "GET", `/api/v1/conversations/${id}/messages?limit=50`)).json<{
    messages: Note[];
    lastSeq?: number;
  }>();
const eventsOf = async (p: Person, id: string) =>
  (await call(p.token, "GET", `/api/v1/conversations/${id}/events?after=0`)).json<{ events: { id: string }[] }>()
    .events;
const listOf = async (p: Person, workspaceId: string) =>
  (await call(p.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`)).json<{
    conversations: ListItem[];
  }>().conversations;
const itemOf = async (p: Person, workspaceId: string, id: string) =>
  (await listOf(p, workspaceId)).find((c) => c.id === id);
const eventsNamed = (page: { messages: Note[] }, event: string) =>
  page.messages.filter((m) => m.system?.event === event);
const text = (words: string) => ({ v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: words }] }] });

/** G3 call: M1 starts, M2 joins, M3 declines, 750 s pass, everyone leaves. */
async function finishedCall(label: string) {
  const { people, workspaceId } = await team(label, 3);
  const [m1, m2, m3] = people as [Person, Person, Person];
  const id = await chatOf(m1, workspaceId, [m2, m3]);
  const lines = [await line(m1), await line(m2), await line(m3)] as [Opened, Opened, Opened];
  const callId = await startCall(m1, id);
  expect((await accept(m2, callId)).statusCode).toBe(200);
  expect((await decline(m3, callId)).statusCode).toBe(204);
  await connect(callId, m1.id);
  await connect(callId, m2.id);
  await t.database.db
    .update(calls)
    .set({ startedAt: new Date(Date.now() - 750_000) })
    .where(eq(calls.id, callId));
  await leave(callId, m2.id);
  await leave(callId, m1.id);
  await settle();
  return { m1, m2, m3, people, workspaceId, id, callId, lines };
}

describe("call notes in the chat", { timeout: 120_000 }, () => {
  it("TC-F15-33 [AC-F15-15] started, ended with time and names; missed only for the person who missed it", async () => {
    const { m1, m2, m3, id, workspaceId, lines } = await finishedCall("n33");
    void workspaceId;
    for (const p of [m1, m2, m3]) {
      const page = await pageOf(p, id);
      const order = page.messages.map((m) => m.system?.event).filter((e) => e === "call_started" || e === "call_ended");
      expect(order).toEqual(["call_ended", "call_started"]); // pages list the newest first
      const ended = eventsNamed(page, "call_ended")[0]?.system;
      expect(Math.abs((ended?.seconds ?? 0) - 750)).toBeLessThanOrEqual(1);
      expect(ended?.names).toEqual(expect.arrayContaining(["Person 1", "Person 2"]));
    }
    expect(eventsNamed(await pageOf(m1, id), "call_missed")).toHaveLength(0);
    expect(eventsNamed(await pageOf(m2, id), "call_missed")).toHaveLength(0);
    const mine = eventsNamed(await pageOf(m3, id), "call_missed");
    expect(mine).toHaveLength(1);
    expect(mine[0]?.system?.forUserId).toBe(m3.id);
    for (const l of lines) l.ws.terminate();
  });

  it("TC-F15-35 [AC-F15-15, AC-F15-04] the missed note is hidden from others (page, id, catch-up, live) and counts as unread once", async () => {
    const { m1, m2, m3, id, workspaceId, lines } = await finishedCall("n35");
    const missedId = eventsNamed(await pageOf(m3, id), "call_missed")[0]?.id ?? "";
    expect(missedId).not.toBe("");

    const byId = (p: Person) => call(p.token, "GET", `/api/v1/conversations/${id}/messages/${missedId}`);
    expect((await byId(m1)).statusCode).toBe(404);
    expect((await byId(m2)).statusCode).toBe(404);
    expect((await byId(m3)).statusCode).toBe(200);

    expect((await eventsOf(m1, id)).map((e) => e.id)).not.toContain(missedId);
    expect((await eventsOf(m2, id)).map((e) => e.id)).not.toContain(missedId);
    expect((await eventsOf(m3, id)).map((e) => e.id)).toContain(missedId);

    expect(newsIds(lines[2])).toContain(missedId);
    expect(newsIds(lines[0])).not.toContain(missedId);
    expect(newsIds(lines[1])).not.toContain(missedId);

    expect((await itemOf(m1, workspaceId, id))?.unread).toBe(0);
    expect((await itemOf(m2, workspaceId, id))?.unread).toBe(0);
    expect((await itemOf(m3, workspaceId, id))?.unread).toBe(1);

    const seq = (await pageOf(m3, id)).lastSeq ?? 1_000_000;
    expect((await call(m3.token, "PUT", `/api/v1/conversations/${id}/read`, { seq })).statusCode).toBe(204);
    expect((await itemOf(m3, workspaceId, id))?.unread).toBe(0);
    for (const l of lines) l.ws.terminate();
  });

  it("TC-F15-37 [AC-F15-15] the chat list shows the newest visible call note; a missed call lifts the chat for its person", async () => {
    const { people, workspaceId } = await team("n37", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const other = await chatOf(m1, workspaceId, [m2]);
    await call(m1.token, "POST", `/api/v1/conversations/${id}/messages`, { clientId: randomUUID(), body: text("old") });
    await settle(50);
    const callId = await startCall(m1, id);
    for (const p of people) expect((await itemOf(p, workspaceId, id))?.lastMessage?.note?.event).toBe("call_started");

    await settle(50);
    await call(m1.token, "POST", `/api/v1/conversations/${other}/messages`, {
      clientId: randomUUID(),
      body: text("newer elsewhere"),
    });
    await settle(50);
    expect((await decline(m3, callId)).statusCode).toBe(204);
    expect((await itemOf(m3, workspaceId, id))?.lastMessage?.note?.event).toBe("call_missed");
    expect((await itemOf(m1, workspaceId, id))?.lastMessage?.note?.event).not.toBe("call_missed");
    expect((await itemOf(m2, workspaceId, id))?.lastMessage?.note?.event).not.toBe("call_missed");
    expect((await listOf(m3, workspaceId))[0]?.id).toBe(id);
  });

  it("TC-F15-07 [AC-F15-04] in a 21-member group the call note is the last line and raises nobody's unread", async () => {
    const { people, workspaceId } = await team("n07", 21);
    const [m1, ...rest] = people as [Person, ...Person[]];
    const id = await chatOf(m1, workspaceId, rest);
    await startCall(m1, id);
    for (const p of [m1, rest[0], rest[10], rest[19]] as Person[]) {
      const item = await itemOf(p, workspaceId, id);
      expect(item?.lastMessage?.note?.event).toBe("call_started");
      expect(item?.unread).toBe(0);
    }
  });
});
