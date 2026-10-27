// Start and join a call from a chat (F15 T3; design.md 3.1–3.3; AC-F15-01–04, 12, 14, 20, 26). Real
// routes and database; the call server is the local one from `pnpm dev`. Own database.
import {
  callAttendances,
  callRings,
  calls,
  chatBlocks,
  chatMessages,
  conversationMembers,
  conversations,
} from "@meetapp/db";
import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { meetingWithTeam, withTicket } from "../../test-support/meetings-setup.ts";
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
  status: string;
  title: string;
  group: string;
  call: { callId: string; serverUrl: string; pass: string; role: string };
}
interface Running {
  call: null | {
    callId: string;
    media: string;
    startedAt: string;
    startedBy: { userId: string; name: string };
    people: number;
  };
}

const startCall = (person: Person, id: string, media = "video") =>
  call(person.token, "POST", `/api/v1/conversations/${id}/calls`, { media });
const joinCall = (person: Person, callId: string) => call(person.token, "POST", `/api/v1/calls/${callId}/join`);
const running = (person: Person, id: string) => call(person.token, "GET", `/api/v1/conversations/${id}/call`);
const chatOf = async (person: Person, workspaceId: string, others: Person[], name?: string) =>
  (
    await call(person.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, {
      userIds: others.map((p) => p.id),
      ...(name ? { name } : {}),
    })
  ).json<{ id: string }>().id;

const callsOf = (id: string) => t.database.db.select().from(calls).where(eq(calls.conversationId, id));
const attendancesOf = (callId: string) =>
  t.database.db.select().from(callAttendances).where(eq(callAttendances.callId, callId));
const ringsOf = (callId: string) => t.database.db.select().from(callRings).where(eq(callRings.callId, callId));
const callNotes = async (id: string) =>
  (
    await t.database.db
      .select({ system: chatMessages.system })
      .from(chatMessages)
      .where(and(eq(chatMessages.conversationId, id), eq(chatMessages.kind, "system")))
      .orderBy(asc(chatMessages.createdAt))
  ).filter((row) => (row.system as { event?: string } | null)?.event === "call_started");

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

/** A group with `size` accepted members: three made through the app, the rest added to the database. */
async function bigGroup(label: string, size: number) {
  const { people, workspaceId } = await team(label, size);
  const [m1, m2, m3] = people as [Person, Person, Person];
  const id = await chatOf(m1, workspaceId, [m2, m3]);
  const rest = people.slice(3);
  if (rest.length > 0)
    await t.database.db
      .insert(conversationMembers)
      .values(rest.map((p) => ({ conversationId: id, workspaceId, userId: p.id, state: "accepted" as const })));
  return { people, workspaceId, id };
}

async function nothingMade(id: string) {
  expect(await callsOf(id)).toEqual([]);
  expect(await callNotes(id)).toEqual([]);
}

