// Statuses set by hand (F04 design 3.3, 5; AC-F04-20, 21): setting and resetting, others seeing it on the
// live line, running out (with the job, and without it), refused input, only one's own status, and the
// rate limit.
import type { LineServerMessage } from "@meetapp/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { caller, namedPerson, seedWorkspace, type Call, type Person } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
  // Opening a live line doesn't wait for the server to be ready, as other requests do.
  await t.app.ready();
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const inMinutes = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString();

async function openLine(person: Person) {
  const ws = await t.app.injectWS("/api/v1/realtime", {
    headers: { origin: "app://meetapp", ...bearer(person.token) },
  });
  const got: LineServerMessage[] = [];
  ws.on("message", (data: Buffer) => got.push(JSON.parse(data.toString()) as LineServerMessage));
  await wait(300);
  return { ws, got };
}

/** Waits up to `ms` for a `status` message about `userId` with `status`. */
async function sees(got: LineServerMessage[], userId: string, status: string, ms = 5_000) {
  const end = Date.now() + ms;
  while (!got.some((m) => m.t === "status" && m.userId === userId && m.status === status)) {
    if (Date.now() > end) throw new Error(`no ${status} for ${userId}`);
    await wait(50);
  }
}

async function pair(label: string) {
  const a = await namedPerson(t, `${label}-a`, "Person A");
  const b = await namedPerson(t, `${label}-b`, "Person B");
  await seedWorkspace(t, [
    [a, "owner"],
    [b, "member"],
  ]);
  return { a, b };
}

const setStatus = (person: Person, body: object) => call(person.token, "PUT", "/api/v1/me/status", body);
const stored = async (person: Person) =>
  (
    await t.database.db.execute<{ manual_status: string | null; manual_status_until: Date | null }>(
      sql`select manual_status, manual_status_until from "user" where id = ${person.id}`,
    )
  ).rows[0];
const statusAs = async (viewer: Person, target: Person) =>
  (await call(viewer.token, "GET", `/api/v1/people/status?ids=${target.id}`)).json<{ statuses: { status: string }[] }>()
    .statuses[0]?.status;

describe("status set by hand", { timeout: 60_000 }, () => {
  it("TC-F04-35 TC-F04-36 [AC-F04-20] each status is stored, others see it within 5 s; Reset clears it", async () => {
    const { a, b } = await pair("t35");
    const aLine = await openLine(a);
    const bLine = await openLine(b);
    for (const status of ["busy", "dnd", "brb", "away", "available"] as const) {
      const answer = await setStatus(a, { status, until: null });
      expect(answer.statusCode).toBe(200);
      expect(answer.json()).toEqual({ status, until: null });
      expect(await stored(a)).toEqual({ manual_status: status, manual_status_until: null });
      if (status !== "available") await sees(bLine.got, a.id, status);
      expect(await statusAs(b, a)).toBe(status);
    }
    const until = inMinutes(30);
    expect((await setStatus(a, { status: "busy", until })).json()).toEqual({ status: "busy", until });
    await sees(bLine.got, a.id, "busy");
    const reset = await setStatus(a, { status: null, until: null });
    expect(reset.json()).toEqual({ status: "available", until: null });
    expect(await stored(a)).toEqual({ manual_status: null, manual_status_until: null });
    await sees(bLine.got, a.id, "available");
    aLine.ws.terminate();
    bLine.ws.terminate();
  });

  it("TC-F04-39 [AC-F04-21] the job clears a status when it runs out and announces it", async () => {
    const { a, b } = await pair("t39");
    const jobs = await t.accounts.startCallJobs();
    try {
      const aLine = await openLine(a);
      const bLine = await openLine(b);
      await setStatus(a, { status: "dnd", until: new Date(Date.now() + 1_500).toISOString() });
      await sees(bLine.got, a.id, "dnd");
      await sees(bLine.got, a.id, "available", 8_000);
      expect(await stored(a)).toEqual({ manual_status: null, manual_status_until: null });
      aLine.ws.terminate();
      bLine.ws.terminate();
    } finally {
      await jobs.close();
    }
  });

  it("TC-F04-40 [AC-F04-21] a run-out status is never shown, even with no job", async () => {
    const { a, b } = await pair("t40");
    const aLine = await openLine(a);
    await setStatus(a, { status: "busy", until: null });
    await t.database.db.execute(
      sql`update "user" set manual_status_until = now() - interval '1 minute' where id = ${a.id}`,
    );
    expect(await statusAs(b, a)).toBe("available");
    aLine.ws.terminate();
  });

  it("TC-F04-41 [AC-F04-20, AC-F04-21] bad input gets 400 and changes nothing", async () => {
    const { a } = await pair("t41");
    await setStatus(a, { status: "brb", until: null });
    const bad = [
      { status: "lunch", until: null },
      { status: "busy", until: inMinutes(-1) },
      { status: "busy", until: inMinutes(8 * 24 * 60 + 5) },
      { status: "busy", until: "tomorrow" },
      { status: "busy", until: 123 },
      { status: "busy", until: null, userId: a.id },
      { status: null, until: inMinutes(30) },
      { status: "busy" },
    ];
    for (const body of bad) expect((await setStatus(a, body)).statusCode, JSON.stringify(body)).toBe(400);
    expect(await stored(a)).toEqual({ manual_status: "brb", manual_status_until: null });
  });

  it("TC-F04-92 [AC-F04-20] only the signed-in person's status changes; 401 signed out; 429 after 20 a minute", async () => {
    const { a, b } = await pair("t92");
    expect((await call("", "PUT", "/api/v1/me/status", { status: "busy", until: null })).statusCode).toBe(401);
    expect(
      (await call(a.token, "PUT", `/api/v1/me/status?userId=${b.id}`, { status: "busy", until: null })).statusCode,
    ).toBe(200);
    expect(await stored(b)).toEqual({ manual_status: null, manual_status_until: null });
    const answers = [];
    for (let i = 0; i < 24; i++) answers.push((await setStatus(a, { status: "busy", until: null })).statusCode);
    expect(answers.filter((code) => code === 200)).toHaveLength(19);
    const limited = await setStatus(a, { status: "busy", until: null });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
  });
});
