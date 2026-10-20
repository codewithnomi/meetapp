// The call server's reports, reconnecting, Rejoin, the end of a call and the record (F02 T7; design.md
// sections 3.5–3.8; AC-F02-04, 18, 29, 39, 41, 49). Real routes and database; the call server's side
// (removals, messages, rooms) is recorded where a real participant would be needed. Own database;
// needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { callAttendances, calls, livekitEvents, meetings } from "@meetapp/db";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { localConfig } from "../../test-support/integration.ts";
import { recordingLiveKit, webhookBody, webhookSignature, type FakeEvent } from "../../test-support/livekit-events.ts";
import {
  join,
  joined,
  lookupToken,
  meetingWithTeam,
  statusOf,
  withTicket,
  type Joined,
} from "../../test-support/meetings-setup.ts";
import { errorCode, newPerson } from "../../test-support/workspaces-setup.ts";
import { CALL_LIMIT_MS } from "./admission.ts";
import { createCallJobs } from "./calls.jobs.ts";
import { createWebhookService } from "./webhook.service.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const config = () => ({ ...localConfig(), DATA_ENCRYPTION_KEY: "x".repeat(40) });

async function report(event: FakeEvent, signed = true) {
  const body = webhookBody(event);
  return t.app.inject({
    method: "POST",
    url: "/api/v1/livekit/webhook",
    payload: body,
    headers: {
      "content-type": "application/webhook+json",
      ...(signed ? { authorization: await webhookSignature(config(), body) } : {}),
    },
  });
}

/** The webhook service with a recording call server. */
function recordedWebhooks() {
  const { livekit, recorded } = recordingLiveKit(t.accounts.callsDeps.livekit);
  return { webhooks: createWebhookService({ ...t.accounts.callsDeps, livekit }), recorded };
}

const row = async (attendanceId: string) =>
  (await t.database.db.select().from(callAttendances).where(eq(callAttendances.id, attendanceId)))[0];
const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

describe("reports from the call server", { timeout: 30_000 }, () => {
  it("TC-F02-106 [AC-F02-49] unsigned, wrongly signed or changed reports are refused and change nothing", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "sig");
    const host = await joined(t, meeting, organizer);
    const event = {
      event: "participant_joined",
      room: host.call?.callId ?? "",
      identity: host.attendanceId,
      id: `EV_${randomUUID()}`,
    };
    const body = webhookBody(event);
    const attempts = [
      await report(event, false),
      await t.app.inject({
        method: "POST",
        url: "/api/v1/livekit/webhook",
        payload: body,
        headers: {
          "content-type": "application/webhook+json",
          authorization: await webhookSignature(config(), body, "another-secret-0123456789abcdefghij"),
        },
      }),
      await t.app.inject({
        method: "POST",
        url: "/api/v1/livekit/webhook",
        payload: `${body} `,
        headers: { "content-type": "application/webhook+json", authorization: await webhookSignature(config(), body) },
      }),
    ];
    expect(attempts.map((answer) => answer.statusCode)).toEqual([401, 401, 401]);
    const stored = await t.database.db.select().from(livekitEvents).where(eq(livekitEvents.eventId, event.id));
    expect(stored).toHaveLength(0);
    expect((await row(host.attendanceId))?.status).toBe("admitted");
    expect((await report(event)).statusCode).toBe(200);
    expect((await row(host.attendanceId))?.status).toBe("in_call");
  });

  it("TC-F02-64 [AC-F02-41] a repeated report counts once; an older one never undoes a newer one", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "order");
    const host = await joined(t, meeting, organizer);
    const room = host.call?.callId ?? "";
    const now = seconds(new Date());
    const joinedEvent = {
      event: "participant_joined",
      room,
      identity: host.attendanceId,
      at: now - 10,
      id: `EV_${randomUUID()}`,
    };
    await report(joinedEvent);
    await report({ event: "participant_left", room, identity: host.attendanceId, at: now });
    // The same join again, and a late join older than the leave: neither brings the person back.
    await report(joinedEvent);
    await report({ event: "participant_joined", room, identity: host.attendanceId, at: now - 5 });
    const after = await row(host.attendanceId);
    expect(after?.status).toBe("left");
    expect(after?.leftReason).toBe("dropped");
    expect(after?.joinedAt?.getTime()).toBe((now - 10) * 1000);
  });

  it("TC-F02-57 [AC-F02-29] [AC-F02-49] a dropped person may come back within 30 s, even when locked; others are removed", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "back", 3);
    const host = await joined(t, meeting, organizer);
    const room = host.call?.callId ?? "";
    const people = await Promise.all(members.map((member) => joined(t, meeting, member)));
    const [dropped, ownLeave, longAgo] = people;
    if (!dropped || !ownLeave || !longAgo) throw new Error("people missing");
    const ago = (s: number) => new Date(Date.now() - s * 1000);
    await t.database.db
      .update(callAttendances)
      .set({ status: "left", leftReason: "dropped", leftAt: ago(10) })
      .where(eq(callAttendances.id, dropped.attendanceId));
    await t.database.db
      .update(callAttendances)
      .set({ status: "left", leftReason: "leave", leftAt: ago(5) })
      .where(eq(callAttendances.id, ownLeave.attendanceId));
    await t.database.db
      .update(callAttendances)
      .set({ status: "left", leftReason: "dropped", leftAt: ago(31) })
      .where(eq(callAttendances.id, longAgo.attendanceId));
    await t.database.db.update(calls).set({ locked: true }).where(eq(calls.id, room));
    const { webhooks, recorded } = recordedWebhooks();
    for (const person of people) {
      const body = webhookBody({ event: "participant_joined", room, identity: person.attendanceId });
      await webhooks.receive(body, await webhookSignature(config(), body));
    }
    expect((await row(dropped.attendanceId))?.status).toBe("in_call");
    expect(recorded.removed.sort()).toEqual([ownLeave.attendanceId, longAgo.attendanceId].sort());
  });

  it("TC-F02-40 [AC-F02-49] when the room closes before an admitted person connects, they get the join decision again", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "closed", 1);
    const host = await joined(t, meeting, organizer);
    const member = await joined(t, meeting, members[0]);
    const guestAnswer = await joined(t, meeting, undefined);
    await withTicket(t, host.ticket, {
      method: "POST",
      url: `/api/v1/calls/${host.call?.callId ?? ""}/lobby/admit`,
      payload: { all: true },
    });
    const oldRoom = host.call?.callId ?? "";
    await report({ event: "room_finished", room: oldRoom });
    const memberNow = await statusOf(t, member);
    expect(memberNow.status).toBe("admitted");
    expect(memberNow.call?.callId).not.toBe(oldRoom);
    // A guest must wait under the default lobby rule, so they wait again for someone to let them in.
    const guestNow = await statusOf(t, guestAnswer);
    expect(guestNow.status).toBe("waiting");
    expect(guestNow.call).toBeUndefined();
  });
});

