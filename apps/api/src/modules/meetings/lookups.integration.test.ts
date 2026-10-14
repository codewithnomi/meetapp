// Finding a meeting by link, or by ID and passcode (F02 T4; design.md section 3.2; AC-F02-04, 07, 08,
// 48). Own database; needs the `pnpm dev` services. Each test uses its own network addresses, so the
// per-address limits of one test don't touch another.
import { meetings, workspaceMembers } from "@meetapp/db";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { errorCode, newPerson, seedWorkspace, type Person } from "../../test-support/workspaces-setup.ts";
import { LOOKUP_MIN_MS } from "./lookup.service.ts";

let t: AuthTestApp;
beforeAll(async () => {
  t = await startAuthTestApp();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

interface Meeting {
  id: string;
  link: string;
  meetingNumber: string;
  passcode: string;
}

let addressCounter = 0;
const newAddress = () => `10.4.${String(Math.floor(addressCounter / 250))}.${String((addressCounter++ % 250) + 1)}`;

function find(body: object, options: { who?: Person; address?: string } = {}) {
  return t.app.inject({
    method: "POST",
    url: "/api/v1/meeting-lookups",
    payload: body,
    remoteAddress: options.address ?? newAddress(),
    headers: { origin: "app://meetapp", ...(options.who ? { authorization: `Bearer ${options.who.token}` } : {}) },
  });
}

async function organizerWithMeetings(label: string, count = 1) {
  const owner = await newPerson(t, `${label}-owner`);
  const workspaceId = await seedWorkspace(t, [[owner, "owner"]]);
  const made: Meeting[] = [];
  for (let i = 0; i < count; i++) {
    const response = await t.app.inject({
      method: "POST",
      url: `/api/v1/workspaces/${workspaceId}/meetings`,
      payload: { kind: "link", title: `${label} ${String(i)}` },
      headers: { origin: "app://meetapp", authorization: `Bearer ${owner.token}` },
    });
    made.push(response.json<Meeting>());
  }
  return { owner, workspaceId, made };
}

/**
 * The limits count per clock minute. A test that sends its tries in the last seconds of a minute would
 * see the count start again halfway, so it waits for a fresh minute first and sends tries side by side.
 */
async function freshMinute(): Promise<void> {
  const intoMinute = Date.now() % 60_000;
  if (intoMinute > 40_000) await new Promise((done) => setTimeout(done, 60_000 - intoMinute + 200));
}
const times = <T>(count: number, make: (i: number) => Promise<T>) =>
  Promise.all(Array.from({ length: count }, (_, i) => make(i)));

const otherDigits = (number: string) => (number.startsWith("9") ? `1${number.slice(1)}` : `9${number.slice(1)}`);

describe("finding a meeting", () => {
  it("TC-F02-04 [AC-F02-03] [AC-F02-08] a link, or its ID and passcode, lead to that meeting only", async () => {
    const { made } = await organizerWithMeetings("only", 2);
    const [a, b] = made;
    if (!a || !b) throw new Error("meetings missing");
    expect((await find({ link: a.link })).json<{ title: string }>().title).toBe("only 0");
    expect((await find({ meetingNumber: a.meetingNumber, passcode: a.passcode })).json<{ title: string }>().title).toBe(
      "only 0",
    );
    for (const mixed of [
      { meetingNumber: a.meetingNumber, passcode: b.passcode },
      { meetingNumber: b.meetingNumber, passcode: a.passcode },
    ]) {
      const answer = await find(mixed);
      expect(answer.statusCode).toBe(404);
      expect(errorCode(answer)).toBe("MEETING_NOT_FOUND");
    }
  });

  it("TC-F02-15 [AC-F02-08] [AC-F02-14] [AC-F02-50] only the title, the caller's group and a token", async () => {
    const { owner, workspaceId, made } = await organizerWithMeetings("groups");
    const [meeting] = made;
    if (!meeting) throw new Error("meeting missing");
    const member = await newPerson(t, "groups-member");
    await t.database.db.insert(workspaceMembers).values({ workspaceId, userId: member.id, role: "member" });
    const external = await newPerson(t, "groups-external");
    for (const [who, group] of [
      [owner, "member"],
      [member, "member"],
      [external, "external"],
      [undefined, "guest"],
    ] as const) {
      const answer = await find({ link: meeting.link }, who ? { who } : {});
      expect(answer.statusCode).toBe(200);
      const body = answer.json<Record<string, unknown>>();
      expect(Object.keys(body).sort()).toEqual(["group", "lookupToken", "title"]);
      expect(body["group"]).toBe(group);
    }
  });

  it("TC-F02-16 [AC-F02-08] [AC-F02-48] every miss gives the same answer", async () => {
    const { made } = await organizerWithMeetings("misses");
    const [meeting] = made;
    if (!meeting) throw new Error("meeting missing");
    const misses = [
      { link: `${meeting.link.slice(0, -2)}xx` },
      { link: "not a link at all" },
      { meetingNumber: otherDigits(meeting.meetingNumber), passcode: meeting.passcode },
      { meetingNumber: meeting.meetingNumber, passcode: "zzzzzz" },
      { meetingNumber: "12", passcode: meeting.passcode },
      { meetingNumber: "", passcode: "" },
      {},
    ];
    const bodies = [];
    for (const miss of misses) {
      const answer = await find(miss);
      expect(answer.statusCode, JSON.stringify(miss)).toBe(404);
      const { error } = answer.json<{ error: { code: string; message: string } }>();
      bodies.push({ code: error.code, message: error.message });
    }
    expect(new Set(bodies.map((body) => JSON.stringify(body))).size).toBe(1);
    expect(bodies[0]?.code).toBe("MEETING_NOT_FOUND");
  });

  it(
    "TC-F02-17 [AC-F02-48] hits and misses take the same time; never under the minimum",
    { timeout: 60_000 },
    async () => {
      const { made } = await organizerWithMeetings("timing");
      const [meeting] = made;
      if (!meeting) throw new Error("meeting missing");
      const timed = async (body: object) => {
        const started = performance.now();
        await find(body);
        return performance.now() - started;
      };
      const median = (values: number[]) => [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)] ?? 0;
      const hits: number[] = [];
      const misses: number[] = [];
      for (let i = 0; i < 30; i++) {
        hits.push(await timed({ meetingNumber: meeting.meetingNumber, passcode: meeting.passcode }));
        misses.push(await timed({ meetingNumber: otherDigits(meeting.meetingNumber), passcode: "Zz23ab" }));
      }
      for (const miss of misses) expect(miss).toBeGreaterThanOrEqual(LOOKUP_MIN_MS - 5);
      expect(Math.abs(median(hits) - median(misses))).toBeLessThan(60);
    },
  );
});

describe("expired meetings", () => {
  it("TC-F02-08 [AC-F02-04] [AC-F02-48] only the right secret learns that a meeting expired", async () => {
    const { made } = await organizerWithMeetings("expired");
    const [meeting] = made;
    if (!meeting) throw new Error("meeting missing");
    await t.database.db
      .update(meetings)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(meetings.id, meeting.id));
    for (const right of [
      { link: meeting.link },
      { meetingNumber: meeting.meetingNumber, passcode: meeting.passcode },
    ]) {
      const answer = await find(right);
      expect(answer.statusCode).toBe(410);
      expect(errorCode(answer)).toBe("MEETING_EXPIRED");
    }
    for (const wrong of [
      { meetingNumber: meeting.meetingNumber, passcode: "zzzzzz" },
      { meetingNumber: otherDigits(meeting.meetingNumber), passcode: meeting.passcode },
    ]) {
      expect(errorCode(await find(wrong))).toBe("MEETING_NOT_FOUND");
    }
  });

  it("TC-F02-11 [AC-F02-07] when the organizer leaves the workspace, the meeting counts as expired", async () => {
    const { owner, workspaceId, made } = await organizerWithMeetings("gone");
    const [meeting] = made;
    if (!meeting) throw new Error("meeting missing");
    await t.database.db
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, owner.id)));
    expect(errorCode(await find({ link: meeting.link }))).toBe("MEETING_EXPIRED");
    expect(errorCode(await find({ meetingNumber: meeting.meetingNumber, passcode: "zzzzzz" }))).toBe(
      "MEETING_NOT_FOUND",
    );
  });
});

