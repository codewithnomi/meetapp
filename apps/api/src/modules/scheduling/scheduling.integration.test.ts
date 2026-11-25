// Scheduling meetings and reading the calendar through the real routes (F13 T4; design.md "Backend
// endpoints"). Own database; needs the `pnpm dev` services. Emails, answers and live news come in T5–T6.
import { meetingInvitees, meetings, meetingSchedules } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { newAddress } from "../../test-support/meetings-setup.ts";
import {
  caller,
  errorCode,
  newPerson,
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

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(Math.ceil((Date.now() + ms) / HOUR) * HOUR).toISOString();

async function team(label: string, count = 2) {
  const owner = await newPerson(t, `${label}-owner`);
  const others = await Promise.all(Array.from({ length: count }, (_, i) => newPerson(t, `${label}-${String(i)}`)));
  const workspaceId = await seedWorkspace(t, [
    [owner, "owner"],
    ...others.map((p): [Person, "member"] => [p, "member"]),
  ]);
  return { owner, others, workspaceId };
}

const body = (invitees: object[], extra: object = {}) => ({
  title: "Weekly sync",
  invitees,
  startsAt: at(DAY),
  endsAt: new Date(Date.parse(at(DAY)) + 30 * 60 * 1000).toISOString(),
  allDay: false,
  timeZone: "Europe/London",
  repeat: { kind: "none" },
  description: "Agenda",
  ...extra,
});

const schedule = (who: Person, workspaceId: string, payload: object) =>
  call(who.token, "POST", `/api/v1/workspaces/${workspaceId}/scheduled-meetings`, payload);

const calendar = async (who: Person, workspaceId: string, from = at(0), to = at(7 * DAY)) => {
  const answer = await call(who.token, "GET", `/api/v1/workspaces/${workspaceId}/calendar?from=${from}&to=${to}`);
  return answer;
};
const listed = async (who: Person, workspaceId: string) =>
  (await calendar(who, workspaceId))
    .json<{ occurrences: { meetingId: string }[] }>()
    .occurrences.map((o) => o.meetingId);

describe("scheduling a meeting", () => {
  it("TC-F13-47 [AC-F13-09, AC-F13-13] makes a scheduled F02 meeting with its schedule and invitees, in each member's calendar", async () => {
    const { owner, others, workspaceId } = await team("create");
    const [ana, ben] = others as [Person, Person];
    const made = await schedule(
      owner,
      workspaceId,
      body([{ userId: ana.id }, { userId: ben.id }, { email: "Out@Example.test" }]),
    );
    expect(made.statusCode).toBe(201);
    const { meetingId } = made.json<{ meetingId: string }>();
    const [meeting] = await t.database.db.select().from(meetings).where(eq(meetings.id, meetingId));
    expect(meeting).toMatchObject({ kind: "scheduled", organizerId: owner.id, title: "Weekly sync" });
    const invitees = await t.database.db.select().from(meetingInvitees).where(eq(meetingInvitees.meetingId, meetingId));
    expect(invitees).toHaveLength(3);
    const outside = invitees.find((row) => row.userId === null);
    expect(outside?.emailEnc).not.toContain("example");
    for (const who of [owner, ana, ben]) expect(await listed(who, workspaceId)).toContain(meetingId);
  });

  it("TC-F13-48 [AC-F13-10] the server refuses wrong fields, naming them, and keeps nothing", async () => {
    const { owner, workspaceId } = await team("wrong", 0);
    const outsider = await newPerson(t, "wrong-outsider");
    const start = at(DAY);
    const cases: [object, string][] = [
      [{ title: "" }, "/title"],
      [{ title: "x".repeat(101) }, "/title"],
      [{ endsAt: start }, "/endsAt"],
      [{ startsAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), endsAt: at(HOUR) }, "/startsAt"],
      [{ description: "x".repeat(2001) }, "/description"],
      [{ invitees: [{ email: "nope" }] }, "/invitees"],
      [{ invitees: [{ userId: outsider.id }] }, "/invitees"],
    ];
    for (const [change, path] of cases) {
      const answer = await schedule(owner, workspaceId, { ...body([]), ...change });
      expect(answer.statusCode, JSON.stringify(change)).toBe(400);
      const details = answer.json<{ error: { details: { path: string }[] } }>().error.details;
      expect(details.map((d) => d.path).join(" ")).toContain(path);
    }
    const rows = await t.database.db.select().from(meetings).where(eq(meetings.organizerId, owner.id));
    expect(rows).toHaveLength(0);
  });

  it("TC-F13-49 [AC-F13-14] the 51st meeting in an hour is refused with the wait time, shared with F02", async () => {
    const { owner, workspaceId } = await team("limit", 0);
    for (let i = 0; i < 49; i++) expect((await schedule(owner, workspaceId, body([]))).statusCode).toBe(201);
    const link = await call(owner.token, "POST", `/api/v1/workspaces/${workspaceId}/meetings`, { kind: "link" });
    expect(link.statusCode).toBe(201);
    const refused = await schedule(owner, workspaceId, body([]));
    expect(refused.statusCode).toBe(429);
    expect(errorCode(refused)).toBe("TOO_MANY_ATTEMPTS");
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    const scheduled = await t.database.db
      .select()
      .from(meetingSchedules)
      .where(eq(meetingSchedules.workspaceId, workspaceId));
    expect(scheduled).toHaveLength(49);
  });

  it("TC-F13-66 [AC-F13-12] Meet now and meeting links work as before and stay out of the calendar", async () => {
    const { owner, workspaceId } = await team("f02", 0);
    for (const kind of ["meet_now", "link"]) {
      expect((await call(owner.token, "POST", `/api/v1/workspaces/${workspaceId}/meetings`, { kind })).statusCode).toBe(
        201,
      );
    }
    expect(await listed(owner, workspaceId)).toEqual([]);
  });
});

