// The live line (D064; F14 design.md 3.4; AC-F14-18, 20, 23, 24, 31, 34): sign-in before opening,
// closing on sign-out, the only messages an app may send, limits, news only for one's own chats, two
// servers sharing news through Redis, and following chats as they come and go.
import { EventEmitter } from "node:events";
import { request } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import type { LineServerMessage } from "@meetapp/contracts";
import type { WebSocket } from "@fastify/websocket";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  caller,
  namedPerson,
  seedPersonal,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";
import { CLOSE, createLineHub } from "./chats-line.ts";
import { channels, createLivePublisher } from "./chats-live.ts";

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
  closed: Promise<number>;
}

async function line(person: Person): Promise<Opened> {
  const ws = await t.app.injectWS("/api/v1/realtime", {
    headers: { origin: "app://meetapp", ...bearer(person.token) },
  });
  const got: LineServerMessage[] = [];
  ws.on("message", (data: Buffer) => got.push(JSON.parse(data.toString()) as LineServerMessage));
  const closed = new Promise<number>((resolve) => ws.on("close", (code: number) => resolve(code)));
  // The server follows the person's chats right after opening.
  await settle();
  return { ws, got, closed };
}

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

const text = (words: string) => ({ v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: words }] }] });
const send = (person: Person, id: string, words = "hi") =>
  call(person.token, "POST", `/api/v1/conversations/${id}/messages`, { clientId: randomUUID(), body: text(words) });

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
const start = async (person: Person, workspaceId: string, others: Person[]) =>
  (
    await call(person.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, {
      userIds: others.map((p) => p.id),
    })
  ).json<{ id: string }>().id;

/**
 * The answer to an upgrade request on the real server (0: the connection was closed instead) (the test helper `injectWS` never settles when a
 * line is refused, so refusals are checked over a real connection).
 */
async function upgradeStatus(headers: Record<string, string>): Promise<number> {
  const base = new URL(await listening());
  return new Promise((resolve) => {
    const asked = request({
      host: base.hostname,
      port: base.port,
      path: "/api/v1/realtime",
      headers: {
        origin: "app://meetapp",
        connection: "Upgrade",
        upgrade: "websocket",
        "sec-websocket-version": "13",
        "sec-websocket-key": randomBytes(16).toString("base64"),
        ...headers,
      },
    });
    asked.on("response", (answer) => {
      answer.resume();
      resolve(answer.statusCode ?? 0);
    });
    asked.on("upgrade", (answer, socket) => {
      socket.destroy();
      resolve(answer.statusCode ?? 0);
    });
    // The server may close right after its 401; either way the line didn't open.
    asked.on("error", () => {
      resolve(0);
    });
    asked.end();
  });
}

let address: string | undefined;
const listening = async () => (address ??= await t.app.listen({ port: 0, host: "127.0.0.1" }));

/** A stand-in socket for a second server's hub. */
function fakeSocket() {
  const socket = Object.assign(new EventEmitter(), {
    OPEN: 1,
    readyState: 1,
    sent: [] as LineServerMessage[],
    closedWith: undefined as number | undefined,
    send(data: string) {
      socket.sent.push(JSON.parse(data) as LineServerMessage);
    },
    close(code: number) {
      socket.closedWith = code;
      socket.readyState = 3;
    },
  });
  return socket;
}

