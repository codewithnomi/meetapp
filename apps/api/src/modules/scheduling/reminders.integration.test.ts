// Reminders, the organizer leaving and the privacy sweep, with real Redis, Postgres and Mailpit (F13 T7).
// Own database; needs the `pnpm dev` services.
import { meetingInvitees, meetings, meetingSchedules, reminderDismissals, workspaceMembers } from "@meetapp/db";
import { and, eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, testEmail, type AuthTestApp } from "../../test-support/auth-app.ts";
import { setting } from "../../test-support/integration.ts";
import { waitForEmail } from "../../test-support/mailpit.ts";
import { caller, newPerson, seedWorkspace, type Call, type Person } from "../../test-support/workspaces-setup.ts";
import { channels } from "../chats/chats-live.ts";
import { createSchedulingUpkeepRepository } from "./reminders.repository.ts";

let t: AuthTestApp;
let call: Call;
let listener: Redis;
const heard: { channel: string; message: { t: string; meetingId?: string; kind?: string } }[] = [];
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
  listener = new Redis({ host: "127.0.0.1", port: Number(setting("REDIS_PORT")) });
  await listener.psubscribe(channels.user("*"));
  listener.on("pmessage", (_pattern, channel, raw) => heard.push({ channel, message: JSON.parse(raw) as never }));
}, 60_000);
afterAll(async () => {
  await listener.quit();
  await t.close();
}, 60_000);

const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const SLOW = { timeout: 30_000 };

async function team(label: string) {
  const owner = await newPerson(t, `${label}-owner`);
  const ana = await newPerson(t, `${label}-ana`);
  const ben = await newPerson(t, `${label}-ben`);
  const workspaceId = await seedWorkspace(t, [
    [owner, "owner"],
    [ana, "member"],
    [ben, "admin"],
  ]);
  return { owner, ana, ben, workspaceId };
}

async function scheduled(owner: Person, workspaceId: string, startsInMs: number, invitees: object[]) {
  const startsAt = new Date(Math.floor((Date.now() + startsInMs) / 1000) * 1000);
  const made = await call(owner.token, "POST", `/api/v1/workspaces/${workspaceId}/scheduled-meetings`, {
    title: "Planning",
    invitees,
    startsAt: startsAt.toISOString(),
    endsAt: new Date(startsAt.getTime() + 30 * MIN).toISOString(),
    allDay: false,
    timeZone: "UTC",
    repeat: { kind: "none" },
    description: "",
  });
  expect(made.statusCode).toBe(201);
  return made.json<{ meetingId: string }>().meetingId;
}

const reminders = (who: Person, meetingId: string) =>
  heard.filter(
    (h) => h.channel === channels.user(who.id) && h.message.t === "reminder" && h.message.meetingId === meetingId,
  );

const run = () => t.accounts.schedulingUpkeep.minute();

describe("the reminders job", () => {
  it(
    "TC-F13-62 [AC-F13-21] one reminder per person and kind; none when declined; never twice; snooze sends again once",
    SLOW,
    async () => {
      const { owner, ana, ben, workspaceId } = await team("job");
      const soon = await scheduled(owner, workspaceId, 14 * MIN, [{ userId: ana.id }, { userId: ben.id }]);
      const now = await scheduled(owner, workspaceId, -1 * MIN, [{ userId: ana.id }]);
      await call(ben.token, "PUT", `/api/v1/meetings/${soon}/schedule/answer`, { answer: "declined", scope: "series" });
      await run();
      await run();
      await expect.poll(() => reminders(ana, soon).map((h) => h.message.kind)).toEqual(["before"]);
      expect(reminders(owner, soon).map((h) => h.message.kind)).toEqual(["before"]);
      expect(reminders(ben, soon)).toEqual([]);
      expect(reminders(ana, now).map((h) => h.message.kind)).toEqual(["start"]);
      // Snooze: it comes back once when the snooze ends (moved into the past here, as if 5 minutes went by).
      const [row] = await t.database.db.select().from(meetingSchedules).where(eq(meetingSchedules.meetingId, soon));
      const snoozed = await call(ana.token, "POST", "/api/v1/reminders/dismiss", {
        meetingId: soon,
        originalStart: row?.startsAt.toISOString(),
        kind: "before",
        snooze: true,
      });
      expect(snoozed.statusCode).toBe(200);
      await expect
        .poll(() => heard.some((h) => h.channel === channels.user(ana.id) && h.message.t === "reminder-dismissed"))
        .toBe(true);
      await t.database.db
        .update(reminderDismissals)
        .set({ snoozedUntil: new Date(Date.now() - 30_000) })
        .where(eq(reminderDismissals.meetingId, soon));
      await run();
      await run();
      await expect.poll(() => reminders(ana, soon).length).toBe(2);
    },
  );

  it(
    "TC-F13-62 [AC-F13-21] a bad saved time zone falls back to the meeting's; the job goes on (T-fix-1)",
    SLOW,
    async () => {
      const { owner, ana, workspaceId } = await team("zone");
      const soon = await scheduled(owner, workspaceId, 14 * MIN, [{ userId: ana.id }]);
      const redis = new Redis({ host: "127.0.0.1", port: Number(setting("REDIS_PORT")) });
      await redis.set(`meetapp:scheduling:zone:${ana.id}`, "Mars/Olympus", "EX", 60);
      await redis.quit();
      await run();
      await expect.poll(() => reminders(ana, soon).map((h) => h.message.kind)).toEqual(["before"]);
      expect(reminders(owner, soon).map((h) => h.message.kind)).toEqual(["before"]);
    },
  );
});

