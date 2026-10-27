// Add people and the calls rate limit (F15 T6; design.md 3.4; AC-F15-13, 20, 22, 23). Real routes, database,
// live lines and Redis. Own database.
import type { LineServerMessage } from "@meetapp/contracts";
import { callRings, conversationMembers } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { localConfig } from "../../test-support/integration.ts";
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
let redis: Redis;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
  const config = localConfig();
  redis = new Redis({ host: config.REDIS_HOST, port: config.REDIS_PORT });
}, 60_000);
afterAll(async () => {
  redis.disconnect();
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
const ringFor = (l: Opened, callId: string, after = 0) =>
  l.got.slice(after).find((m): m is Ring => m.t === "ring" && m.callId === callId);

async function team(label: string, size: number, names: Record<number, string> = {}) {
  const people = await Promise.all(
    Array.from({ length: size }, (_, i) =>
      namedPerson(t, `${label}-${String(i)}`, names[i] ?? `Person ${String(i + 1)}`),
    ),
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
const start = (person: Person, id: string) =>
  call(person.token, "POST", `/api/v1/conversations/${id}/calls`, { media: "video" });
const startCall = async (person: Person, id: string) => {
  const response = await start(person, id);
  expect(response.statusCode).toBe(201);
  return response.json<{ call: { callId: string } }>().call.callId;
};
const accept = (p: Person, callId: string) => call(p.token, "POST", `/api/v1/calls/${callId}/accept`);
const decline = (p: Person, callId: string) => call(p.token, "POST", `/api/v1/calls/${callId}/decline`);
const addPeople = (p: Person, callId: string, userIds: string[]) =>
  call(p.token, "POST", `/api/v1/calls/${callId}/ring`, { userIds });
const ringsOf = (callId: string, userId: string) =>
  t.database.db
    .select()
    .from(callRings)
    .where(eq(callRings.callId, callId))
    .then((rows) => rows.filter((r) => r.userId === userId));

/**
 * The limit counts in fixed one-minute blocks: start the counted part with at least 15 seconds of the
 * block left, so the tries can't fall into two blocks (which would rightly allow more).
 */
async function freshMinute() {
  const left = 60_000 - (Date.now() % 60_000);
  if (left < 15_000) await new Promise((resolve) => setTimeout(resolve, left + 50));
}

describe("add people to a chat call", { timeout: 120_000 }, () => {
  it("TC-F15-29 [AC-F15-13] a person in the call rings members who aren't in it; others are refused", async () => {
    const { people, workspaceId } = await team("a29", 4);
    const [m1, m2, m3, m4] = people as [Person, Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const callId = await startCall(m1, id);
    expect((await accept(m2, callId)).statusCode).toBe(200);
    expect((await decline(m3, callId)).statusCode).toBe(204);
    expect(await ringsOf(callId, m3.id)).toHaveLength(1);
    const m3Line = await line(m3);

    const added = await addPeople(m2, callId, [m3.id]);
    expect(added.statusCode).toBe(204);
    expect(await until(() => ringFor(m3Line, callId))).toMatchObject({ callId, conversationId: id });
    const rows = await ringsOf(callId, m3.id);
    expect(rows.map((r) => r.state).sort()).toEqual(["declined", "ringing"]);

    // Not a member of the chat: refused, nothing rung.
    expect((await addPeople(m2, callId, [m4.id])).statusCode).toBe(404);
    expect(await ringsOf(callId, m4.id)).toEqual([]);
    expect((await addPeople(m2, callId, [m3.id, m4.id])).statusCode).toBe(404);
    expect(await ringsOf(callId, m3.id)).toHaveLength(2);

    // Already ringing, or already in the call: fine, nothing new.
    expect((await addPeople(m2, callId, [m3.id])).statusCode).toBe(204);
    expect((await addPeople(m2, callId, [m1.id, m2.id])).statusCode).toBe(204);
    expect(await ringsOf(callId, m3.id)).toHaveLength(2);
    expect(await ringsOf(callId, m1.id)).toEqual([]);
    expect(await ringsOf(callId, m2.id)).toHaveLength(1);

    // Someone not in the call can't add people.
    expect((await addPeople(m4, callId, [m3.id])).statusCode).toBe(404);
    m3Line.ws.terminate();
  });
});

describe("calls rate limit", { timeout: 180_000 }, () => {
  it("TC-F15-66 [AC-F15-22] 10 a minute per person; an over-limit request is refused whole", async () => {
    const { people, workspaceId } = await team("a66", 13);
    const [m1, ...rest] = people as [Person, ...Person[]];
    const chats = await Promise.all(rest.slice(0, 11).map((partner) => chatOf(m1, workspaceId, [partner])));
    await freshMinute();
    for (const chat of chats.slice(0, 10)) await startCall(m1, chat);
    const eleventhChat = chats[10] as string;
    const eleventh = await start(m1, eleventhChat);
    expect(eleventh.statusCode).toBe(429);
    expect(errorCode(eleventh)).toBe("CALL_RATE");
    const wait = eleventh.json<{ error: { retryAfterSeconds: number } }>().error.retryAfterSeconds;
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(60);

    // Another person is unaffected.
    const other = rest[11] as Person;
    const otherChat = await chatOf(other, workspaceId, [rest[0] as Person]);
    expect((await start(other, otherChat)).statusCode).toBe(201);

    // The counter key doesn't hold the user id in plain text.
    const keys = await redis.keys("rate:chat-calls:*");
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) expect(key).not.toContain(m1.id);
  });

  it("TC-F15-66 [AC-F15-22] Add people counts per person rung together with the start; going over refuses the whole request", async () => {
    const { people, workspaceId } = await team("a66b", 15);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    await freshMinute();
    const callId = await startCall(m1, id); // 1 unit
    const later = people.slice(3);
    await t.database.db
      .insert(conversationMembers)
      .values(later.map((p) => ({ conversationId: id, workspaceId, userId: p.id, state: "accepted" as const })));

    expect(
      (
        await addPeople(
          m1,
          callId,
          later.slice(0, 8).map((p) => p.id),
        )
      ).statusCode,
    ).toBe(204); // 9 units
    const refused = await addPeople(
      m1,
      callId,
      later.slice(8, 11).map((p) => p.id),
    );
    expect(refused.statusCode).toBe(429);
    expect(errorCode(refused)).toBe("CALL_RATE");
    for (const p of later.slice(8, 11)) expect(await ringsOf(callId, p.id)).toEqual([]);
    for (const p of later.slice(0, 8)) expect(await ringsOf(callId, p.id)).toHaveLength(1);

    // The refused request's counts were given back: exactly one unit is left.
    expect((await addPeople(m1, callId, [(later[8] as Person).id])).statusCode).toBe(204);
    expect((await addPeople(m1, callId, [(later[9] as Person).id])).statusCode).toBe(429);
  });
});

describe("add people input and safety", { timeout: 120_000 }, () => {
  it("TC-F15-73 [AC-F15-13, AC-F15-20, AC-F15-23] duplicates ring once; bad bodies, other workspaces and markup are handled", async () => {
    const xss = "<img src=x onerror=alert(1)>";
    const { people, workspaceId } = await team("a73", 3, { 0: xss });
    const [m1, m2, m3] = people as [Person, Person, Person];
    const outsider = (await team("a73-out", 1)).people[0] as Person;
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const callId = await startCall(m1, id);
    expect((await decline(m3, callId)).statusCode).toBe(204);
    const m3Line = await line(m3);

    const tooMany = Array.from({ length: 21 }, () => randomUUID());
    expect((await addPeople(m1, callId, tooMany)).statusCode).toBe(400);
    expect((await addPeople(m1, callId, ["not-a-uuid"])).statusCode).toBe(400);
    expect((await addPeople(m1, callId, [])).statusCode).toBe(400);
    expect(await ringsOf(callId, m3.id)).toHaveLength(1);

    expect((await addPeople(m1, callId, [m3.id, outsider.id])).statusCode).toBe(404);
    expect(await ringsOf(callId, outsider.id)).toEqual([]);
    expect(await ringsOf(callId, m3.id)).toHaveLength(1);

    expect((await addPeople(m1, callId, [m3.id, m3.id, m3.id])).statusCode).toBe(204);
    expect(await ringsOf(callId, m3.id)).toHaveLength(2);
    const ring = await until(() => ringFor(m3Line, callId));
    expect(ring.from.name).toBe(xss);
    expect(m3Line.got.filter((m) => m.t === "ring" && m.callId === callId)).toHaveLength(1);
    m3Line.ws.terminate();
  });
});