describe("opening and closing", { timeout: 60_000 }, () => {
  it("TC-F14-73 [AC-F14-31, AC-F14-20] no or bad token: no line; signing out closes it within 2 seconds", async () => {
    expect(await upgradeStatus({})).not.toBe(101);
    expect(await upgradeStatus({ authorization: "Bearer nope" })).not.toBe(101);
    const { people } = await team("l73", 1);
    const [m1] = people as [Person];
    expect(await upgradeStatus(bearer(m1.token))).toBe(101);
    const opened = await line(m1);
    const out = await t.app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      payload: {},
      headers: { origin: "app://meetapp", ...bearer(m1.token) },
    });
    expect(out.statusCode).toBe(200);
    expect((await call(m1.token, "GET", "/api/v1/me")).statusCode).toBe(401);
    const began = Date.now();
    const timedOut = settle(5000).then(() => -1);
    expect(await Promise.race([opened.closed, timedOut])).toBe(CLOSE.signedOut);
    expect(Date.now() - began).toBeLessThan(2500);
  });

  it("TC-F14-74 [AC-F14-31, AC-F14-23] only typing, active and ping; anything else closes the line", async () => {
    const { people } = await team("l74", 1);
    const [m1] = people as [Person];
    const broken = await line(m1);
    broken.ws.send("{not json");
    expect(await broken.closed).toBe(CLOSE.invalid);
    const unknown = await line(m1);
    unknown.ws.send(JSON.stringify({ t: "send", body: "x" }));
    expect(await unknown.closed).toBe(CLOSE.invalid);
    const big = await line(m1);
    big.ws.send(JSON.stringify({ t: "ping", pad: "x".repeat(65 * 1024) }));
    expect(await big.closed).toBe(1009);
    const fine = await line(m1);
    fine.ws.send(JSON.stringify({ t: "ping" }));
    await until(() => fine.got.find((m) => m.t === "pong"));
    fine.ws.terminate();
  });

  it("TC-F14-74 [AC-F14-31] an upgrade from another site's page is refused", async () => {
    const { people } = await team("l74o", 1);
    const [m1] = people as [Person];
    expect(await upgradeStatus(bearer(m1.token))).toBe(101);
    expect(await upgradeStatus({ ...bearer(m1.token), origin: "https://evil.example" })).toBe(403);
  });

  it("TC-F14-74 [AC-F14-31] a line closed while starting follows nothing and doesn't count toward the 5", async () => {
    const { people } = await team("l74c", 1);
    const [m1] = people as [Person];
    const deps = t.accounts.chatsLine;
    let release: (value: undefined) => void = () => undefined;
    const held = new Promise<undefined>((resolve) => {
      release = resolve;
    });
    // The chats are read slowly, so the socket closes in the middle of opening.
    const hub = createLineHub({ ...deps, conversationsOf: async (id) => (await held, deps.conversationsOf(id)) });
    const socket = fakeSocket();
    const opening = hub.open(socket as unknown as WebSocket, m1.id, () => Promise.resolve(true));
    await settle(100);
    socket.emit("close");
    release(undefined);
    await opening;
    await settle();
    expect(await deps.redis.zcard(`meetapp:chats:lines:${m1.id}`)).toBe(0);
    const following = (hub as unknown as { following: Map<string, Set<unknown>> }).following;
    expect([...following.values()].some((set) => set.size > 0)).toBe(false);
    await hub.close();
  });

  it("TC-F14-74 [AC-F14-31] a malformed message on Redis is dropped; lines keep working", async () => {
    const { people, workspaceId } = await team("l74r", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await start(m1, workspaceId, [m2]);
    const opened = await line(m2);
    await t.accounts.chatsLine.redis.publish(channels.conversation(id), "{not json");
    await t.accounts.chatsLine.redis.publish(channels.conversation(id), "42");
    await send(m1, id, "still fine");
    expect(await until(() => opened.got.find((m) => m.t === "news"))).toMatchObject({ conversationId: id });
    opened.ws.terminate();
  });

  it("TC-F14-74 [AC-F14-31] a 6th line closes the oldest with 4001", async () => {
    const { people } = await team("l74b", 1);
    const [m1] = people as [Person];
    const lines = [];
    for (let i = 0; i < 6; i += 1) lines.push(await line(m1));
    expect(await lines[0]?.closed).toBe(CLOSE.replaced);
    for (const opened of lines.slice(1)) opened.ws.terminate();
  });

  it("TC-F14-74 [AC-F14-31] a line with no ping for 2 minutes is closed", async () => {
    let clock = 0;
    const hub = createLineHub({ ...t.accounts.chatsLine, now: () => clock });
    const socket = fakeSocket();
    const { people } = await team("l74c", 1);
    await hub.open(socket as unknown as WebSocket, (people[0] as Person).id, () => Promise.resolve(true));
    clock = 2 * 60 * 1000 + 1;
    await until(() => socket.closedWith, 3000);
    expect(socket.closedWith).toBe(CLOSE.idle);
    await hub.close();
  });
});

