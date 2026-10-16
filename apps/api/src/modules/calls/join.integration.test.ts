// Joining a meeting (F02 T6; design.md section 3.3; AC-F02-11, 13–19, 40, 42). Real routes, database
// and call server; own database; needs the `pnpm dev` services.
import { randomUUID } from "node:crypto";
import { callAttendances, calls, workspaceMembers, workspaces } from "@meetapp/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  freshMinute,
  join,
  joined,
  lookupToken,
  meetingWithTeam,
  newAddress,
  newDeviceKey,
  statusOf,
  type TestMeeting,
} from "../../test-support/meetings-setup.ts";
import { errorCode, newPerson } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

/** People already in the call or waiting, put straight in the database. */
async function fill(meeting: TestMeeting, callId: string | null, status: "in_call" | "waiting", count: number) {
  const now = new Date();
  await t.database.db.insert(callAttendances).values(
    Array.from({ length: count }, () => ({
      workspaceId: meeting.workspaceId,
      meetingId: meeting.id,
      callId,
      displayName: "Filler",
      participantGroup: "guest" as const,
      status,
      ticketHash: randomUUID(),
      lastSeenAt: now,
      lobbyEnteredAt: status === "waiting" ? now : null,
    })),
  );
}

const runningCallsOf = (meetingId: string) =>
  t.database.db
    .select()
    .from(calls)
    .where(and(eq(calls.meetingId, meetingId), isNull(calls.endedAt)));

