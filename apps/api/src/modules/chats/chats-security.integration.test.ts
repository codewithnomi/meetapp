// Security sweeps for chats (F14 AC-F14-31, 32; S1, S2, S10): every conversation route answers an
// outsider exactly as it answers for a chat that doesn't exist (the list of routes is read from the
// server, so a new route can't be missed); each membership state gets only what it may; refusals look
// the same; no chat text, file names, group names or emails reach the logs.
import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listRoutes } from "../../app.ts";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { PDF } from "../../test-support/sample-files.ts";
import {
  caller,
  namedPerson,
  seedPersonal,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";

const logLines: string[] = [];
let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  const logs = new Writable({
    write(chunk: Buffer, _encoding, done) {
      logLines.push(chunk.toString());
      done();
    },
  });
  t = await startAuthTestApp({ logs });
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const text = (words: string) => ({ v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: words }] }] });
const send = (person: Person, id: string, words = "hi") =>
  call(person.token, "POST", `/api/v1/conversations/${id}/messages`, { clientId: randomUUID(), body: text(words) });
const upload = (person: Person, id: string, name: string) =>
  t.app.inject({
    method: "POST",
    url: `/api/v1/conversations/${id}/attachments`,
    payload: Buffer.from(PDF),
    headers: {
      origin: "app://meetapp",
      "content-type": "application/octet-stream",
      "x-file-name": encodeURIComponent(name),
      ...bearer(person.token),
    },
  });

async function chatWithEverything(label: string) {
  const [m1, m2, m3] = (await Promise.all(
    [1, 2, 3].map((n) => namedPerson(t, `${label}-${String(n)}`, `Person ${String(n)}`)),
  )) as [Person, Person, Person];
  const w1 = await seedWorkspace(t, [
    [m1, "owner"],
    [m2, "member"],
    [m3, "member"],
  ]);
  const started = await call(m1.token, "POST", `/api/v1/workspaces/${w1}/conversations`, {
    userIds: [m2.id, m3.id],
  });
  const id = started.json<{ id: string }>().id;
  const messageId = (await send(m1, id, "hello")).json<{ id: string }>().id;
  const attachmentId = (await upload(m1, id, "notes.pdf")).json<{ id: string }>().id;
  await call(m1.token, "POST", `/api/v1/conversations/${id}/messages`, {
    clientId: randomUUID(),
    attachmentIds: [attachmentId],
  });
  const pollId = (
    await call(m1.token, "POST", `/api/v1/conversations/${id}/polls`, {
      clientId: randomUUID(),
      question: "Lunch?",
      options: ["Yes", "No"],
      multiple: false,
      anonymous: false,
    })
  ).json<{ id: string }>().id;
  return { m1, m2, m3, w1, id, messageId, attachmentId, pollId };
}

type Setup = Awaited<ReturnType<typeof chatWithEverything>>;

/** A body that passes each route's own checks, so the answer comes from the access check. */
function bodyFor(method: string, url: string, s: Setup): object | undefined {
  if (method === "GET" || method === "DELETE") return undefined;
  if (url.endsWith("/messages")) return { clientId: randomUUID(), body: text("x") };
  if (url.endsWith("/messages/:messageId")) return { body: text("x") };
  if (url.endsWith("/reactions")) return { emoji: "👍" };
  if (url.endsWith("/pins")) return { messageId: s.messageId };
  if (url.endsWith("/polls"))
    return { clientId: randomUUID(), question: "Q", options: ["A", "B"], multiple: false, anonymous: false };
  if (url.endsWith("/vote")) return { optionIds: [randomUUID()] };
  if (url.endsWith("/read")) return { seq: 1 };
  if (url.endsWith("/decline")) return { block: false };
  if (url.endsWith("/members")) return { userIds: [randomUUID()] };
  if (url.endsWith("/me")) return { muted: true };
  // F15: starting a chat's call.
  if (url.endsWith("/calls")) return { media: "video" };
  if (url === "/api/v1/conversations/:conversationId") return { name: "New name" };
  return {};
}

function fill(url: string, conversationId: string, s: Setup) {
  return url
    .replace(":conversationId", conversationId)
    .replace(":messageId", s.messageId)
    .replace(":attachmentId", s.attachmentId)
    .replace(":pollId", s.pollId)
    .replace(":userId", s.m2.id)
    .replace(":emoji", encodeURIComponent("👍"));
}

const shape = (answer: { statusCode: number; body: string }) => {
  const body = answer.body ? (JSON.parse(answer.body) as { error?: { code: string; message: string } }) : {};
  return { status: answer.statusCode, code: body.error?.code, message: body.error?.message };
};

describe("the outsider sweep", { timeout: 120_000 }, () => {
  it("TC-F14-63 [AC-F14-31] every conversation route answers outsiders as for a chat that doesn't exist", async () => {
    const s = await chatWithEverything("sw63");
    const [x1, e1, y1] = (await Promise.all(
      ["x1", "e1", "y1"].map((l) => namedPerson(t, `sw63-${l}`, l.toUpperCase())),
    )) as [Person, Person, Person];
    await seedWorkspace(t, [[x1, "owner"]]);
    await seedPersonal(t, y1);
    const routes = listRoutes(t.app).filter((r) => r.url.includes(":conversationId") && r.method !== "HEAD");
    expect(routes.length).toBeGreaterThan(20);
    const missing = randomUUID();
    for (const route of routes) {
      const method = route.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
      const ask = async (person: Person, id: string) =>
        shape(await call(person.token, method, fill(route.url, id, s), bodyFor(method, route.url, s)));
      const nobody = await ask(x1, missing);
      for (const outsider of [x1, e1, y1]) {
        expect({ route: `${method} ${route.url}`, ...(await ask(outsider, s.id)) }).toEqual({
          route: `${method} ${route.url}`,
          ...nobody,
        });
      }
      expect(nobody.status, `${method} ${route.url}`).toBe(404);
    }
    // Workspace routes and status: an outsider learns nothing either.
    expect((await call(x1.token, "GET", `/api/v1/workspaces/${s.w1}/conversations`)).statusCode).toBe(404);
    expect((await call(x1.token, "GET", `/api/v1/workspaces/${s.w1}/people?q=Person`)).statusCode).toBe(404);
    const statuses = await call(x1.token, "GET", `/api/v1/people/status?ids=${s.m1.id},${s.m2.id}`);
    expect(statuses.json<{ statuses: unknown[] }>().statuses).toEqual([]);
  });
});

