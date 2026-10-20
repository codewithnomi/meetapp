// Fixes from the first F02 verification (T-fix-3; AC-F02-29, 42): a person let in who never connects
// frees their place, Rejoin works after a call that couldn't connect, and a Rejoin that is refused can be
// tried again. Real routes and database; the call server's side is recorded. Needs the `pnpm dev` services.
import { callAttendances } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { recordingLiveKit } from "../../test-support/livekit-events.ts";
import { joined, meetingWithTeam, withTicket, type Joined } from "../../test-support/meetings-setup.ts";
import { errorCode } from "../../test-support/workspaces-setup.ts";
import { createCallJobs } from "./calls.jobs.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const row = async (id: string) =>
  (await t.database.db.select().from(callAttendances).where(eq(callAttendances.id, id)))[0];
const rejoin = (person: Joined) =>
  withTicket(t, person.ticket, { method: "POST", url: `/api/v1/attendances/${person.attendanceId}/rejoin` });

describe("people let in who never connect", { timeout: 30_000 }, () => {
  it("T-fix-3 [AC-F02-42] the clean-up frees their place after a minute", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "never", 1);
    const host = await joined(t, meeting, organizer);
    const absent = await joined(t, meeting, members[0]);
    expect(absent.status).toBe("admitted");
    await t.database.db
      .update(callAttendances)
      .set({ admittedAt: new Date(Date.now() - 2 * 60_000) })
      .where(eq(callAttendances.id, absent.attendanceId));
    const { livekit } = recordingLiveKit(t.accounts.callsDeps.livekit, {
      rooms: () => [host.call?.callId ?? ""],
      people: () => [host.attendanceId],
    });
    await createCallJobs({ ...t.accounts.callsDeps, livekit }).cleanUp();
    const after = await row(absent.attendanceId);
    expect([after?.status, after?.leftReason]).toEqual(["left", "dropped"]);
  });

  it("T-fix-3 [AC-F02-29] after a call that couldn't connect, Rejoin lets them in again", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "noconnect", 1);
    await joined(t, meeting, organizer);
    const person = await joined(t, meeting, members[0]);
    const again = await rejoin(person);
    expect(again.statusCode).toBe(200);
    expect(again.json<Joined>().status).toBe("admitted");
    expect((await row(person.attendanceId))?.status).toBe("left");
  });
});

describe("a Rejoin that is refused", { timeout: 30_000 }, () => {
  it("T-fix-3 [AC-F02-29] [AC-F02-37] is not used up: refused while locked, accepted once unlocked", async () => {
    const { meeting, organizer, members } = await meetingWithTeam(t, "relock", 1);
    const host = await joined(t, meeting, organizer);
    const person = await joined(t, meeting, members[0]);
    await t.database.db
      .update(callAttendances)
      .set({ status: "left", leftReason: "dropped", leftAt: new Date(), joinedAt: new Date() })
      .where(eq(callAttendances.id, person.attendanceId));
    const lock = (locked: boolean) =>
      withTicket(t, host.ticket, {
        method: "PATCH",
        url: `/api/v1/calls/${host.call?.callId ?? ""}`,
        payload: { locked },
      });
    await lock(true);
    expect(errorCode(await rejoin(person))).toBe("MEETING_LOCKED");
    await lock(false);
    expect((await rejoin(person)).statusCode).toBe(200);
    expect((await rejoin(person)).statusCode).toBe(404);
  });
});

describe("the load test's simulated people", { timeout: 30_000 }, () => {
  it("T-fix-8 [AC-F02-42] are removed like anyone not let in, unless the load test's switch keeps them", async () => {
    const { meeting, organizer } = await meetingWithTeam(t, "simulated", 0);
    const host = await joined(t, meeting, organizer);
    const seen = { rooms: () => [host.call?.callId ?? ""], people: () => [host.attendanceId, "sim_pub_1"] };
    const removedWith = async (keepSimulated: boolean) => {
      const { livekit, recorded } = recordingLiveKit(t.accounts.callsDeps.livekit, seen);
      await createCallJobs({ ...t.accounts.callsDeps, livekit }, { keepSimulated }).cleanUp();
      return recorded.removed;
    };
    expect(await removedWith(false)).toEqual(["sim_pub_1"]);
    expect(await removedWith(true)).toEqual([]);
  });
});
