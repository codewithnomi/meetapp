// Security, removal and data for calls from chats (F15 T9; design.md 3.7, 6; AC-F15-02, 20, 21, 23, 24, 25,
// 28). Real routes, database and call server stand-ins. Own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import type { LineServerMessage } from "@meetapp/contracts";
import { callAttendances, callRings, calls, chatMessages, conversations, user } from "@meetapp/db";
import { and, eq, sql } from "drizzle-orm";
import { TokenVerifier } from "livekit-server-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { captureLogs, type CapturedLogs } from "../../test-support/fake-env.ts";
import { localConfig } from "../../test-support/integration.ts";
import { webhookBody, webhookSignature, type FakeEvent } from "../../test-support/livekit-events.ts";
import { joined, meetingWithTeam } from "../../test-support/meetings-setup.ts";
import {
  caller,
  errorCode,
  namedPerson,
  seedPersonal,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
let logs: CapturedLogs;
beforeAll(async () => {
  logs = captureLogs();
  t = await startAuthTestApp({ logs: logs.stream });
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
type Stop = Extract<LineServerMessage, { t: "ring_stop" }>;

const config = () => ({ ...localConfig(), DATA_ENCRYPTION_KEY: "x".repeat(40) });
const settle = (ms = 100) => new Promise((resolve) => setTimeout(resolve, ms));
async function until<T>(read: () => Promise<T | undefined> | T | undefined, ms = 2500): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const value = await read();
    if (value !== undefined) return value;
    if (Date.now() > end) throw new Error("did not happen in time");
    await settle(50);
  }
}

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
const startRaw = (p: Person, id: string, media = "video") =>
  call(p.token, "POST", `/api/v1/conversations/${id}/calls`, { media });
async function startCall(p: Person, id: string) {
  const response = await startRaw(p, id);
  expect(response.statusCode).toBe(201);
  return response.json<Answer>();
}
const accept = async (p: Person, callId: string) => {
  const response = await call(p.token, "POST", `/api/v1/calls/${callId}/accept`);
  expect(response.statusCode).toBe(200);
  return response.json<Answer>();
};
const ringsOf = (callId: string) => t.database.db.select().from(callRings).where(eq(callRings.callId, callId));
const seatsOf = (callId: string) =>
  t.database.db.select().from(callAttendances).where(eq(callAttendances.callId, callId));
const callRow = async (callId: string) => (await t.database.db.select().from(calls).where(eq(calls.id, callId)))[0];
const seatOf = async (callId: string, userId: string) => (await seatsOf(callId)).find((s) => s.userId === userId);
const setInCall = (attendanceId: string) =>
  t.database.db
    .update(callAttendances)
    .set({ status: "in_call", joinedAt: new Date() })
    .where(eq(callAttendances.id, attendanceId));
async function notes(conversationId: string) {
  const rows = await t.database.db
    .select({ system: chatMessages.system })
    .from(chatMessages)
    .where(and(eq(chatMessages.conversationId, conversationId), eq(chatMessages.kind, "system")));
  return rows.map((r) => r.system as { event?: string; forUserId?: string; callId?: string });
}
async function report(event: FakeEvent) {
  const body = webhookBody(event);
  return t.app.inject({
    method: "POST",
    url: "/api/v1/livekit/webhook",
    payload: body,
    headers: { "content-type": "application/webhook+json", authorization: await webhookSignature(config(), body) },
  });
}
async function line(person: Person) {
  const ws = await t.app.injectWS("/api/v1/realtime", {
    headers: { origin: "app://meetapp", ...bearer(person.token) },
  });
  const got: LineServerMessage[] = [];
  ws.on("message", (data: Buffer) => got.push(JSON.parse(data.toString()) as LineServerMessage));
  await settle(300);
  return { ws, got };
}

/** G3 with M3 in a running call: M1 starts, M2 and M3 accept, all connected. */
async function runningG3(label: string) {
  const { people, workspaceId } = await team(label, 3);
  const [m1, m2, m3] = people as [Person, Person, Person];
  const id = await chatOf(m1, workspaceId, [m2, m3]);
  const first = await startCall(m1, id);
  const second = await accept(m2, first.call.callId);
  const third = await accept(m3, first.call.callId);
  for (const a of [first, second, third]) await setInCall(a.attendanceId);
  return { m1, m2, m3, workspaceId, id, callId: first.call.callId, seats: [first, second, third] as const };
}

const withoutRequestId = (body: string) => {
  const parsed = JSON.parse(body) as { error: Record<string, unknown> };
  const error = { ...parsed.error };
  delete error.requestId;
  return { error };
};

describe("access to the new routes", { timeout: 120_000 }, () => {
  it("TC-F15-63 [AC-F15-20] outsiders, other workspaces, signed-out callers and unknown ids all get the same answer; nothing is made", async () => {
    const { people, workspaceId } = await team("s63", 4);
    const [m1, m2, m3, colleague] = people as [Person, Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const started = await startCall(m1, id);
    const callId = started.call.callId;
    const stranger = await namedPerson(t, "s63-x", "Stranger");
    await seedWorkspace(t, [[stranger, "owner"]], "Other");

    const routes = (chat: string, callRef: string): [string, string, object?][] => [
      ["POST", `/api/v1/conversations/${chat}/calls`, { media: "video" }],
      ["GET", `/api/v1/conversations/${chat}/call`],
      ["POST", `/api/v1/calls/${callRef}/join`],
      ["POST", `/api/v1/calls/${callRef}/accept`],
      ["POST", `/api/v1/calls/${callRef}/decline`],
      ["DELETE", `/api/v1/calls/${callRef}/ring`],
      ["POST", `/api/v1/calls/${callRef}/ring`, { userIds: [m3.id] }],
    ];
    const snapshot = async () => ({
      calls: (await t.database.db.select().from(calls).where(eq(calls.conversationId, id))).length,
      seats: (await seatsOf(callId)).length,
      rings: (await ringsOf(callId)).map((r) => `${r.userId}:${r.state}`).sort(),
      notes: (await notes(id)).length,
    });
    const before = await snapshot();
    const unknown = routes(randomUUID(), randomUUID());
    const real = routes(id, callId);

    for (const [i, [method, url, payload]] of real.entries()) {
      const reference = await call(colleague.token, method as "GET", (unknown[i] as [string, string])[1], payload);
      expect(reference.statusCode, url).toBe(404);
      const referenceBody = withoutRequestId(reference.body);
      expect(referenceBody.error.code).toBe("NOT_FOUND");

      const signedOut = await t.app.inject({
        method: method as "GET",
        url,
        ...(payload ? { payload } : {}),
        headers: { origin: "app://meetapp" },
      });
      expect(signedOut.statusCode, `signed out ${url}`).toBe(401);

      for (const [who, person] of [
        ["same workspace, not in the group", colleague],
        ["another workspace", stranger],
      ] as const) {
        const answer = await call(person.token, method as "GET", url, payload);
        expect(answer.statusCode, `${who} ${method} ${url}`).toBe(404);
        expect(withoutRequestId(answer.body), `${who} ${url}`).toEqual(referenceBody);
      }
    }
    expect(await snapshot()).toEqual(before);
    expect(await seatsOf(callId)).toHaveLength(1);
  });
});

describe("the pass", { timeout: 60_000 }, () => {
  it("TC-F15-65 [AC-F15-21] a chat call's pass names one room and person, holds only person rights and is short-lived", async () => {
    const { people, workspaceId } = await team("s65", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const started = await startCall(m1, id);
    const joinedAnswer = await accept(m2, started.call.callId);
    const verifier = new TokenVerifier(config().LIVEKIT_API_KEY, config().LIVEKIT_API_SECRET);

    for (const answer of [started, joinedAnswer]) {
      const claims = await verifier.verify(answer.call.pass);
      expect(claims.video?.room).toBe(started.call.callId);
      expect(claims.video?.roomJoin).toBe(true);
      expect(claims.sub).toBe(answer.attendanceId);
      for (const power of ["roomAdmin", "roomCreate", "roomList", "roomRecord"] as const) {
        expect(claims.video?.[power], power).toBeFalsy();
      }
      const sources = (claims.video?.canPublishSources ?? []).map(String);
      expect(sources.length).toBeGreaterThan(0);
      for (const source of sources) expect(["camera", "microphone", "screen_share"]).toContain(source);
      // F02's lifetime is 10 minutes (PASS_TTL).
      expect(Number(claims.exp) - Number(claims.nbf)).toBe(600);
    }

    const { meeting, organizer } = await meetingWithTeam(t, "s65-meeting", 0);
    const host = await joined(t, meeting, organizer);
    const meetingClaims = await verifier.verify(host.call?.pass ?? "");
    expect(meetingClaims.video?.room).toBe(host.call?.callId);
    expect(meetingClaims.video?.room).not.toBe(started.call.callId);
    expect(Number(meetingClaims.exp) - Number(meetingClaims.nbf)).toBe(600);
  });
});

describe("logs", { timeout: 60_000 }, () => {
  it("TC-F15-67 [AC-F15-23] starting, ringing, answering, adding and failing write no pass, ticket, name or message text to the logs", async () => {
    const callerName = "Zelda Quokkason";
    const messageText = "zzSecretChatText-91c3";
    const { people, workspaceId } = await team("s67", 4);
    const [m1, m2, m3, m4] = people as [Person, Person, Person, Person];
    await t.database.db.update(user).set({ name: callerName }).where(eq(user.id, m1.id));
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    await call(m1.token, "POST", `/api/v1/conversations/${id}/messages`, {
      clientId: randomUUID(),
      body: { v: 1, blocks: [{ type: "paragraph", content: [{ type: "text", text: messageText }] }] },
    });
    const secrets = new Map<string, string>();
    const started = await startCall(m1, id);
    secrets.set("starter pass", started.call.pass);
    secrets.set("starter ticket", started.ticket);
    const accepted = await accept(m2, started.call.callId);
    secrets.set("accepter pass", accepted.call.pass);
    secrets.set("accepter ticket", accepted.ticket);
    await call(m3.token, "POST", `/api/v1/calls/${started.call.callId}/decline`);
    await call(m1.token, "POST", `/api/v1/calls/${started.call.callId}/ring`, { userIds: [m3.id] });
    // Errors: outsider, unknown call, a second answer.
    await call(m4.token, "POST", `/api/v1/calls/${started.call.callId}/accept`);
    await call(m2.token, "POST", `/api/v1/calls/${randomUUID()}/join`);
    await call(m3.token, "POST", `/api/v1/calls/${started.call.callId}/accept`);
    await call(m4.token, "POST", `/api/v1/conversations/${id}/calls`, { media: "video" });
    await settle(300);

    const text = logs.text();
    expect(logs.lines().length).toBeGreaterThan(5);
    expect(secrets.size).toBe(4);
    for (const [kind, secret] of secrets) {
      expect(secret.length, kind).toBeGreaterThan(5);
      expect(text.includes(secret), `${kind} in the logs`).toBe(false);
    }
    expect(text.includes(callerName), "caller's name in the logs").toBe(false);
    expect(text.includes(messageText), "chat text in the logs").toBe(false);
  });
});

describe("read-only chats and blocks", { timeout: 120_000 }, () => {
  it("TC-F15-68 [AC-F15-24, AC-F15-02] a blocked outside person can't start a call in the one-to-one chat; nobody is rung", async () => {
    const { people, workspaceId } = await team("s68", 2);
    const [m1, m2] = people as [Person, Person];
    const e1 = await namedPerson(t, "s68-e1", "Eli External");
    await seedPersonal(t, e1);
    const e2 = await namedPerson(t, "s68-e2", "Edda External");
    await seedPersonal(t, e2);
    const other = await chatOf(m1, workspaceId, [e2]);
    await call(e2.token, "POST", `/api/v1/conversations/${other}/accept`);
    await call(m1.token, "POST", "/api/v1/me/blocked", { userId: e2.id });
    // Another read-only outside case (also blocked): the same answer, and it doesn't say who blocked.
    const reference = await startRaw(e2, other);
    expect(reference.statusCode).toBe(403);
    expect(errorCode(reference)).toBe("CHAT_READ_ONLY");

    const dm = await chatOf(m1, workspaceId, [e1]);
    expect((await call(e1.token, "POST", `/api/v1/conversations/${dm}/accept`)).statusCode).toBe(204);
    expect((await call(m1.token, "POST", "/api/v1/me/blocked", { userId: e1.id })).statusCode).toBe(204);
    const m1Line = await line(m1);
    const refused = await startRaw(e1, dm);
    expect(refused.statusCode).toBe(403);
    expect(errorCode(refused)).toBe("CHAT_READ_ONLY");
    expect(withoutRequestId(refused.body).error.message).toBe(withoutRequestId(reference.body).error.message);
    expect(refused.body).not.toMatch(/block/i);
    await settle(300);
    expect(m1Line.got.some((m) => m.t === "ring")).toBe(false);
    expect(await t.database.db.select().from(calls).where(eq(calls.conversationId, dm))).toEqual([]);
    expect(await notes(dm)).toEqual([]);
    void m2;
    m1Line.ws.terminate();
  });

  it("TC-F15-69 [AC-F15-24] in a group both people are in, a block changes nothing: either can start and the other is rung", async () => {
    const { people, workspaceId } = await team("s69", 2);
    const [m1, m2] = people as [Person, Person];
    const e1 = await namedPerson(t, "s69-e1", "Eli External");
    await seedPersonal(t, e1);
    const id = await chatOf(m1, workspaceId, [m2, e1]);
    expect((await call(e1.token, "POST", `/api/v1/conversations/${id}/accept`)).statusCode).toBe(204);
    expect((await call(m1.token, "POST", "/api/v1/me/blocked", { userId: e1.id })).statusCode).toBe(204);

    const byE1 = await startCall(e1, id);
    expect((await ringsOf(byE1.call.callId)).find((r) => r.userId === m1.id)?.state).toBe("ringing");
    await call(e1.token, "DELETE", `/api/v1/calls/${byE1.call.callId}/ring`);
    await t.database.db
      .update(calls)
      .set({ endedAt: new Date(), endReason: "ended" })
      .where(eq(calls.id, byE1.call.callId));

    const byM1 = await startCall(m1, id);
    expect((await ringsOf(byM1.call.callId)).find((r) => r.userId === e1.id)?.state).toBe("ringing");
  });
});

describe("leaving the chat ends one's place in the call", { timeout: 120_000 }, () => {
  const gone = async (callId: string, userId: string) =>
    until(async () => ((await seatOf(callId, userId))?.status === "removed" ? true : undefined));

  async function othersStay(run: Awaited<ReturnType<typeof runningG3>>) {
    expect((await seatOf(run.callId, run.m1.id))?.status).toBe("in_call");
    expect((await seatOf(run.callId, run.m2.id))?.status).toBe("in_call");
    expect((await callRow(run.callId))?.endedAt).toBeNull();
  }

  it("TC-F15-70 [AC-F15-25] removed from the group: the seat is removed within 2 s; the others stay", async () => {
    const run = await runningG3("s70a");
    const response = await call(run.m2.token, "DELETE", `/api/v1/conversations/${run.id}/members/${run.m3.id}`);
    expect(response.statusCode).toBe(204);
    await gone(run.callId, run.m3.id);
    expect((await seatOf(run.callId, run.m3.id))?.leftReason).toBe("removed");
    await othersStay(run);
  });

  it("TC-F15-70 [AC-F15-25] leaving the group: the seat is removed within 2 s; the others stay", async () => {
    const run = await runningG3("s70b");
    expect((await call(run.m3.token, "POST", `/api/v1/conversations/${run.id}/leave`)).statusCode).toBe(204);
    expect(await gone(run.callId, run.m3.id)).toBe(true);
    await othersStay(run);
  });

  it("TC-F15-70 [AC-F15-25] removed from the workspace: the seat is removed within 2 s; the others stay", async () => {
    const run = await runningG3("s70c");
    const response = await call(run.m1.token, "DELETE", `/api/v1/workspaces/${run.workspaceId}/members/${run.m3.id}`);
    expect(response.statusCode).toBe(204);
    expect(await gone(run.callId, run.m3.id)).toBe(true);
    await othersStay(run);
  });

  it("TC-F15-70 [AC-F15-25] account deleted: the seat is removed within 2 s; the others stay", async () => {
    const run = await runningG3("s70d");
    await t.accounts.chatsRequests.forgetPerson(run.m3.id);
    expect(await gone(run.callId, run.m3.id)).toBe(true);
    await othersStay(run);
  });

  it("TC-F15-71 [AC-F15-25] removed while ringing: the ring is cancelled, the line is told, no missed note; the caller's removal stops all rings", async () => {
    const { people, workspaceId } = await team("s71", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const m3Line = await line(m3);
    const started = await startCall(m1, id);
    const callId = started.call.callId;
    expect((await ringsOf(callId)).find((r) => r.userId === m3.id)?.state).toBe("ringing");

    expect((await call(m2.token, "DELETE", `/api/v1/conversations/${id}/members/${m3.id}`)).statusCode).toBe(204);
    const ring = await until(async () =>
      (await ringsOf(callId)).find((r) => r.userId === m3.id && r.state === "cancelled"),
    );
    expect(ring.state).toBe("cancelled");
    const stop = await until(() => m3Line.got.find((m): m is Stop => m.t === "ring_stop" && m.callId === callId));
    expect(stop.reason).toBe("cancelled");
    await settle(300);
    expect((await notes(id)).filter((n) => n.event === "call_missed" && n.forUserId === m3.id)).toEqual([]);
    m3Line.ws.terminate();

    // The caller is removed: every ring stops.
    const second = await chatOf(m1, workspaceId, [m2, m3]);
    const other = await startCall(m1, second);
    expect((await ringsOf(other.call.callId)).filter((r) => r.state === "ringing")).toHaveLength(2);
    expect((await call(m2.token, "DELETE", `/api/v1/conversations/${second}/members/${m1.id}`)).statusCode).toBe(204);
    await until(async () =>
      (await ringsOf(other.call.callId)).every((r) => r.state !== "ringing") ? true : undefined,
    );
    expect((await ringsOf(other.call.callId)).map((r) => r.state)).toEqual(["cancelled", "cancelled"]);
  });
});

describe("data", { timeout: 120_000 }, () => {
  it("TC-F15-72 [AC-F15-28] no media fields; deleting the chat deletes its calls, seats and rings; the export lists seats and rings", async () => {
    const columns = await t.database.db.execute<{ table_name: string; column_name: string }>(
      sql`select table_name, column_name from information_schema.columns where table_name in ('calls','call_attendances','call_rings')`,
    );
    const rows = (Array.isArray(columns) ? columns : (columns as unknown as { rows: unknown[] }).rows) as {
      table_name: string;
      column_name: string;
    }[];
    expect(rows.length).toBeGreaterThan(10);
    for (const { table_name, column_name } of rows) {
      expect(column_name, `${table_name}.${column_name}`).not.toMatch(/audio|video|record|transcript/i);
    }

    const { people, workspaceId } = await team("s72", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const started = await startCall(m1, id);
    const callId = started.call.callId;
    await accept(m2, callId);
    await t.database.db.update(calls).set({ endedAt: new Date(), endReason: "ended" }).where(eq(calls.id, callId));

    const mine = await t.accounts.chatUpkeep.exportFor(m1.id);
    expect(mine.calls.seats.map((s) => s.callId)).toEqual([callId]);
    const rung = await t.accounts.chatUpkeep.exportFor(m3.id);
    expect(rung.calls.rings.map((r) => r.callId)).toEqual([callId]);
    expect(rung.calls.seats).toEqual([]);

    await t.database.db.delete(conversations).where(eq(conversations.id, id));
    expect(await t.database.db.select().from(calls).where(eq(calls.id, callId))).toEqual([]);
    expect(await seatsOf(callId)).toEqual([]);
    expect(await ringsOf(callId)).toEqual([]);
  });
});

describe("the call server's reports for chat calls", { timeout: 60_000 }, () => {
  it("TC-F15-31 [AC-F15-14] the last person leaving a one-to-one call ends it; room_finished writes the ended note", async () => {
    const { people, workspaceId } = await team("s73", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const first = await startCall(m1, id);
    const callId = first.call.callId;
    const second = await accept(m2, callId);
    for (const a of [first, second]) {
      expect((await report({ event: "participant_joined", room: callId, identity: a.attendanceId })).statusCode).toBe(
        200,
      );
    }
    expect((await seatOf(callId, m2.id))?.status).toBe("in_call");

    const left = await report({ event: "participant_left", room: callId, identity: second.attendanceId });
    expect(left.statusCode).toBe(200);
    expect((await callRow(callId))?.endedAt).not.toBeNull();

    // A second call: the room closes by itself after both had joined.
    const chat2 = await chatOf(m1, workspaceId, [m2]);
    const a = await startCall(m1, chat2);
    const b = await accept(m2, a.call.callId);
    for (const x of [a, b])
      await report({ event: "participant_joined", room: a.call.callId, identity: x.attendanceId });
    expect((await report({ event: "room_finished", room: a.call.callId })).statusCode).toBe(200);
    const ended = await until(async () => {
      const found = (await notes(chat2)).filter((n) => n.event === "call_ended" && n.callId === a.call.callId);
      return found.length > 0 ? found : undefined;
    });
    expect(ended).toHaveLength(1);
    expect((await callRow(a.call.callId))?.endedAt).not.toBeNull();
  });
});