describe("reading the calendar", () => {
  it("TC-F13-22 [AC-F13-03] Join is offered from 5 minutes before the start until the end", async () => {
    const { owner, workspaceId } = await team("join", 0);
    const MIN = 60 * 1000;
    const make = async (title: string, startIn: number) => {
      const startsAt = new Date(Date.now() + startIn * MIN).toISOString();
      const endsAt = new Date(Date.now() + (startIn + 30) * MIN).toISOString();
      expect((await schedule(owner, workspaceId, body([], { title, startsAt, endsAt }))).statusCode).toBe(201);
    };
    await make("In six", 6);
    await make("In four", 4);
    await make("Started", -4);
    const read = await calendar(owner, workspaceId, new Date(Date.now() - HOUR).toISOString(), at(DAY));
    const join = Object.fromEntries(
      read.json<{ occurrences: { title: string; canJoin: boolean }[] }>().occurrences.map((o) => [o.title, o.canJoin]),
    );
    expect(join).toEqual({ "In six": false, "In four": true, Started: true });
  });

  it("TC-F13-67 [AC-F13-01, AC-F13-11] occurrences of a daily series for a day, a week and 42 days, with canJoin", async () => {
    const { owner, workspaceId } = await team("range", 0);
    const startsAt = new Date(Date.now() + 2 * 60 * 1000).toISOString();
    const endsAt = new Date(Date.now() + 32 * 60 * 1000).toISOString();
    await schedule(owner, workspaceId, body([], { startsAt, endsAt, repeat: { kind: "daily" } }));
    const read = async (days: number) =>
      (
        await calendar(
          owner,
          workspaceId,
          new Date(Date.now() - HOUR).toISOString(),
          new Date(Date.now() - HOUR + days * DAY).toISOString(),
        )
      ).json<{ occurrences: { canJoin: boolean; repeats: boolean }[]; truncated: boolean }>();
    expect((await read(1)).occurrences).toHaveLength(1);
    expect((await read(7)).occurrences).toHaveLength(7);
    const month = await read(42);
    expect(month.occurrences).toHaveLength(42);
    expect(month.truncated).toBe(false);
    expect(month.occurrences[0]).toMatchObject({ canJoin: true, repeats: true });
    expect(month.occurrences[1]?.canJoin).toBe(false);
    const tooLong = await calendar(owner, workspaceId, at(0), at(43 * DAY));
    expect(tooLong.statusCode).toBe(400);
    const farAway = await calendar(owner, workspaceId, at(400 * DAY), at(420 * DAY));
    expect(farAway.json<{ occurrences: unknown[] }>().occurrences).toEqual([]);
  });
});

