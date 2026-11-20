// Answering, changing and cancelling scheduled meetings through the real routes, with live news heard on
// Redis and emails read from Mailpit (F13 T6). Own database; needs the `pnpm dev` services.
import { meetingInvitees, meetings } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, testEmail, type AuthTestApp } from "../../test-support/auth-app.ts";
import { setting } from "../../test-support/integration.ts";
import { waitForEmail } from "../../test-support/mailpit.ts";
import { newAddress } from "../../test-support/meetings-setup.ts";
import { caller, newPerson, seedWorkspace, type Call, type Person } from "../../test-support/workspaces-setup.ts";
import { channels } from "../chats/chats-live.ts";

let t: AuthTestApp;
let call: Call;
let listener: Redis;
const heard: { channel: string; message: { t: string; meetingId?: string; change?: string } }[] = [];
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

const SLOW = { timeout: 30_000 };
const DAY = 24 * 60 * 60 * 1000;
const start = new Date(Math.ceil((Date.now() + DAY) / 3_600_000) * 3_600_000);
const iso = (ms: number) => new Date(start.getTime() + ms).toISOString();

async function team(label: string) {
  const owner = await newPerson(t, `${label}-owner`);
  const ana = await newPerson(t, `${label}-ana`);
  const ben = await newPerson(t, `${label}-ben`);
  const other = await newPerson(t, `${label}-other`);
  const workspaceId = await seedWorkspace(t, [
    [owner, "owner"],
    [ana, "member"],
    [ben, "member"],
    [other, "member"],
  ]);
  return { owner, ana, ben, other, workspaceId };
}

async function scheduled(owner: Person, workspaceId: string, invitees: object[], repeat: object = { kind: "daily" }) {
  const made = await call(owner.token, "POST", `/api/v1/workspaces/${workspaceId}/scheduled-meetings`, {
    title: "Stand-up",
    invitees,
    startsAt: iso(0),
    endsAt: iso(15 * 60 * 1000),
    allDay: false,
    timeZone: "UTC",
    repeat,
    description: "",
  });
  expect(made.statusCode).toBe(201);
  return made.json<{ meetingId: string }>().meetingId;
}

/** Waits until `who` heard this live message (D064). */
const hears = (who: Person, meetingId: string, t: string, change?: string) =>
  expect
    .poll(
      () =>
        heard.some(
          (h) =>
            h.channel === channels.user(who.id) &&
            h.message.t === t &&
            h.message.meetingId === meetingId &&
            (change === undefined || h.message.change === change),
        ),
      { timeout: 5_000 },
    )
    .toBe(true);

const calendarOf = async (who: Person, workspaceId: string) =>
  (
    await call(who.token, "GET", `/api/v1/workspaces/${workspaceId}/calendar?from=${iso(-DAY)}&to=${iso(6 * DAY)}`)
  ).json<{
    occurrences: {
      meetingId: string;
      originalStart: string;
      startsAt: string;
      myAnswer: string | null;
      title: string;
    }[];
  }>().occurrences;

describe("answers", () => {
  it("TC-F13-53 [AC-F13-16] an answer for the series or one occurrence reaches the organizer live", async () => {
    const { owner, ana, workspaceId } = await team("answer");
    const meetingId = await scheduled(owner, workspaceId, [{ userId: ana.id }]);
    const put = (body: object) => call(ana.token, "PUT", `/api/v1/meetings/${meetingId}/schedule/answer`, body);
    expect((await put({ answer: "accepted", scope: "series" })).statusCode).toBe(200);
    await hears(owner, meetingId, "calendar", "changed");
    const details = await call(owner.token, "GET", `/api/v1/meetings/${meetingId}/schedule`);
    expect(details.json<{ invitees: { answer: string }[] }>().invitees[0]?.answer).toBe("accepted");
    const second = (await calendarOf(ana, workspaceId))[1];
    expect(
      (await put({ answer: "declined", scope: "occurrence", originalStart: second?.originalStart })).statusCode,
    ).toBe(200);
    const after = await calendarOf(ana, workspaceId);
    expect(after.map((o) => o.myAnswer).slice(0, 3)).toEqual(["accepted", "declined", "accepted"]);
    expect(
      (
        await call(owner.token, "PUT", `/api/v1/meetings/${meetingId}/schedule/answer`, {
          answer: "accepted",
          scope: "series",
        })
      ).statusCode,
    ).toBe(403);
  });

  it('TC-F13-54 [AC-F13-17] an invited member gets an "invited" notification and the meeting appears live', async () => {
    const { owner, ana, workspaceId } = await team("invited");
    const meetingId = await scheduled(owner, workspaceId, [{ userId: ana.id }]);
    expect(meetingId).toMatch(/^[0-9a-f-]{36}$/);
    await hears(ana, meetingId, "invited");
    await hears(ana, meetingId, "calendar", "added");
    await hears(owner, meetingId, "calendar", "added");
  });
});