describe("who enters and who waits", { timeout: 30_000 }, () => {
  it("TC-F02-26 [AC-F02-14] by default members enter with a pass; external people and guests wait, seeing only the title", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "default", 1);
    const host = await joined(t, meeting, organizer);
    expect(host.status).toBe("admitted");
    expect(host.call?.role).toBe("organizer");
    expect(host.call?.pass).toBeTruthy();
    const member = await joined(t, meeting, members[0]);
    expect(member.status).toBe("admitted");
    expect(member.call?.callId).toBe(host.call?.callId);
    const external = await joined(t, meeting, await newPerson(t, "default-ext"));
    const guest = await joined(t, meeting, undefined, { guestName: "Leo Martins" });
    for (const waiting of [external, guest]) {
      expect(waiting.status).toBe("waiting");
      expect(waiting.call).toBeUndefined();
      expect(Object.keys(waiting).sort()).toEqual(["attendanceId", "group", "status", "ticket", "title"]);
    }
    expect(external.group).toBe("external");
    expect(guest.group).toBe("guest");
  });

  it("TC-F02-29 [AC-F02-17] guests alone wait even when everyone may skip the lobby; a member's arrival lets them in", async () => {
    const { meeting, members } = await meetingWithTeam(t, "alone", 1, { lobbyBypass: "everyone" });
    const first = await joined(t, meeting);
    const second = await joined(t, meeting);
    expect([first.status, second.status]).toEqual(["waiting", "waiting"]);
    expect((await joined(t, meeting, members[0])).status).toBe("admitted");
    for (const guest of [first, second]) {
      const now = await statusOf(t, guest);
      expect(now.status).toBe("admitted");
      expect(now.call?.pass).toBeTruthy();
    }
  });

  it("TC-F02-28 [AC-F02-16] a changed lobby rule applies to people joining afterwards; waiting people keep waiting", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "rule");
    await joined(t, meeting, organizer);
    const early = await joined(t, meeting, await newPerson(t, "rule-ext1"));
    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/meetings/${meeting.id}/options`,
      payload: { lobbyBypass: "everyone" },
      headers: { origin: "app://meetapp", authorization: `Bearer ${organizer.token}` },
    });
    expect((await statusOf(t, early)).status).toBe("waiting");
    expect((await joined(t, meeting, await newPerson(t, "rule-ext2"))).status).toBe("admitted");
    await t.app.inject({
      method: "PATCH",
      url: `/api/v1/meetings/${meeting.id}/options`,
      payload: { lobbyBypass: "organizers" },
      headers: { origin: "app://meetapp", authorization: `Bearer ${organizer.token}` },
    });
    const member = await newPerson(t, "rule-member");
    await t.database.db
      .insert(workspaceMembers)
      .values({ workspaceId: meeting.workspaceId, userId: member.id, role: "member" });
    expect((await joined(t, meeting, member)).status).toBe("waiting");
  });

  it("TC-F02-23 [AC-F02-13] the same account on two computers is two participants", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "twice");
    const one = await joined(t, meeting, organizer, { deviceKey: newDeviceKey() });
    const two = await joined(t, meeting, organizer, { deviceKey: newDeviceKey() });
    expect(one.attendanceId).not.toBe(two.attendanceId);
    expect(one.ticket).not.toBe(two.ticket);
    expect(one.call?.pass).not.toBe(two.call?.pass);
    const [row] = await t.database.db
      .execute(
        sql`select count(*)::int as n from call_attendances where call_id = ${one.call?.callId} and status = 'admitted'`,
      )
      .then((result) => result.rows as { n: number }[]);
    expect(row?.n).toBe(2);
  });

  it("TC-F02-40 [AC-F02-40] with guests switched off, guests are refused; members still join", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "noguests");
    await t.database.db.update(workspaces).set({ allowGuests: false }).where(eq(workspaces.id, meeting.workspaceId));
    const refused = await join(t, meeting);
    expect(refused.statusCode).toBe(403);
    expect(errorCode(refused)).toBe("GUESTS_NOT_ALLOWED");
    expect((await joined(t, meeting, organizer)).status).toBe("admitted");
  });
});

describe("guest names and lookup tokens", { timeout: 30_000 }, () => {
  it("TC-F02-22 [AC-F02-11] [AC-F02-51] a guest's name: 1–60 characters, trimmed, control characters removed", async () => {
    const { meeting } = await meetingWithTeam(t, "names");
    for (const bad of ["", "   ", "x".repeat(61)]) {
      expect((await join(t, meeting, undefined, { guestName: bad })).statusCode, JSON.stringify(bad)).toBe(400);
    }
    for (const good of ["L", "y".repeat(60)])
      expect((await join(t, meeting, undefined, { guestName: good })).statusCode).toBe(200);
    // Control and format characters go (a direction override or an invisible character can't fake a name).
    const cleaned = await joined(t, meeting, undefined, { guestName: "  Leo\u0007 Mar\u202Etins\u200B\u0000 " });
    const [row] = await t.database.db
      .select()
      .from(callAttendances)
      .where(eq(callAttendances.id, cleaned.attendanceId));
    expect(row?.displayName).toBe("Leo Martins");
    expect(row?.ticketHash).not.toBe(cleaned.ticket);
  });

  it("TC-F02-105 [AC-F02-50] a lookup token works only for its meeting and its person", async () => {
    const a = await meetingWithTeam(t, "tokA");
    const member = await newPerson(t, "tok-member");
    const memberToken = await lookupToken(t, a.meeting, member);
    // The same token used by a guest (no sign-in), or by someone else signed in: the same answer as a miss.
    for (const answer of [
      await join(t, a.meeting, undefined, { token: memberToken }),
      await join(t, a.meeting, a.organizer, { token: memberToken }),
    ]) {
      expect(answer.statusCode).toBe(404);
      expect(errorCode(answer)).toBe("MEETING_NOT_FOUND");
    }
    expect(errorCode(await join(t, a.meeting, member, { token: `${memberToken}x` }))).toBe("MEETING_NOT_FOUND");
    expect((await join(t, a.meeting, member, { token: memberToken })).statusCode).toBe(200);
  });

  it("TC-F02-73 [AC-F02-35] a guest's device key is stored only as a hash, different in every meeting", async () => {
    const deviceKey = newDeviceKey();
    const one = await meetingWithTeam(t, "devA");
    const two = await meetingWithTeam(t, "devB");
    const first = await joined(t, one.meeting, undefined, { deviceKey });
    const second = await joined(t, two.meeting, undefined, { deviceKey });
    const rows = await t.database.db
      .select({ hash: callAttendances.guestDeviceHash })
      .from(callAttendances)
      .where(sql`${callAttendances.id} in (${first.attendanceId}, ${second.attendanceId})`);
    expect(rows.every((row) => row.hash && !row.hash.includes(deviceKey))).toBe(true);
    expect(rows[0]?.hash).not.toBe(rows[1]?.hash);
  });
});

describe("limits and races", { timeout: 30_000 }, () => {
  it("TC-F02-37 [AC-F02-42] two first joins at the same moment share one call", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "race", 1);
    const [a, b] = await Promise.all([joined(t, meeting, organizer), joined(t, meeting, members[0])]);
    expect(a.call?.callId).toBe(b.call?.callId);
    expect(await runningCallsOf(meeting.id)).toHaveLength(1);
  });

  it("TC-F02-38 [AC-F02-42] at 99 people, of two joins at the same moment only one gets in; never 101", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "full", 2);
    const host = await joined(t, meeting, organizer);
    await fill(meeting, host.call?.callId ?? null, "in_call", 98);
    const answers = await Promise.all(members.map((member) => join(t, meeting, member)));
    expect(answers.map((answer) => answer.statusCode).sort()).toEqual([200, 409]);
    const refused = answers.find((answer) => answer.statusCode === 409);
    expect(refused && errorCode(refused)).toBe("MEETING_FULL");
    const another = await newPerson(t, "full-101");
    await t.database.db
      .insert(workspaceMembers)
      .values({ workspaceId: meeting.workspaceId, userId: another.id, role: "member" });
    expect(errorCode(await join(t, meeting, another))).toBe("MEETING_FULL");
  });

  it("TC-F02-35 [AC-F02-19] the lobby holds 100; the 101st is told the meeting is full", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "lobbyfull");
    await joined(t, meeting, organizer);
    await fill(meeting, null, "waiting", 100);
    const refused = await join(t, meeting);
    expect(refused.statusCode).toBe(409);
    expect(errorCode(refused)).toBe("LOBBY_FULL");
  });

  it("TC-F02-95 [AC-F02-48] 10 joins a minute per address", { timeout: 60_000 }, async () => {
    const { meeting } = await meetingWithTeam(t, "flood");
    const address = newAddress();
    await freshMinute();
    const tokens = await Promise.all(Array.from({ length: 11 }, () => lookupToken(t, meeting)));
    const statuses = [];
    for (const token of tokens) {
      const answer = await t.app.inject({
        method: "POST",
        url: "/api/v1/meetings/join",
        payload: { lookupToken: token, deviceKey: newDeviceKey(), guestName: "Flood" },
        remoteAddress: address,
        headers: { origin: "app://meetapp" },
      });
      statuses.push(answer.statusCode);
    }
    expect(statuses.filter((status) => status === 429)).toHaveLength(1);
    expect(statuses.at(-1)).toBe(429);
  });
});