describe("Rejoin", { timeout: 30_000 }, () => {
  async function droppedPerson(label: string): Promise<{ person: Joined; meetingId: string }> {
    const { meeting, organizer, members } = await meetingWithTeam(t, label, 1);
    await joined(t, meeting, organizer);
    const person = await joined(t, meeting, members[0]);
    await t.database.db
      .update(callAttendances)
      .set({ status: "left", leftReason: "dropped", leftAt: new Date(), roleOverride: "attendee" })
      .where(eq(callAttendances.id, person.attendanceId));
    return { person, meetingId: meeting.id };
  }
  const rejoin = (person: Joined) =>
    withTicket(t, person.ticket, { method: "POST", url: `/api/v1/attendances/${person.attendanceId}/rejoin` });

  it("TC-F02-58 [AC-F02-29] works once after a dropped connection, with the old role, as a new attendance", async () => {
    const { person } = await droppedPerson("rejoin");
    const first = await rejoin(person);
    expect(first.statusCode).toBe(200);
    const again = first.json<Joined>();
    expect(again.attendanceId).not.toBe(person.attendanceId);
    expect(again.call?.role).toBe("attendee");
    expect((await rejoin(person)).statusCode).toBe(404);
  });

  it("TC-F02-58 [AC-F02-29] refused after Leave, removal, the end, or 31 minutes", async () => {
    for (const change of [
      { leftReason: "leave" as const },
      { status: "removed" as const, leftReason: "removed" as const },
      { leftReason: "ended" as const },
      { leftAt: new Date(Date.now() - 31 * 60_000) },
    ]) {
      const { person } = await droppedPerson(`norejoin-${randomUUID().slice(0, 4)}`);
      await t.database.db.update(callAttendances).set(change).where(eq(callAttendances.id, person.attendanceId));
      expect((await rejoin(person)).statusCode, JSON.stringify(change)).toBe(404);
    }
  });
});