describe("each membership state", { timeout: 60_000 }, () => {
  it("TC-F14-66 [AC-F14-31, AC-F14-13, AC-F14-34] pending, declined and left people get only what they may", async () => {
    const m1 = await namedPerson(t, "st66-m1", "M1");
    const [pending, declined] = (await Promise.all(["p", "d"].map((l) => namedPerson(t, `st66-${l}`, l)))) as [
      Person,
      Person,
    ];
    const w1 = await seedWorkspace(t, [[m1, "owner"]]);
    const start = async (other: Person) =>
      (await call(m1.token, "POST", `/api/v1/workspaces/${w1}/conversations`, { userIds: [other.id] })).json<{
        id: string;
      }>().id;
    const toPending = await start(pending);
    const toDeclined = await start(declined);
    await send(m1, toPending, "before accepting");
    await call(declined.token, "POST", `/api/v1/conversations/${toDeclined}/decline`, { block: false });
    const read = (person: Person, id: string) =>
      call(person.token, "GET", `/api/v1/conversations/${id}/messages?limit=5`);

    // Pending: only the preview under Chat requests; the chat itself is closed to them.
    expect((await read(pending, toPending)).statusCode).toBe(404);
    expect((await send(pending, toPending)).statusCode).toBe(404);
    const requests = (await call(pending.token, "GET", "/api/v1/me/chat-requests")).json<{
      requests: { preview: unknown[] }[];
    }>().requests;
    expect(requests[0]?.preview).toHaveLength(1);
    // Declined: nothing at all.
    expect((await read(declined, toDeclined)).statusCode).toBe(404);
    expect((await call(declined.token, "POST", `/api/v1/conversations/${toDeclined}/accept`)).statusCode).toBe(404);
  });
});

describe("refusals look the same", { timeout: 60_000 }, () => {
  it("TC-F14-67 [AC-F14-31] a missing chat, someone else's chat, a block and outside chat off answer alike", async () => {
    const s = await chatWithEverything("rf67");
    const [x1, blocker, offOwner, offTarget] = (await Promise.all(
      ["x1", "b", "o", "ot"].map((l) => namedPerson(t, `rf67-${l}`, l)),
    )) as [Person, Person, Person, Person];
    await seedPersonal(t, blocker);
    await call(blocker.token, "POST", "/api/v1/me/blocked", { userId: x1.id });
    const xw = await seedWorkspace(t, [[x1, "owner"]]);
    const off = await seedWorkspace(t, [[offOwner, "owner"]]);
    await call(offOwner.token, "PATCH", `/api/v1/workspaces/${off}/settings`, { allowOutsideChat: false });

    const answers = [
      shape(await call(x1.token, "GET", `/api/v1/conversations/${randomUUID()}/messages?limit=5`)),
      shape(await call(x1.token, "GET", `/api/v1/conversations/${s.id}/messages?limit=5`)),
      shape(await call(x1.token, "POST", `/api/v1/workspaces/${xw}/conversations`, { userIds: [blocker.id] })),
      shape(await call(offOwner.token, "POST", `/api/v1/workspaces/${off}/conversations`, { userIds: [offTarget.id] })),
    ];
    for (const answer of answers) expect(answer).toEqual(answers[0]);

    // Timing: a missing chat and someone else's chat take about as long (no hint from the clock).
    const timed = async (id: string) => {
      const began = performance.now();
      for (let i = 0; i < 10; i += 1) await call(x1.token, "GET", `/api/v1/conversations/${id}/messages?limit=5`);
      return (performance.now() - began) / 10;
    };
    const [missing, theirs] = [await timed(randomUUID()), await timed(s.id)];
    expect(Math.abs(missing - theirs)).toBeLessThan(25);
  });
});

describe("logs", { timeout: 60_000 }, () => {
  it("TC-F14-68 [AC-F14-32] no chat text, file names, group names or emails in the logs", async () => {
    const marker = `marker${randomUUID().replaceAll("-", "")}`;
    const s = await chatWithEverything("lg68");
    await send(s.m1, s.id, `secret ${marker} text`);
    await upload(s.m1, s.id, `${marker}.pdf`);
    await call(s.m1.token, "PATCH", `/api/v1/conversations/${s.id}`, { name: `group ${marker}` });
    const email = `${marker}@example.test`;
    await call(s.m1.token, "GET", `/api/v1/workspaces/${s.w1}/people?q=${encodeURIComponent(email)}`);
    await seedPersonal(t, s.m1);
    await call(s.m1.token, "POST", "/api/v1/me/invitations", { email });
    // A refused message with the marker (too long) and a broken body.
    await send(s.m1, s.id, `${marker} ${"x".repeat(4001)}`);
    await call(s.m1.token, "POST", `/api/v1/conversations/${s.id}/messages`, { clientId: "no", body: marker });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(logLines.length).toBeGreaterThan(10);
    expect(logLines.filter((line) => line.includes(marker))).toEqual([]);
  });
});