describe("reminders due on start", () => {
  it("TC-F13-63 [AC-F13-22] only meetings not yet ended; a dismissed one stays away", SLOW, async () => {
    const { owner, ana, workspaceId } = await team("due");
    const running = await scheduled(owner, workspaceId, -2 * MIN, [{ userId: ana.id }]);
    const coming = await scheduled(owner, workspaceId, 10 * MIN, [{ userId: ana.id }]);
    const later = await scheduled(owner, workspaceId, 2 * 60 * MIN, [{ userId: ana.id }]);
    const ended = await scheduled(owner, workspaceId, -3 * MIN, [{ userId: ana.id }]);
    await t.database.db
      .update(meetingSchedules)
      .set({ endsAt: new Date(Date.now() - MIN) })
      .where(eq(meetingSchedules.meetingId, ended));
    const due = async () =>
      (await call(ana.token, "GET", `/api/v1/workspaces/${workspaceId}/reminders/due?timeZone=Europe%2FLondon`)).json<{
        reminders: { meetingId: string; kind: string }[];
      }>().reminders;
    const first = await due();
    expect(
      first
        .filter((r) => r.meetingId === running)
        .map((r) => r.kind)
        .sort(),
    ).toEqual(["before", "start"]);
    expect(first.filter((r) => r.meetingId === coming).map((r) => r.kind)).toEqual(["before"]);
    expect(first.some((r) => r.meetingId === later || r.meetingId === ended)).toBe(false);
    const [row] = await t.database.db.select().from(meetingSchedules).where(eq(meetingSchedules.meetingId, coming));
    await call(ana.token, "POST", "/api/v1/reminders/dismiss", {
      meetingId: coming,
      originalStart: row?.startsAt.toISOString(),
      kind: "before",
    });
    expect((await due()).some((r) => r.meetingId === coming)).toBe(false);
  });
});

describe("leaving and forgetting", () => {
  it(
    "TC-F13-69 [AC-F13-29] an invitee who left sees nothing; an organizer who left: meetings cancelled, invitees emailed",
    SLOW,
    async () => {
      const { owner, ana, ben, workspaceId } = await team("leave");
      const outside = testEmail("leave-outside");
      const meetingId = await scheduled(owner, workspaceId, DAY, [{ userId: ana.id }, { email: outside }]);
      await t.database.db
        .delete(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, ana.id)));
      expect((await call(ana.token, "GET", `/api/v1/meetings/${meetingId}/schedule`)).statusCode).toBe(404);
      const since = new Date();
      await t.database.db
        .delete(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, owner.id)));
      await run();
      await waitForEmail(outside, { since, subject: /^Cancelled: Planning/ });
      const [schedule] = await t.database.db
        .select()
        .from(meetingSchedules)
        .where(eq(meetingSchedules.meetingId, meetingId));
      expect(schedule?.cancelledAt).not.toBeNull();
      expect(
        (
          await call(
            ben.token,
            "GET",
            `/api/v1/workspaces/${workspaceId}/calendar?from=${new Date().toISOString()}&to=${new Date(Date.now() + 7 * DAY).toISOString()}`,
          )
        ).json<{ occurrences: unknown[] }>().occurrences,
      ).toEqual([]);
    },
  );

  it(
    "TC-F13-70 [AC-F13-30] outside addresses go 30 days after a meeting was cancelled or expired; others stay",
    SLOW,
    async () => {
      const { owner, workspaceId } = await team("sweep");
      const make = () => scheduled(owner, workspaceId, DAY, [{ email: "same@example.test" }]);
      const [cancelledLong, cancelledRecent, expiredLong, active] = [
        await make(),
        await make(),
        await make(),
        await make(),
      ];
      const days = (n: number) => new Date(Date.now() - n * DAY);
      await t.database.db
        .update(meetingSchedules)
        .set({ cancelledAt: days(31) })
        .where(eq(meetingSchedules.meetingId, cancelledLong));
      await t.database.db
        .update(meetingSchedules)
        .set({ cancelledAt: days(29) })
        .where(eq(meetingSchedules.meetingId, cancelledRecent));
      await t.database.db
        .update(meetings)
        .set({ expiresAt: days(31) })
        .where(eq(meetings.id, expiredLong));
      await createSchedulingUpkeepRepository(t.database.db).sweepOutsideInvitees(days(30));
      const left = async (meetingId: string) =>
        (await t.database.db.select().from(meetingInvitees).where(eq(meetingInvitees.meetingId, meetingId))).length;
      expect([
        await left(cancelledLong),
        await left(cancelledRecent),
        await left(expiredLong),
        await left(active),
      ]).toEqual([0, 1, 0, 1]);
    },
  );
});