describe("changes", () => {
  it(
    "TC-F13-55 [AC-F13-18] an update emails everyone, invites the added, cancels for the removed; moving the series resets answers",
    SLOW,
    async () => {
      const { owner, ana, ben, workspaceId } = await team("update");
      const outside = testEmail("update-outside");
      const meetingId = await scheduled(owner, workspaceId, [{ userId: ana.id }, { email: outside }]);
      await call(ana.token, "PUT", `/api/v1/meetings/${meetingId}/schedule/answer`, {
        answer: "accepted",
        scope: "series",
      });
      const since = new Date();
      const updated = await call(owner.token, "PATCH", `/api/v1/meetings/${meetingId}/schedule`, {
        scope: "series",
        title: "Daily stand-up",
        startsAt: iso(60 * 60 * 1000),
        endsAt: iso(75 * 60 * 1000),
        invitees: [{ userId: ana.id }, { userId: ben.id }],
      });
      expect(updated.statusCode).toBe(200);
      await waitForEmail(ana.email, { since, subject: /^Updated: Daily stand-up/ });
      await waitForEmail(ben.email, { since, subject: /^Invitation: Daily stand-up/ });
      await waitForEmail(outside, { since, subject: /^Cancelled: Daily stand-up/ });
      await hears(ana, meetingId, "calendar", "changed");
      await hears(ben, meetingId, "calendar", "added");
      const rows = await t.database.db.select().from(meetingInvitees).where(eq(meetingInvitees.meetingId, meetingId));
      expect(rows.map((r) => r.answer)).toEqual(["none", "none"]);
      expect(rows.some((r) => r.userId === null)).toBe(false);
    },
  );

  it("TC-F13-55 [AC-F13-18] one occurrence moved: only it changes, with its own email", SLOW, async () => {
    const { owner, ana, workspaceId } = await team("occurrence");
    const meetingId = await scheduled(owner, workspaceId, [{ userId: ana.id }]);
    const second = (await calendarOf(owner, workspaceId))[1];
    const since = new Date();
    const moved = await call(owner.token, "PATCH", `/api/v1/meetings/${meetingId}/schedule`, {
      scope: "occurrence",
      originalStart: second?.originalStart,
      startsAt: iso(DAY + 3 * 60 * 60 * 1000),
      endsAt: iso(DAY + 3.5 * 60 * 60 * 1000),
      title: "Special stand-up",
    });
    expect(moved.statusCode).toBe(200);
    const after = await calendarOf(ana, workspaceId);
    expect(after.map((o) => o.title).slice(0, 3)).toEqual(["Stand-up", "Special stand-up", "Stand-up"]);
    expect(after[1]?.startsAt).toBe(iso(DAY + 3 * 60 * 60 * 1000));
    await waitForEmail(ana.email, { since, subject: /^Updated:/ });
  });

  it(
    "TC-F13-56 [AC-F13-19] cancelling one occurrence skips it; cancelling the series removes it everywhere and stops the link",
    SLOW,
    async () => {
      const { owner, ana, workspaceId } = await team("cancel");
      const meetingId = await scheduled(owner, workspaceId, [{ userId: ana.id }]);
      const second = (await calendarOf(owner, workspaceId))[1];
      let since = new Date();
      const one = await call(owner.token, "POST", `/api/v1/meetings/${meetingId}/schedule/cancel`, {
        scope: "occurrence",
        originalStart: second?.originalStart,
      });
      expect(one.statusCode).toBe(200);
      expect((await calendarOf(ana, workspaceId)).map((o) => o.originalStart)).not.toContain(second?.originalStart);
      await waitForEmail(ana.email, { since, subject: /^Cancelled:/ });
      const { link } = (await call(owner.token, "GET", `/api/v1/meetings/${meetingId}/schedule`)).json<{
        link: string;
      }>();
      since = new Date();
      const all = await call(owner.token, "POST", `/api/v1/meetings/${meetingId}/schedule/cancel`, {
        scope: "series",
        message: "No more stand-ups",
      });
      expect(all.statusCode).toBe(200);
      expect(await calendarOf(ana, workspaceId)).toEqual([]);
      await hears(ana, meetingId, "calendar", "removed");
      await waitForEmail(ana.email, { since, subject: /^Cancelled:/ });
      const lookup = await t.app.inject({
        method: "POST",
        url: "/api/v1/meeting-lookups",
        payload: { link },
        remoteAddress: newAddress(),
      });
      expect(lookup.statusCode).toBe(410);
    },
  );
});

describe("who may change", () => {
  it("TC-F13-57 [AC-F13-20, AC-F13-26] an invitee gets 403 on changes; others get 404 on everything; nothing changes", async () => {
    const { owner, ana, other, workspaceId } = await team("rights");
    const stranger = await newPerson(t, "rights-stranger");
    const meetingId = await scheduled(owner, workspaceId, [{ userId: ana.id }]);
    const tries = (who: Person) => [
      call(who.token, "PATCH", `/api/v1/meetings/${meetingId}/schedule`, { scope: "series", title: "Hacked" }),
      call(who.token, "POST", `/api/v1/meetings/${meetingId}/schedule/cancel`, { scope: "series" }),
      call(who.token, "POST", `/api/v1/meetings/${meetingId}/schedule/resend`),
    ];
    expect((await Promise.all(tries(ana))).map((r) => r.statusCode)).toEqual([403, 403, 403]);
    for (const who of [other, stranger]) {
      const answers = await Promise.all([
        ...tries(who),
        call(who.token, "GET", `/api/v1/meetings/${meetingId}/schedule`),
        call(who.token, "PUT", `/api/v1/meetings/${meetingId}/schedule/answer`, {
          answer: "accepted",
          scope: "series",
        }),
      ]);
      expect(answers.map((r) => r.statusCode)).toEqual([404, 404, 404, 404, 404]);
    }
    const [row] = await t.database.db.select().from(meetings).where(eq(meetings.id, meetingId));
    expect(row?.title).toBe("Stand-up");
  });
});