describe("what a line receives", { timeout: 60_000 }, () => {
  it("TC-F14-64 [AC-F14-31] news reaches members only; an outsider's typing reaches no one", async () => {
    const { people, workspaceId } = await team("l64", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await start(m1, workspaceId, [m2]);
    const outsider = await namedPerson(t, "l64-x", "Outsider");
    const [m2Line, xLine] = [await line(m2), await line(outsider)];
    await send(m1, id, "for M2");
    await until(() => m2Line.got.find((m) => m.t === "news"));
    xLine.ws.send(JSON.stringify({ t: "typing", conversationId: id }));
    await settle(500);
    expect(xLine.got.filter((m) => m.t !== "pong")).toEqual([]);
    expect(m2Line.got.some((m) => m.t === "typing")).toBe(false);
    m2Line.ws.terminate();
    xLine.ws.terminate();
  });

  it("TC-F14-47 [AC-F14-23] typing reaches the others; more than 10 in 10 seconds are dropped", async () => {
    const { people, workspaceId } = await team("l47", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await start(m1, workspaceId, [m2]);
    const [m1Line, m2Line] = [await line(m1), await line(m2)];
    for (let i = 0; i < 12; i += 1) m1Line.ws.send(JSON.stringify({ t: "typing", conversationId: id }));
    await settle(800);
    const typing = m2Line.got.filter((m) => m.t === "typing");
    expect(typing).toHaveLength(10);
    expect(typing[0]).toMatchObject({ conversationId: id, userId: m1.id, name: "Person 1" });
    m1Line.ws.terminate();
    m2Line.ws.terminate();
  });

  it("TC-F14-49 [AC-F14-24] Seen goes out live, but not from or to people with receipts off", async () => {
    const { people, workspaceId } = await team("l49", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await start(m1, workspaceId, [m2, m3]);
    await call(m2.token, "PATCH", "/api/v1/me/settings", { readReceipts: false });
    const [m1Line, m2Line] = [await line(m1), await line(m2)];
    await call(m3.token, "PUT", `/api/v1/conversations/${id}/read`, { seq: 5 });
    await call(m2.token, "PUT", `/api/v1/conversations/${id}/read`, { seq: 5 });
    await until(() => m1Line.got.find((m) => m.t === "read"));
    await settle(300);
    expect(m1Line.got.filter((m) => m.t === "read").map((m) => (m as { userId: string }).userId)).toEqual([m3.id]);
    expect(m2Line.got.some((m) => m.t === "read")).toBe(false);
    m1Line.ws.terminate();
    m2Line.ws.terminate();
  });

  it("TC-F14-49 [AC-F14-24] someone whose request waits sends no Seen; after accepting they do", async () => {
    const m1 = await namedPerson(t, "s49p-m1", "Maya Member");
    const e1 = await namedPerson(t, "s49p-e1", "Eli External");
    const w1 = await seedWorkspace(t, [[m1, "owner"]]);
    await seedPersonal(t, e1);
    const id = await start(m1, w1, [e1]);
    const opened = await line(m1);
    await send(m1, id, "hello there");
    expect((await call(e1.token, "PUT", `/api/v1/conversations/${id}/read`, { seq: 100 })).statusCode).toBe(204);
    await settle();
    expect(opened.got.some((m) => m.t === "read")).toBe(false);
    await call(e1.token, "POST", `/api/v1/conversations/${id}/accept`);
    await call(e1.token, "PUT", `/api/v1/conversations/${id}/read`, { seq: 100 });
    expect(await until(() => opened.got.find((m) => m.t === "read"))).toMatchObject({ userId: e1.id });
    opened.ws.terminate();
  });

  it("TC-F14-43 [AC-F14-20] news sent through one server reaches a line on another through Redis", async () => {
    const { people, workspaceId } = await team("l43", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await start(m1, workspaceId, [m2]);
    const serverB = createLineHub(t.accounts.chatsLine);
    const socket = fakeSocket();
    await serverB.open(socket as unknown as WebSocket, m2.id, () => Promise.resolve(true));
    await settle();
    await send(m1, id, "through A");
    const news = await until(() => socket.sent.find((m) => m.t === "news"));
    expect(news).toMatchObject({ conversationId: id });
    await serverB.close();
  });

  it("TC-F14-75 [AC-F14-18, AC-F14-34] a line follows a new group at once and stops when removed", async () => {
    const { people, workspaceId } = await team("l75", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const m3Line = await line(m3);
    const id = await start(m1, workspaceId, [m2, m3]);
    await until(() => m3Line.got.find((m) => m.t === "list" && m.change === "added"));
    await send(m1, id, "welcome");
    await until(() => m3Line.got.find((m) => m.t === "news"));

    await call(m1.token, "DELETE", `/api/v1/conversations/${id}/members/${m3.id}`);
    await until(() => m3Line.got.find((m) => m.t === "list" && m.change === "removed"));
    const before = m3Line.got.filter((m) => m.t === "news").length;
    await send(m1, id, "after removal");
    await settle(800);
    expect(m3Line.got.filter((m) => m.t === "news").length).toBe(before);
    m3Line.ws.terminate();
  });
});

describe("catching up", { timeout: 60_000 }, () => {
  it("TC-F14-41 [AC-F14-20] after being offline, catching up gives every change in order, once", async () => {
    const { people, workspaceId } = await team("l41", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await start(m1, workspaceId, [m2, m3]);
    const ids: string[] = [];
    for (let i = 0; i < 30; i += 1) {
      const sender = i % 2 === 0 ? m1 : m2;
      ids.push((await send(sender, id, `message ${String(i)}`)).json<{ id: string }>().id);
      if (i % 9 === 8) await settle(10_100); // stay under 10 messages in 10 seconds per person
    }
    await call(m1.token, "PATCH", `/api/v1/conversations/${id}/messages/${ids[0] ?? ""}`, { body: text("edited") });
    await call(m2.token, "DELETE", `/api/v1/conversations/${id}/messages/${ids[1] ?? ""}`);
    const events = (await call(m3.token, "GET", `/api/v1/conversations/${id}/events?after=0`)).json<{
      events: { seq: number; type: string }[];
      gap: boolean;
    }>();
    const seqs = events.events.map((e) => e.seq);
    expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
    expect(new Set(seqs).size).toBe(seqs.length);
    expect((seqs.at(-1) ?? 0) - (seqs[0] ?? 0) + 1).toBe(seqs.length);
    expect(events.events.filter((e) => e.type === "message_created")).toHaveLength(30);
    expect(events.events.at(-1)?.type).toBe("message_deleted");
    const list = (await call(m3.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`)).json<{
      conversations: { id: string; unread: number }[];
    }>();
    expect(list.conversations.find((c) => c.id === id)?.unread).toBe(29);
  });
});

describe("status", { timeout: 60_000 }, () => {
  const statusOf = async (viewer: Person, target: Person) =>
    (await call(viewer.token, "GET", `/api/v1/people/status?ids=${target.id}`)).json<{
      statuses: { userId: string; status: string }[];
    }>().statuses;

  it("TC-F14-52 [AC-F14-26, AC-F14-13] colleagues and accepted contacts see status; others never do", async () => {
    const { people, workspaceId } = await team("s52", 2);
    const [m1, m2] = people as [Person, Person];
    const [e1, e2, e3, x1] = await Promise.all(
      ["e1", "e2", "e3", "x1"].map((label) => namedPerson(t, `s52-${label}`, label.toUpperCase())),
    );
    const outside = [e1, e2, e3] as Person[];
    const ids = await Promise.all(outside.map((p) => start(m1, workspaceId, [p])));
    await call((e1 as Person).token, "POST", `/api/v1/conversations/${ids[0] ?? ""}/accept`);
    await call((e3 as Person).token, "POST", `/api/v1/conversations/${ids[2] ?? ""}/accept`);
    await call(m1.token, "POST", "/api/v1/me/blocked", { userId: (e3 as Person).id });

    const watchers = [m2, e1, e2, e3, x1] as Person[];
    const lines = await Promise.all(watchers.map((p) => line(p)));
    const m1Line = await line(m1);
    await until(() => lines[0]?.got.find((m) => m.t === "status"));
    await settle(500);
    const gotStatus = lines.map((l) => l.got.some((m) => m.t === "status" && m.userId === m1.id));
    expect(gotStatus).toEqual([true, true, false, false, false]);

    const seen = await Promise.all(watchers.map((p) => statusOf(p, m1)));
    expect(seen.map((list) => list[0]?.status ?? null)).toEqual(["available", "available", null, null, null]);
    const list = (await call(m2.token, "GET", `/api/v1/workspaces/${workspaceId}/conversations`)).json<{
      conversations: { status: string | null }[];
    }>();
    expect(list.conversations).toEqual([]); // M2 has no chat with M1 yet: status shows where they are listed

    // Blocking E1 stops E1's status news at once.
    await call(m1.token, "POST", "/api/v1/me/blocked", { userId: (e1 as Person).id });
    await settle(500);
    const before = lines[1]?.got.length ?? 0;
    m1Line.ws.send(JSON.stringify({ t: "active", active: false }));
    await until(() => lines[0]?.got.find((m) => m.t === "status" && m.status === "away"));
    await settle(300);
    expect(lines[1]?.got.slice(before).some((m) => m.t === "status")).toBe(false);
    for (const opened of [...lines, m1Line]) opened.ws.terminate();
  });
});

describe("when Redis goes away", { timeout: 60_000 }, () => {
  it("TC-F14-44 [AC-F14-20] lines are told to check for themselves; sending still works; normal news resumes", async () => {
    const { people, workspaceId } = await team("r44", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await start(m1, workspaceId, [m2]);
    const hub = createLineHub(t.accounts.chatsLine);
    const socket = fakeSocket();
    await hub.open(socket as unknown as WebSocket, m2.id, () => Promise.resolve(true));
    const subscriber = (hub as unknown as { subscriber: { disconnect: () => void; connect: () => Promise<void> } })
      .subscriber;

    subscriber.disconnect();
    await until(() => socket.sent.find((m) => m.t === "polling" && m.on));
    // Publishing on a Redis connection that is gone never fails the change that caused it.
    const closed = t.accounts.chatsLine.redis.duplicate();
    closed.disconnect();
    await expect(closed.publish("meetapp:test", "x")).rejects.toThrow();
    const gone = createLivePublisher(closed);
    await expect(gone.news(id, { seq: 1, type: "message_created" })).resolves.toBeUndefined();
    expect((await send(m1, id, "while Redis is away")).statusCode).toBe(200);

    await subscriber.connect();
    await until(() => socket.sent.find((m) => m.t === "polling" && !m.on));
    await hub.close();
  });
});