describe("start a call from a chat", { timeout: 120_000 }, () => {
  it("TC-F15-01 [AC-F15-01] a one-to-one call starts at once; the other person is rung, the caller is not", async () => {
    const { people, workspaceId } = await team("c01", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const response = await startCall(m1, id);
    expect(response.statusCode).toBe(201);
    const answer = response.json<Answer>();
    expect(answer).toMatchObject({ status: "admitted", group: "member", title: "Person 2" });
    expect(answer.call).toMatchObject({ role: "presenter" });
    expect(answer.call.pass).not.toBe("");
    expect(answer.call.serverUrl).not.toBe("");

    const rows = await callsOf(id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ conversationId: id, media: "video", meetingId: null, endedAt: null });
    expect(rows[0]?.id).toBe(answer.call.callId);
    const seats = await attendancesOf(answer.call.callId);
    expect(seats).toHaveLength(1);
    expect(seats[0]).toMatchObject({ id: answer.attendanceId, userId: m1.id, conversationId: id, status: "admitted" });
    const notes = await callNotes(id);
    expect(notes).toHaveLength(1);
    expect(notes[0]?.system).toMatchObject({ event: "call_started", callId: answer.call.callId });
    const rings = await ringsOf(answer.call.callId);
    expect(rings.map((r) => [r.userId, r.state])).toEqual([[m2.id, "ringing"]]);

    const seen = (await running(m2, id)).json<Running>().call;
    expect(seen).toMatchObject({ callId: answer.call.callId, media: "video", people: 1 });
    expect(seen?.startedBy).toMatchObject({ userId: m1.id, name: "Person 1" });
  });

  it("TC-F15-03 [AC-F15-02] refused in read-only chats and meeting chats; nothing is made", async () => {
    const { people, workspaceId } = await team("c03", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];

    // A blocked one-to-one chat.
    const blocked = await chatOf(m1, workspaceId, [m2]);
    await t.database.db.insert(chatBlocks).values({ blockerId: m2.id, blockedId: m1.id });
    for (const person of [m1, m2]) {
      const refused = await startCall(person, blocked);
      expect(refused.statusCode).toBe(403);
      expect(errorCode(refused)).toBe("CHAT_READ_ONLY");
    }
    await nothingMade(blocked);

    // A request that hasn't been accepted: the sender is refused.
    const e1 = await namedPerson(t, "c03-e1", "Eli External");
    await seedPersonal(t, e1);
    const pending = await chatOf(m1, workspaceId, [e1]);
    const waiting = await startCall(m1, pending);
    expect(waiting.statusCode).toBe(403);
    await nothingMade(pending);
    expect((await startCall(e1, pending)).statusCode).toBe(404);

    // Outside chat switched off while the chat has someone from outside.
    const outside = await chatOf(m1, workspaceId, [e1]);
    await call(e1.token, "POST", `/api/v1/conversations/${outside}/accept`);
    await call(m1.token, "PATCH", `/api/v1/workspaces/${workspaceId}/settings`, { allowOutsideChat: false });
    const off = await startCall(m1, outside);
    expect(off.statusCode).toBe(403);
    expect(errorCode(off)).toBe("CHAT_OUTSIDE_OFF");
    await nothingMade(outside);
    await call(m1.token, "PATCH", `/api/v1/workspaces/${workspaceId}/settings`, { allowOutsideChat: true });

    // A person who left the group.
    const group = await chatOf(m1, workspaceId, [m2, m3]);
    expect((await call(m3.token, "POST", `/api/v1/conversations/${group}/leave`)).statusCode).toBe(204);
    expect((await startCall(m3, group)).statusCode).toBe(404);
    expect((await running(m3, group)).statusCode).toBe(404);
    await nothingMade(group);

    // A meeting's chat.
    const { meeting, organizer } = await meetingWithTeam(t, "c03-meeting", 0);
    // Making the meeting already made its chat (F14 D065); the organizer is added as a member here.
    const [chat] = await t.database.db
      .select({ id: conversations.id })
      .from(conversations)
      .where(eq(conversations.meetingId, meeting.id));
    if (!chat) throw new Error("meeting chat not made");
    await t.database.db
      .insert(conversationMembers)
      .values({ conversationId: chat.id, workspaceId: meeting.workspaceId, userId: organizer.id, state: "accepted" })
      .onConflictDoNothing();
    expect((await startCall(organizer, chat.id)).statusCode).toBe(404);
    await nothingMade(chat.id);
  });

  it("TC-F15-05 [AC-F15-03] a second start joins the running call and rings nobody again; outsiders see nothing", async () => {
    const { people, workspaceId } = await team("c05", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const first = (await startCall(m1, id)).json<Answer>();
    const ringsAtStart = await ringsOf(first.call.callId);
    expect(ringsAtStart.map((r) => r.userId).sort()).toEqual([m2.id, m3.id].sort());

    const again = await startCall(m1, id, "audio");
    expect(again.statusCode).toBe(201);
    expect(again.json<Answer>().call.callId).toBe(first.call.callId);
    expect(again.json<Answer>().attendanceId).not.toBe(first.attendanceId);
    const second = await startCall(m2, id);
    expect(second.json<Answer>().call.callId).toBe(first.call.callId);

    expect(await callsOf(id)).toHaveLength(1);
    expect(await attendancesOf(first.call.callId)).toHaveLength(3);
    expect(await callNotes(id)).toHaveLength(1);
    const rings = await ringsOf(first.call.callId);
    expect(rings.map((r) => r.id).sort()).toEqual(ringsAtStart.map((r) => r.id).sort());
    expect(rings.find((r) => r.userId === m2.id)?.state).not.toBe("ringing"); // M2 answered by joining
    expect(rings.find((r) => r.userId === m3.id)?.state).toBe("ringing");

    const seen = await running(m3, id);
    expect(seen.statusCode).toBe(200);
    expect(seen.json<Running>().call).toMatchObject({ callId: first.call.callId, media: "video", people: 2 });
    const outsider = await namedPerson(t, "c05-x", "Outsider");
    expect((await running(outsider, id)).statusCode).toBe(404);
    expect((await startCall(outsider, id)).statusCode).toBe(404);
    expect((await joinCall(outsider, first.call.callId)).statusCode).toBe(404);
    const empty = await chatOf(m1, workspaceId, [m2]);
    expect((await running(m1, empty)).json<Running>().call).toBeNull();
  });

  it("TC-F15-07 [AC-F15-04] a group of more than 20 starts without ringing; a group of 20 rings 19", async () => {
    const big = await bigGroup("c07a", 21);
    const [starter] = big.people as [Person];
    const started = (await startCall(starter, big.id)).json<Answer>();
    expect(await ringsOf(started.call.callId)).toEqual([]);
    expect(await callNotes(big.id)).toHaveLength(1);

    const exact = await bigGroup("c07b", 20);
    const [first] = exact.people as [Person];
    const answer = (await startCall(first, exact.id)).json<Answer>();
    const rings = await ringsOf(answer.call.callId);
    expect(rings).toHaveLength(19);
    expect(rings.every((r) => r.state === "ringing" && r.userId !== first.id)).toBe(true);
  });

  it("TC-F15-08 [AC-F15-04, AC-F15-14] the 21st person gets CALL_FULL; an existing person's second window is accepted", async () => {
    const { people, id } = await bigGroup("c08", 22);
    const first = (await startCall(people[0] as Person, id)).json<Answer>();
    for (const person of people.slice(1, 20)) expect((await startCall(person, id)).statusCode).toBe(201);
    expect((await running(people[0] as Person, id)).json<Running>().call?.people).toBe(20);

    const late = await startCall(people[20] as Person, id);
    expect(late.statusCode).toBe(409);
    expect(errorCode(late)).toBe("CALL_FULL");
    const lateJoin = await joinCall(people[21] as Person, first.call.callId);
    expect(lateJoin.statusCode).toBe(409);
    expect(errorCode(lateJoin)).toBe("CALL_FULL");

    expect((await startCall(people[3] as Person, id)).statusCode).toBe(201); // a second window
    expect((await joinCall(people[0] as Person, first.call.callId)).statusCode).toBe(200);
    expect((await running(people[0] as Person, id)).json<Running>().call?.people).toBe(20);
    const taken = (await attendancesOf(first.call.callId)).filter((a) => a.userId === (people[20] as Person).id);
    expect(taken).toEqual([]);
  });

  it("TC-F15-27 [AC-F15-12] chat calls have no organizer: the meeting controls are refused for everyone", async () => {
    const { people, workspaceId } = await team("c27", 2);
    const [m1, m2] = people as [Person, Person];
    const id = await chatOf(m1, workspaceId, [m2]);
    const one = (await startCall(m1, id)).json<Answer>();
    const two = (await joinCall(m2, one.call.callId)).json<Answer>();
    expect([one.call.role, two.call.role]).toEqual(["presenter", "presenter"]);
    expect([one.group, two.group]).toEqual(["member", "member"]);
    const callId = one.call.callId;

    for (const [by, other] of [
      [one, two],
      [two, one],
    ] as const) {
      const person = `/api/v1/calls/${callId}/participants/${other.attendanceId}`;
      const attempts = [
        withTicket(t, by.ticket, { method: "POST", url: `${person}/mute` }),
        withTicket(t, by.ticket, { method: "POST", url: `${person}/remove` }),
        withTicket(t, by.ticket, { method: "PATCH", url: `${person}/role`, payload: { role: "attendee" } }),
        withTicket(t, by.ticket, { method: "PATCH", url: `/api/v1/calls/${callId}`, payload: { locked: true } }),
        withTicket(t, by.ticket, {
          method: "POST",
          url: `/api/v1/calls/${callId}/lobby/admit`,
          payload: { attendanceIds: [other.attendanceId] },
        }),
        withTicket(t, by.ticket, { method: "POST", url: `/api/v1/calls/${callId}/mute-all` }),
        withTicket(t, by.ticket, { method: "POST", url: `/api/v1/calls/${callId}/end` }),
      ];
      for (const response of await Promise.all(attempts)) expect([403, 404]).toContain(response.statusCode);
    }
    const [row] = await t.database.db.select().from(calls).where(eq(calls.id, callId));
    expect(row?.endedAt).toBeNull();
    expect((await attendancesOf(callId)).every((a) => a.status === "admitted")).toBe(true);

    const left = await withTicket(t, one.ticket, { method: "DELETE", url: `/api/v1/attendances/${one.attendanceId}` });
    expect(left.statusCode).toBe(204);
    const [seat] = await t.database.db.select().from(callAttendances).where(eq(callAttendances.id, one.attendanceId));
    expect(seat?.status).toBe("left");
  });

  it("TC-F15-59 [AC-F15-26] both start at the same moment: one call, both in it, one note (20 times)", async () => {
    for (let round = 0; round < 20; round += 1) {
      const { people, workspaceId } = await team(`c59-${String(round)}`, 2);
      const [m1, m2] = people as [Person, Person];
      const id = await chatOf(m1, workspaceId, [m2]);
      const [a, b] = await Promise.all([startCall(m1, id), startCall(m2, id)]);
      expect([a.statusCode, b.statusCode]).toEqual([201, 201]);
      const rows = await callsOf(id);
      expect(rows).toHaveLength(1);
      const callId = rows[0]?.id ?? "";
      expect(a.json<Answer>().call.callId).toBe(callId);
      expect(b.json<Answer>().call.callId).toBe(callId);
      const users = (await attendancesOf(callId)).map((s) => s.userId).sort();
      expect(users).toEqual([m1.id, m2.id].sort());
      expect((await ringsOf(callId)).filter((r) => r.state === "ringing")).toEqual([]);
      expect(await callNotes(id)).toHaveLength(1);
    }
  });
});

describe("join a chat's running call", { timeout: 60_000 }, () => {
  it("TC-F15-64 [AC-F15-20] a person removed from the group can't join; a call that ended gives CALL_ENDED", async () => {
    const { people, workspaceId } = await team("c64", 3);
    const [m1, m2, m3] = people as [Person, Person, Person];
    const id = await chatOf(m1, workspaceId, [m2, m3]);
    const started = (await startCall(m1, id)).json<Answer>();
    const callId = started.call.callId;

    const before = await joinCall(m3, callId);
    expect(before.statusCode).toBe(200);
    expect(before.json<Answer>()).toMatchObject({ status: "admitted", call: { callId, role: "presenter" } });

    expect((await call(m2.token, "DELETE", `/api/v1/conversations/${id}/members/${m3.id}`)).statusCode).toBe(204);
    const seatsBefore = (await attendancesOf(callId)).length;
    const refused = await joinCall(m3, callId);
    expect(refused.statusCode).toBe(404);
    expect(refused.body).not.toContain("pass");
    expect((await attendancesOf(callId)).length).toBe(seatsBefore);

    await t.database.db.update(calls).set({ endedAt: new Date(), endReason: "ended" }).where(eq(calls.id, callId));
    const ended = await joinCall(m2, callId);
    expect(ended.statusCode).toBe(409);
    expect(errorCode(ended)).toBe("CALL_ENDED");
  });
});
