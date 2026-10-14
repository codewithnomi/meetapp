// Making meetings and changing their options through the real routes (F02 T3; design.md section 3.1).
// Own database; needs the `pnpm dev` services.
import { meetings, user, workspaceMembers, workspaces } from "@meetapp/db";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import {
  caller,
  errorCode,
  newPerson,
  seedWorkspace,
  type Call,
  type Person,
} from "../../test-support/workspaces-setup.ts";
import { MEETING_LIFETIME_MS } from "./expiry.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

interface Created {
  id: string;
  title: string;
  link: string;
  meetingNumber: string;
  passcode: string;
  lookupToken: string;
  organizer: { id: string; name: string };
  options: { lobbyBypass: string; whoCanPresent: string; allowAttendeeMic: boolean; allowAttendeeCamera: boolean };
  expiresAt: string;
}

const create = (who: Person, workspaceId: string, body: object, key?: string) =>
  t.app.inject({
    method: "POST",
    url: `/api/v1/workspaces/${workspaceId}/meetings`,
    payload: body,
    headers: {
      origin: "app://meetapp",
      authorization: `Bearer ${who.token}`,
      ...(key ? { "idempotency-key": key } : {}),
    },
  });

async function team(label: string, extra: [string, "admin" | "member"][] = []) {
  const owner = await newPerson(t, `${label}-owner`);
  const others = await Promise.all(extra.map(([name]) => newPerson(t, `${label}-${name}`)));
  const workspaceId = await seedWorkspace(t, [
    [owner, "owner"],
    ...others.map((p, i): [Person, "admin" | "member"] => [p, extra[i]?.[1] ?? "member"]),
  ]);
  return { owner, others, workspaceId };
}

