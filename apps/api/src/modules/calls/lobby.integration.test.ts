// The lobby and the meeting ticket (F02 T6; design.md sections 3.4 and 6; AC-F02-14–19, 42, 50). Real
// routes, database and call server; own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { callAttendances, calls } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  freshMinute,
  joined,
  meetingWithTeam,
  statusOf,
  withTicket,
  type Joined,
  type TestMeeting,
} from "../../test-support/meetings-setup.ts";
import { newPerson } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const lobbyOf = (who: Joined) =>
  withTicket(t, who.ticket, { method: "GET", url: `/api/v1/calls/${who.call?.callId ?? randomUUID()}/lobby` });
const decide = (who: Joined, verb: "admit" | "deny", payload: object) =>
  withTicket(t, who.ticket, {
    method: "POST",
    url: `/api/v1/calls/${who.call?.callId ?? randomUUID()}/lobby/${verb}`,
    payload,
  });

/** The organizer inside, and `count` guests waiting. */
async function lobbyWith(label: string, count: number, options: object = {}) {
  const team = await meetingWithTeam(t, label, 2, options);
  const host = await joined(t, team.meeting, team.organizer);
  const waiting: Joined[] = [];
  for (let i = 0; i < count; i++)
    waiting.push(await joined(t, team.meeting, undefined, { guestName: `Guest ${String(i)}` }));
  return { ...team, host, waiting };
}

async function setRole(meeting: TestMeeting, attendanceId: string, roleOverride: "presenter" | "attendee") {
  await t.database.db.update(callAttendances).set({ roleOverride }).where(eq(callAttendances.id, attendanceId));
  expect(meeting.id).toBeTruthy();
}