describe("the end of a call and the record", { timeout: 30_000 }, () => {
  it("TC-F02-80 [AC-F02-39] 10 minutes before 30 hours everyone is told once; at 30 hours the call ends", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "limit");
    const host = await joined(t, meeting, organizer);
    const callId = host.call?.callId ?? "";
    const { livekit, recorded } = recordingLiveKit(t.accounts.callsDeps.livekit);
    let clock = Date.now();
    const jobs = createCallJobs({ ...t.accounts.callsDeps, livekit, now: () => new Date(clock) });
    const [call] = await t.database.db.select().from(calls).where(eq(calls.id, callId));
    const startedAt = call?.startedAt.getTime() ?? 0;
    clock = startedAt + CALL_LIMIT_MS - 11 * 60_000;
    await jobs.endingSoon(callId);
    expect(recorded.messages).toHaveLength(0);
    clock = startedAt + CALL_LIMIT_MS - 10 * 60_000;
    await jobs.endingSoon(callId);
    await jobs.endingSoon(callId);
    expect(recorded.messages.map((sent) => (sent.message as { type: string }).type)).toEqual(["ending_soon"]);
    clock = startedAt + CALL_LIMIT_MS;
    await jobs.timeLimit(callId);
    await jobs.timeLimit(callId);
    const [ended] = await t.database.db.select().from(calls).where(eq(calls.id, callId));
    expect(ended?.endReason).toBe("time_limit");
    expect(recorded.deleted).toEqual([callId]);
  });

  it("TC-F02-80 [AC-F02-41] an emptied call ends at the time the last person left", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "empty");
    const host = await joined(t, meeting, organizer);
    const room = host.call?.callId ?? "";
    const leftAt = seconds(new Date()) - 30;
    await report({ event: "participant_joined", room, identity: host.attendanceId, at: leftAt - 60 });
    await report({ event: "participant_left", room, identity: host.attendanceId, at: leftAt });
    await report({ event: "room_finished", room });
    const [ended] = await t.database.db.select().from(calls).where(eq(calls.id, room));
    expect(ended?.endReason).toBe("last_left");
    expect(ended?.endedAt?.getTime()).toBe(leftAt * 1000);
  });

  it("TC-F02-84 [AC-F02-41] [AC-F02-50] the record is for the people who took part, the organizer and co-organizers", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "record", 2);
    const [took, absent] = members;
    if (!took || !absent) throw new Error("people missing");
    const host = await joined(t, meeting, organizer);
    const room = host.call?.callId ?? "";
    const person = await joined(t, meeting, took);
    const guest = await joined(t, meeting, undefined, { guestName: "Leo Martins" });
    await withTicket(t, host.ticket, {
      method: "POST",
      url: `/api/v1/calls/${room}/lobby/admit`,
      payload: { all: true },
    });
    for (const who of [host, person, guest])
      await report({ event: "participant_joined", room, identity: who.attendanceId });
    const read = (token: string) =>
      t.app.inject({
        method: "GET",
        url: `/api/v1/meetings/${meeting.id}/calls`,
        headers: { origin: "app://meetapp", authorization: `Bearer ${token}` },
      });
    for (const who of [organizer, took]) expect((await read(who.token)).statusCode).toBe(200);
    const record = (await read(took.token)).json<{ calls: { participants: Record<string, unknown>[] }[] }>();
    expect(record.calls[0]?.participants.map((p) => [p["name"], p["group"]]).sort()).toEqual(
      [
        ["Leo Martins", "guest"],
        ["Test Person", "member"],
        ["Test Person", "member"],
      ].sort(),
    );
    expect(JSON.stringify(record)).not.toContain("@");
    for (const who of [absent, await newPerson(t, "record-out")]) expect((await read(who.token)).statusCode).toBe(404);
    const tables = await t.database.db.execute(
      sql`select table_name from information_schema.tables where table_name ilike '%media%' or table_name ilike '%recording%'`,
    );
    expect(tables.rows).toHaveLength(0);
  });

  it("TC-F02-85 [AC-F02-04] a meeting that expires while people are inside goes on; only new joins are refused", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "inside", 1);
    const host = await joined(t, meeting, organizer);
    // Found while the meeting still worked; it expires before the join.
    const token = await lookupToken(t, meeting, members[0]);
    await t.database.db
      .update(meetings)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(meetings.id, meeting.id));
    expect((await statusOf(t, host)).call?.pass).toBeTruthy();
    const late = await join(t, meeting, members[0], { token });
    expect(late.statusCode).toBe(410);
    expect(errorCode(late)).toBe("MEETING_EXPIRED");
  });
});

describe("the minute clean-up", { timeout: 30_000 }, () => {
  it("TC-F02-99 [AC-F02-49] [AC-F02-64] removes people who shouldn't be inside, even without a report; marks the missing as gone", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "clean", 2);
    const host = await joined(t, meeting, organizer);
    const room = host.call?.callId ?? "";
    const [removedOne, silentOne] = await Promise.all(members.map((member) => joined(t, meeting, member)));
    if (!removedOne || !silentOne) throw new Error("people missing");
    await t.database.db
      .update(callAttendances)
      .set({ status: "removed" })
      .where(eq(callAttendances.id, removedOne.attendanceId));
    await t.database.db
      .update(callAttendances)
      .set({ status: "in_call", lastEventAt: new Date(Date.now() - 120_000) })
      .where(eq(callAttendances.id, silentOne.attendanceId));
    const { livekit, recorded } = recordingLiveKit(t.accounts.callsDeps.livekit, {
      rooms: () => [room],
      people: () => [host.attendanceId, removedOne.attendanceId],
    });
    await createCallJobs({ ...t.accounts.callsDeps, livekit }).cleanUp();
    expect(recorded.removed).toEqual([removedOne.attendanceId]);
    expect((await row(silentOne.attendanceId))?.status).toBe("left");
  });

  it("TC-F02-33 [AC-F02-18] times out people who stopped asking after 15 minutes", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "forgot");
    await joined(t, meeting, organizer);
    const guest = await joined(t, meeting);
    await t.database.db
      .update(callAttendances)
      .set({ lobbyEnteredAt: new Date(Date.now() - 16 * 60_000) })
      .where(eq(callAttendances.id, guest.attendanceId));
    const { livekit } = recordingLiveKit(t.accounts.callsDeps.livekit);
    await createCallJobs({ ...t.accounts.callsDeps, livekit }).cleanUp();
    expect((await row(guest.attendanceId))?.status).toBe("timed_out");
  });
});
