// The ringtone setting (F15 TC-F15-52; AC-F15-32): ringtone 1–5 and its volume 0–100, kept with the
// account next to F14's read receipts; anything else is refused and changes nothing.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { caller, namedPerson, type Call, type Person } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

type Prefs = { readReceipts: boolean; ringtone: number; ringVolume: number };
const prefsOf = async (p: Person) => (await call(p.token, "GET", "/api/v1/me/settings")).json<Prefs>();
const change = (p: Person, body: object) => call(p.token, "PATCH", "/api/v1/me/settings", body);

describe("ringtone setting", { timeout: 60_000 }, () => {
  it("TC-F15-52 [AC-F15-32] defaults, saving, refusing bad values, and each person's own", async () => {
    const [m1, m2] = await Promise.all([namedPerson(t, "rt-1", "One"), namedPerson(t, "rt-2", "Two")]);
    expect(await prefsOf(m1)).toEqual({ readReceipts: true, ringtone: 1, ringVolume: 70 });

    expect((await change(m1, { ringtone: 3, ringVolume: 40 })).statusCode).toBe(204);
    expect(await prefsOf(m1)).toEqual({ readReceipts: true, ringtone: 3, ringVolume: 40 });

    for (const bad of [
      { ringtone: 0 },
      { ringtone: 6 },
      { ringVolume: -1 },
      { ringVolume: 101 },
      { ringtone: "loud" },
      { ringtone: 2.5 },
      { ringtone: 2, extra: true },
    ]) {
      expect((await change(m1, bad)).statusCode, JSON.stringify(bad)).toBe(400);
    }
    expect(await prefsOf(m1)).toEqual({ readReceipts: true, ringtone: 3, ringVolume: 40 });

    // Read receipts (F14) still change on their own, and the ringtone stays.
    expect((await change(m1, { readReceipts: false })).statusCode).toBe(204);
    expect(await prefsOf(m1)).toEqual({ readReceipts: false, ringtone: 3, ringVolume: 40 });
    // The other person is untouched.
    expect(await prefsOf(m2)).toEqual({ readReceipts: true, ringtone: 1, ringVolume: 70 });
    expect((await call("", "GET", "/api/v1/me/settings")).statusCode).toBe(401);
  });
});