describe("limits on wrong tries", () => {
  it(
    "TC-F02-93 [AC-F02-48] 20 wrong tries a minute per person and per address; a hit gives its try back",
    { timeout: 60_000 },
    async () => {
      const { made } = await organizerWithMeetings("limits");
      const [meeting] = made;
      if (!meeting) throw new Error("meeting missing");
      const wrong = () => ({ link: `https://x.test/m/${Math.random().toString(36).slice(2)}` });
      await freshMinute();
      // One signed-in person, from many addresses.
      const person = await newPerson(t, "limits-person");
      await times(19, () => find(wrong(), { who: person }));
      expect((await find({ link: meeting.link }, { who: person })).statusCode).toBe(200);
      expect((await find(wrong(), { who: person })).statusCode).toBe(404);
      expect(errorCode(await find(wrong(), { who: person }))).toBe("TOO_MANY_ATTEMPTS");
      // One app (guest device key), and one address shared by many guests.
      const deviceKey = "k".repeat(43);
      await times(20, () => find({ ...wrong(), deviceKey }));
      expect(errorCode(await find({ ...wrong(), deviceKey }))).toBe("TOO_MANY_ATTEMPTS");
      const address = newAddress();
      await times(20, (i) =>
        find({ ...wrong(), deviceKey: `${String(i).padStart(2, "0")}${"d".repeat(41)}` }, { address }),
      );
      const refused = await find({ link: meeting.link, deviceKey: "e".repeat(43) }, { address });
      expect(errorCode(refused)).toBe("TOO_MANY_ATTEMPTS");
      expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    },
  );

  it(
    "TC-F02-94 [AC-F02-48] 20 wrong passcodes for one meeting ID make that ID wait; unknown IDs alike; the link still works",
    { timeout: 60_000 },
    async () => {
      const { made } = await organizerWithMeetings("lockout");
      const [meeting] = made;
      if (!meeting) throw new Error("meeting missing");
      const unknown = otherDigits(meeting.meetingNumber);
      await freshMinute();
      for (const number of [meeting.meetingNumber, unknown]) {
        await times(20, (i) => find({ meetingNumber: number, passcode: `w${String(i).padStart(5, "0")}` }));
      }
      const real = await find({ meetingNumber: meeting.meetingNumber, passcode: meeting.passcode });
      const fake = await find({ meetingNumber: unknown, passcode: meeting.passcode });
      expect(real.statusCode).toBe(429);
      expect(real.json<{ error: { message: string } }>().error.message).toBe(
        fake.json<{ error: { message: string } }>().error.message,
      );
      expect(real.json<{ error: { message: string } }>().error.message).toContain("use the link");
      expect((await find({ link: meeting.link })).statusCode).toBe(200);
    },
  );
});