describe("who sees the lobby", { timeout: 30_000 }, () => {
  it("TC-F02-30 [AC-F02-15] [AC-F02-26] organizer, co-organizers and presenters see names and groups; nobody else", async () => {
    const { meeting, organizer, members, host } = await lobbyWith("seers", 1);
    const external = await joined(t, meeting, await newPerson(t, "seers-ext"));
    const [coPerson, other] = members;
    if (!coPerson || !other) throw new Error("people missing");
    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/meetings/${meeting.id}/options`,
      payload: { coOrganizerIds: [coPerson.id] },
      headers: { origin: "app://meetapp", authorization: `Bearer ${organizer.token}` },
    });
    const co = await joined(t, meeting, coPerson);
    const presenter = await joined(t, meeting, other);
    for (const who of [host, co, presenter]) {
      const answer = await lobbyOf(who);
      expect(answer.statusCode).toBe(200);
      const { waiting } = answer.json<{ waiting: { name: string; group: string }[] }>();
      expect(waiting.map((person) => [person.name, person.group])).toEqual([
        ["Guest 0", "guest"],
        ["Test Person", "external"],
      ]);
      expect(answer.body).not.toContain("@");
    }
    await setRole(meeting, presenter.attendanceId, "attendee");
    expect((await lobbyOf(presenter)).statusCode).toBe(404);
    expect(
      (await withTicket(t, external.ticket, { method: "GET", url: `/api/v1/calls/${host.call?.callId ?? ""}/lobby` }))
        .statusCode,
    ).toBe(404);
  });
});

describe("admit and deny", { timeout: 30_000 }, () => {
  it("TC-F02-31 [AC-F02-15] admit one, deny one, then Admit all in arrival order; who decided is recorded", async () => {
    const { host, waiting } = await lobbyWith("decide", 4);
    const [first, second, third, fourth] = waiting;
    if (!first || !second || !third || !fourth) throw new Error("people missing");
    expect((await decide(host, "admit", { attendanceIds: [first.attendanceId] })).json()).toEqual({
      decided: 1,
      didNotFit: 0,
    });
    const admitted = await statusOf(t, first);
    expect(admitted.status).toBe("admitted");
    expect(admitted.call?.pass).toBeTruthy();
    await decide(host, "deny", { attendanceIds: [second.attendanceId] });
    expect((await statusOf(t, second)).status).toBe("denied");
    expect((await decide(host, "admit", { all: true })).json()).toEqual({ decided: 2, didNotFit: 0 });
    for (const person of [third, fourth]) expect((await statusOf(t, person)).status).toBe("admitted");
    const [row] = await t.database.db.select().from(callAttendances).where(eq(callAttendances.id, third.attendanceId));
    expect(row?.actedBy).toBe(host.attendanceId);
  });

  it("TC-F02-36 [AC-F02-15] two Admits at the same moment let the person in once", async () => {
    const { meeting, members, host, waiting } = await lobbyWith("twice", 1);
    const second = await joined(t, meeting, members[0]);
    const [guest] = waiting;
    if (!guest) throw new Error("guest missing");
    const answers = await Promise.all(
      [host, second].map((who) => decide(who, "admit", { attendanceIds: [guest.attendanceId] })),
    );
    expect(answers.map((answer) => answer.statusCode)).toEqual([200, 200]);
    const decided = answers.map((answer) => answer.json<{ decided: number }>().decided).sort();
    expect(decided).toEqual([0, 1]);
  });

  it("TC-F02-39 [AC-F02-42] Admit all fills only the free places, earliest first, and says how many didn't fit", async () => {
    const { meeting, host, waiting } = await lobbyWith("room", 5);
    const callId = host.call?.callId ?? "";
    await t.database.db.insert(callAttendances).values(
      Array.from({ length: 97 }, () => ({
        workspaceId: meeting.workspaceId,
        meetingId: meeting.id,
        callId,
        displayName: "Filler",
        participantGroup: "guest" as const,
        status: "in_call" as const,
        ticketHash: randomUUID(),
      })),
    );
    expect((await decide(host, "admit", { all: true })).json()).toEqual({ decided: 2, didNotFit: 3 });
    const statuses = await Promise.all(waiting.map(async (person) => (await statusOf(t, person)).status));
    expect(statuses).toEqual(["admitted", "admitted", "waiting", "waiting", "waiting"]);
  });
});

describe("waiting", { timeout: 30_000 }, () => {
  it("TC-F02-33 [AC-F02-18] after 15 minutes the next ask says nobody let you in; at 14:59 still waiting", async () => {
    const { waiting } = await lobbyWith("wait", 2);
    const [patient, late] = waiting;
    if (!patient || !late) throw new Error("people missing");
    const ago = (ms: number) => new Date(Date.now() - ms);
    await t.database.db
      .update(callAttendances)
      .set({ lobbyEnteredAt: ago(14 * 60_000 + 59_000) })
      .where(eq(callAttendances.id, patient.attendanceId));
    await t.database.db
      .update(callAttendances)
      .set({ lobbyEnteredAt: ago(15 * 60_000) })
      .where(eq(callAttendances.id, late.attendanceId));
    expect((await statusOf(t, patient)).status).toBe("waiting");
    expect((await statusOf(t, late)).status).toBe("timed_out");
  });

  it("TC-F02-34 [AC-F02-18] the lobby survives the last person leaving; the next member starts a new call", async () => {
    const { meeting, members, host, waiting } = await lobbyWith("survive", 1);
    const [guest] = waiting;
    if (!guest) throw new Error("guest missing");
    expect(
      (await withTicket(t, host.ticket, { method: "DELETE", url: `/api/v1/attendances/${host.attendanceId}` }))
        .statusCode,
    ).toBe(204);
    await t.database.db
      .update(calls)
      .set({ endedAt: new Date(), endReason: "last_left" })
      .where(eq(calls.id, host.call?.callId ?? ""));
    expect((await statusOf(t, guest)).status).toBe("waiting");
    const next = await joined(t, meeting, members[0]);
    expect(next.call?.callId).not.toBe(host.call?.callId);
    await decide(next, "admit", { attendanceIds: [guest.attendanceId] });
    expect((await statusOf(t, guest)).call?.callId).toBe(next.call?.callId);
  });
});

describe("meeting tickets", { timeout: 30_000 }, () => {
  it("TC-F02-100 [AC-F02-50] a ticket works only for its own attendance and call", async () => {
    const a = await lobbyWith("ticketA", 1);
    const b = await lobbyWith("ticketB", 1);
    const [aGuest] = a.waiting;
    if (!aGuest) throw new Error("guest missing");
    const attempts = [
      // A's ticket on B's call and on B's attendance.
      withTicket(t, a.host.ticket, { method: "GET", url: `/api/v1/calls/${b.host.call?.callId ?? ""}/lobby` }),
      withTicket(t, a.host.ticket, { method: "GET", url: `/api/v1/attendances/${b.host.attendanceId}` }),
      // A changed ticket (its last character always differs), no ticket, a lobby ticket on an in-call route.
      withTicket(t, `${a.host.ticket.slice(0, -1)}${a.host.ticket.endsWith("A") ? "B" : "A"}`, {
        method: "GET",
        url: `/api/v1/attendances/${a.host.attendanceId}`,
      }),
      withTicket(t, undefined, { method: "GET", url: `/api/v1/attendances/${a.host.attendanceId}` }),
      withTicket(t, aGuest.ticket, { method: "GET", url: `/api/v1/calls/${a.host.call?.callId ?? ""}/lobby` }),
      // The ticket sent as a sign-in instead of in its own header.
      t.app.inject({
        method: "GET",
        url: `/api/v1/attendances/${a.host.attendanceId}`,
        headers: { origin: "app://meetapp", authorization: `Bearer ${a.host.ticket}` },
      }),
    ];
    const answers = await Promise.all(attempts);
    expect(answers.map((answer) => answer.statusCode)).toEqual([404, 404, 404, 404, 404, 404]);
    expect(new Set(answers.map((answer) => answer.json<{ error: { code: string } }>().error.code))).toEqual(
      new Set(["NOT_FOUND"]),
    );
  });

  it("TC-F02-101 [AC-F02-50] after a final status only reading the outcome works, for 30 minutes", async () => {
    const { host, waiting } = await lobbyWith("final", 1);
    const [guest] = waiting;
    if (!guest) throw new Error("guest missing");
    await decide(host, "deny", { attendanceIds: [guest.attendanceId] });
    expect((await statusOf(t, guest)).status).toBe("denied");
    expect(
      (await withTicket(t, guest.ticket, { method: "GET", url: `/api/v1/calls/${host.call?.callId ?? ""}/lobby` }))
        .statusCode,
    ).toBe(404);
    await t.database.db
      .update(callAttendances)
      .set({ updatedAt: new Date(Date.now() - 31 * 60_000) })
      .where(eq(callAttendances.id, guest.attendanceId));
    expect(
      (await withTicket(t, guest.ticket, { method: "GET", url: `/api/v1/attendances/${guest.attendanceId}` }))
        .statusCode,
    ).toBe(404);
  });

  it(
    "TC-F02-95 [AC-F02-48] 30 in-call actions a minute per ticket; status asks are never counted",
    { timeout: 60_000 },
    async () => {
      const { host } = await lobbyWith("actions", 0);
      await freshMinute();
      for (let i = 0; i < 40; i++) expect((await statusOf(t, host)).status).toBe("admitted");
      const answers = [];
      for (let i = 0; i < 31; i++) answers.push((await lobbyOf(host)).statusCode);
      expect(answers.slice(0, 30).every((status) => status === 200)).toBe(true);
      expect(answers[30]).toBe(429);
    },
  );
});