describe("who sees what", () => {
  it("TC-F13-58 [AC-F13-26] a meeting is listed only in its own workspace and for people in it; others get 404", async () => {
    const { owner, others, workspaceId } = await team("scope", 1);
    const [uninvited] = others as [Person];
    const otherWorkspace = await seedWorkspace(
      t,
      [
        [owner, "owner"],
        [uninvited, "member"],
      ],
      "Other",
    );
    const { meetingId } = (await schedule(owner, workspaceId, body([]))).json<{ meetingId: string }>();
    expect(await listed(owner, otherWorkspace)).toEqual([]);
    expect(await listed(uninvited, workspaceId)).toEqual([]);
    const details = await call(uninvited.token, "GET", `/api/v1/meetings/${meetingId}/schedule`);
    const missing = await call(uninvited.token, "GET", `/api/v1/meetings/${crypto.randomUUID()}/schedule`);
    expect(details.statusCode).toBe(404);
    expect(details.json<{ error: { code: string; message: string } }>().error).toMatchObject({
      code: missing.json<{ error: { code: string } }>().error.code,
    });
    const stranger = await newPerson(t, "scope-stranger");
    expect((await calendar(stranger, workspaceId)).statusCode).toBe(404);
  });

  it("TC-F13-59, TC-F13-45 [AC-F13-26, AC-F13-27] invitees see names and answers; only organizers see outside addresses", async () => {
    const { owner, others, workspaceId } = await team("emails", 1);
    const [ana] = others as [Person];
    const { meetingId } = (
      await schedule(owner, workspaceId, body([{ userId: ana.id }, { email: "guest@example.test" }]))
    ).json<{ meetingId: string }>();
    const asAna = await call(ana.token, "GET", `/api/v1/meetings/${meetingId}/schedule`);
    expect(asAna.statusCode).toBe(200);
    expect(asAna.body).not.toContain("guest@example.test");
    const anaView = asAna.json<{
      invitees: { member: { id: string } | null }[];
      hiddenExternal: number;
      canManage: boolean;
    }>();
    expect(anaView.invitees.map((i) => i.member?.id)).toEqual([ana.id]);
    expect(anaView).toMatchObject({ hiddenExternal: 1, canManage: false });
    const asOwner = await call(owner.token, "GET", `/api/v1/meetings/${meetingId}/schedule`);
    expect(asOwner.body).toContain("guest@example.test");
    const [stored] = await t.database.db.select().from(meetingInvitees).where(eq(meetingInvitees.meetingId, meetingId));
    for (const secret of [stored?.emailEnc, stored?.emailLookup].filter(Boolean))
      expect(asOwner.body).not.toContain(secret);
    expect(asOwner.json<{ link: string; passcode: string }>().link).toMatch(/\/m\//);
  });

  it("TC-F13-60 [AC-F13-26] an outside invitee who signs up later doesn't see it in the calendar; the link still opens", async () => {
    // A member of the workspace who was invited only by their email address, as an outside person.
    const { owner, others, workspaceId } = await team("signup", 1);
    const [later] = others as [Person];
    const { meetingId } = (await schedule(owner, workspaceId, body([{ email: later.email }]))).json<{
      meetingId: string;
    }>();
    expect(await listed(later, workspaceId)).not.toContain(meetingId);
    const { link } = (await call(owner.token, "GET", `/api/v1/meetings/${meetingId}/schedule`)).json<{
      link: string;
    }>();
    const found = await t.app.inject({
      method: "POST",
      url: "/api/v1/meeting-lookups",
      payload: { link },
      remoteAddress: newAddress(),
    });
    expect(found.statusCode).toBe(200);
  });
});

describe("F02 rules for scheduled meetings", () => {
  it("TC-F13-64 TC-F13-65 [AC-F13-13] the scheduler is the organizer; the link works until 60 days after the last occurrence", async () => {
    const { owner, workspaceId } = await team("expiry", 0);
    const ended = (
      await schedule(owner, workspaceId, body([], { repeat: { kind: "daily", until: at(3 * DAY) } }))
    ).json<{ meetingId: string }>();
    const endless = (await schedule(owner, workspaceId, body([], { repeat: { kind: "weekly" } }))).json<{
      meetingId: string;
    }>();
    const [endedRow] = await t.database.db.select().from(meetings).where(eq(meetings.id, ended.meetingId));
    const [endlessRow] = await t.database.db.select().from(meetings).where(eq(meetings.id, endless.meetingId));
    const lastEnd = Date.parse(at(DAY)) + 2 * DAY + 30 * 60 * 1000;
    expect(endedRow?.expiresAt.getTime()).toBe(lastEnd + 60 * DAY);
    expect(endlessRow?.expiresAt.getUTCFullYear()).toBe(9999);
    const info = await call(owner.token, "GET", `/api/v1/meetings/${ended.meetingId}`);
    expect(info.json<{ kind: string; organizer: { id: string } }>()).toMatchObject({
      kind: "scheduled",
      organizer: { id: owner.id },
    });
    const { link } = (await call(owner.token, "GET", `/api/v1/meetings/${ended.meetingId}/schedule`)).json<{
      link: string;
    }>();
    const lookup = () =>
      t.app.inject({ method: "POST", url: "/api/v1/meeting-lookups", payload: { link }, remoteAddress: newAddress() });
    expect((await lookup()).statusCode).toBe(200);
    await t.database.db
      .update(meetings)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(meetings.id, ended.meetingId));
    expect((await lookup()).statusCode).toBe(410);
  });
});
