// The real 30-second ring job on BullMQ (T-fix-9): the job the server starts, not a direct call to the
// rule, stops a ring nobody answered and tells the caller "No answer". Takes about 35 seconds.
import type { LineServerMessage } from "@meetapp/contracts";
import { calls } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { caller, namedPerson, seedWorkspace, type Call } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
let jobs: { close: () => Promise<void> };
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
  jobs = await t.accounts.startCallJobs();
}, 60_000);
afterAll(async () => {
  await jobs.close();
  await t.close();
}, 60_000);

const settle = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("the ring job", () => {
  it("T-fix-9 [AC-F15-08] about 30 s after a one-to-one call starts, the caller hears No answer and it ends", async () => {
    const [m1, m2] = [await namedPerson(t, "rj-0", "Person 1"), await namedPerson(t, "rj-1", "Person 2")];
    const workspaceId = await seedWorkspace(t, [
      [m1, "owner"],
      [m2, "member"],
    ]);
    const chat = await call(m1.token, "POST", `/api/v1/workspaces/${workspaceId}/conversations`, { userIds: [m2.id] });
    // The person rung is online too, as in the app.
    const rung = await t.app.injectWS("/api/v1/realtime", {
      headers: { origin: "app://meetapp", ...bearer(m2.token) },
    });
    const ws = await t.app.injectWS("/api/v1/realtime", { headers: { origin: "app://meetapp", ...bearer(m1.token) } });
    const got: LineServerMessage[] = [];
    ws.on("message", (data: Buffer) => got.push(JSON.parse(data.toString()) as LineServerMessage));
    const started = await call(m1.token, "POST", `/api/v1/conversations/${chat.json<{ id: string }>().id}/calls`, {
      media: "audio",
    });
    const callId = started.json<{ call: { callId: string } }>().call.callId;
    const startedAt = Date.now();
    let stop: LineServerMessage | undefined;
    while (!stop && Date.now() - startedAt < 34_000) {
      await settle(250);
      stop = got.find((m) => m.t === "ring_stop" && m.callId === callId);
    }
    expect(stop).toMatchObject({ t: "ring_stop", reason: "missed" });
    expect(Date.now() - startedAt).toBeLessThan(33_000);
    const [row] = await t.database.db.select().from(calls).where(eq(calls.id, callId));
    expect(row?.endedAt).not.toBeNull();
    ws.terminate();
    rung.terminate();
  }, 60_000);
});