describe("making a meeting", () => {
  it("TC-F02-02 [AC-F02-01] [AC-F02-03] Meet now: titled after the organizer, 60 days, default options, a lookup token", async () => {
    const { owner, workspaceId } = await team("meetnow");
    await t.database.db.update(user).set({ name: "Aisha Khan" }).where(eq(user.id, owner.id));
    const before = Date.now();
    const response = await create(owner, workspaceId, { kind: "meet_now" });
    expect(response.statusCode).toBe(201);
    const meeting = response.json<Created>();
    expect(meeting.title).toBe("Meeting with Aisha Khan");
    expect(meeting.organizer).toEqual({ id: owner.id, name: "Aisha Khan" });
    expect(meeting.options).toEqual({
      lobbyBypass: "workspace",
      whoCanPresent: "everyone",
      allowAttendeeMic: true,
      allowAttendeeCamera: true,
      coOrganizerIds: [],
    });
    const lifetime = Date.parse(meeting.expiresAt) - before;
    expect(lifetime).toBeGreaterThanOrEqual(MEETING_LIFETIME_MS - 1000);
    expect(lifetime).toBeLessThanOrEqual(MEETING_LIFETIME_MS + 5000);
    expect(meeting.meetingNumber).toMatch(/^[1-9]\d{11}$/);
    expect(meeting.link).toMatch(/\/m\/[A-Za-z0-9_-]{22}$/);
    expect(meeting.lookupToken).toContain(".");
  });

  it("TC-F02-03 [AC-F02-02] a link meeting: title trimmed, default title, 101 characters refused; the organizer reads it", async () => {
    const { owner, workspaceId } = await team("getlink");
    const titled = (await create(owner, workspaceId, { kind: "link", title: " Weekly sync " })).json<Created>();
    expect(titled.title).toBe("Weekly sync");
    expect((await create(owner, workspaceId, { kind: "link" })).json<Created>().title).toBe("Meeting with Test Person");
    expect((await create(owner, workspaceId, { kind: "link", title: "x".repeat(101) })).statusCode).toBe(400);
    const read = await call(owner.token, "GET", `/api/v1/meetings/${titled.id}`);
    expect(read.statusCode).toBe(200);
    expect(read.json<Created>()).toMatchObject({
      link: titled.link,
      meetingNumber: titled.meetingNumber,
      passcode: titled.passcode,
    });
    const calls = await t.database.db.execute(
      sql`select count(*)::int as n from calls where meeting_id = ${titled.id}`,
    );
    expect(calls.rows[0]).toEqual({ n: 0 });
  });

  it("TC-F02-05 [AC-F02-03] [AC-F02-52] the link part and the passcode appear nowhere in the database", async () => {
    const { owner, workspaceId } = await team("secrets");
    const meeting = (await create(owner, workspaceId, { kind: "link" })).json<Created>();
    const linkPart = meeting.link.split("/m/").pop() ?? "";
    const dump = await t.database.db.execute(
      sql`select to_jsonb(m)::text as row from meetings m where id = ${meeting.id}`,
    );
    const text = JSON.stringify(dump.rows);
    expect(text).not.toContain(linkPart);
    expect(text).not.toContain(meeting.passcode);
    const [row] = await t.database.db.select().from(meetings).where(eq(meetings.id, meeting.id));
    expect(row?.keyVersion).toBe(1);
  });

  it("TC-F02-09 [AC-F02-05] the 51st meeting in an hour is refused with the wait; another person isn't affected", async () => {
    const { owner, others, workspaceId } = await team("limit", [["other", "member"]]);
    for (let made = 0; made < 50; made++)
      expect((await create(owner, workspaceId, { kind: "link" })).statusCode).toBe(201);
    const refused = await create(owner, workspaceId, { kind: "link" });
    expect(refused.statusCode).toBe(429);
    expect(errorCode(refused)).toBe("TOO_MANY_ATTEMPTS");
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    const [other] = others;
    if (!other) throw new Error("no other person");
    expect((await create(other, workspaceId, { kind: "link" })).statusCode).toBe(201);
  });

  it("TC-F02-12 [AC-F02-46] two creates with the same Idempotency-Key at the same moment make one meeting", async () => {
    const { owner, workspaceId } = await team("double");
    const [first, second] = await Promise.all([
      create(owner, workspaceId, { kind: "meet_now" }, "double-click-key-1"),
      create(owner, workspaceId, { kind: "meet_now" }, "double-click-key-1"),
    ]);
    expect(first?.json<Created>().id).toBe(second?.json<Created>().id);
    const count = await t.database.db.execute(
      sql`select count(*)::int as n from meetings where workspace_id = ${workspaceId}`,
    );
    expect(count.rows[0]).toEqual({ n: 1 });
  });

  it("TC-F02-102 [AC-F02-50] an outsider can't make a meeting in a workspace (404)", async () => {
    const { workspaceId } = await team("outsider-create");
    const outsider = await newPerson(t, "outsider-create-x");
    expect((await create(outsider, workspaceId, { kind: "meet_now" })).statusCode).toBe(404);
  });
});

describe("options and co-organizers", () => {
  it("TC-F02-07 [AC-F02-04] a change extends a link meeting's 60 days; a Meet now meeting keeps its expiry", async () => {
    const { owner, workspaceId } = await team("extend");
    const link = (await create(owner, workspaceId, { kind: "link" })).json<Created>();
    const meetNow = (await create(owner, workspaceId, { kind: "meet_now" })).json<Created>();
    const old = new Date(Date.now() - 59 * 24 * 3_600_000);
    await t.database.db
      .update(meetings)
      .set({ expiresAt: new Date(old.getTime() + MEETING_LIFETIME_MS) })
      .where(eq(meetings.workspaceId, workspaceId));
    const changedLink = await call(owner.token, "PATCH", `/api/v1/meetings/${link.id}/options`, { title: "Renamed" });
    expect(Date.parse(changedLink.json<Created>().expiresAt)).toBeGreaterThan(
      Date.now() + MEETING_LIFETIME_MS - 60_000,
    );
    const changedNow = await call(owner.token, "PATCH", `/api/v1/meetings/${meetNow.id}/options`, {
      lobbyBypass: "everyone",
    });
    expect(Date.parse(changedNow.json<Created>().expiresAt)).toBeLessThan(Date.now() + 2 * 24 * 3_600_000);
  });

  it("TC-F02-104 [AC-F02-36] [AC-F02-50] only the organizer names co-organizers, from the workspace; others get 404", async () => {
    const { owner, others, workspaceId } = await team("co", [
      ["co", "member"],
      ["member", "member"],
    ]);
    const [co, member] = others;
    if (!co || !member) throw new Error("people missing");
    const outsider = await newPerson(t, "co-outsider");
    const meeting = (await create(owner, workspaceId, { kind: "link" })).json<Created>();
    const url = `/api/v1/meetings/${meeting.id}/options`;
    expect((await call(owner.token, "PATCH", url, { coOrganizerIds: [outsider.id] })).statusCode).toBe(400);
    expect((await call(owner.token, "PATCH", url, { coOrganizerIds: [owner.id] })).statusCode).toBe(400);
    expect((await call(owner.token, "PATCH", url, { coOrganizerIds: [co.id] })).statusCode).toBe(200);
    // The co-organizer may change options, but not the co-organizers.
    expect((await call(co.token, "PATCH", url, { whoCanPresent: "organizers" })).statusCode).toBe(200);
    expect((await call(co.token, "PATCH", url, { coOrganizerIds: [co.id, member.id] })).statusCode).toBe(403);
    for (const who of [member, outsider]) {
      expect((await call(who.token, "GET", `/api/v1/meetings/${meeting.id}`)).statusCode).toBe(404);
      expect((await call(who.token, "PATCH", url, { title: "Taken over" })).statusCode).toBe(404);
    }
    const [row] = await t.database.db.select().from(meetings).where(eq(meetings.id, meeting.id));
    expect(row?.organizerId).toBe(owner.id);
    expect(row?.title).not.toBe("Taken over");
  });

  it("TC-F02-10 [AC-F02-06] a personal workspace's meeting can't have co-organizers; its user switches guests", async () => {
    const person = await newPerson(t, "personal");
    const [personal] = await t.database.db
      .insert(workspaces)
      .values({ name: "Personal", kind: "personal", createdBy: person.id })
      .returning({ id: workspaces.id });
    if (!personal) throw new Error("no personal workspace");
    await t.database.db.insert(workspaceMembers).values({ workspaceId: personal.id, userId: person.id, role: "owner" });
    const other = await newPerson(t, "personal-other");
    const meeting = (await create(person, personal.id, { kind: "meet_now" })).json<Created>();
    const named = await call(person.token, "PATCH", `/api/v1/meetings/${meeting.id}/options`, {
      coOrganizerIds: [other.id],
    });
    expect(named.statusCode).toBe(400);
    expect(
      (await call(person.token, "PATCH", `/api/v1/workspaces/${personal.id}/settings`, { allowGuests: false }))
        .statusCode,
    ).toBe(204);
    const [row] = await t.database.db
      .select({ allowGuests: workspaces.allowGuests })
      .from(workspaces)
      .where(eq(workspaces.id, personal.id));
    expect(row?.allowGuests).toBe(false);
  });

  it("TC-F02-82 [AC-F02-40] only the owner and admins switch guests off for a company workspace", async () => {
    const { owner, others, workspaceId } = await team("guests", [
      ["admin", "admin"],
      ["member", "member"],
    ]);
    const [admin, member] = others;
    if (!admin || !member) throw new Error("people missing");
    const url = `/api/v1/workspaces/${workspaceId}/settings`;
    expect((await call(member.token, "PATCH", url, { allowGuests: false })).statusCode).toBe(403);
    expect((await call(admin.token, "PATCH", url, { allowGuests: false })).statusCode).toBe(204);
    expect((await call(owner.token, "PATCH", url, { allowGuests: true })).statusCode).toBe(204);
    const [row] = await t.database.db
      .select({ allowGuests: workspaces.allowGuests })
      .from(workspaces)
      .where(and(eq(workspaces.id, workspaceId)));
    expect(row?.allowGuests).toBe(true);
  });
});
