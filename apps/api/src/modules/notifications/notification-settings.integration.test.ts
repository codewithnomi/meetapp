// Settings → Notifications on the server (F04 design 5; AC-F04-36): defaults, partial changes that follow
// the account, refused input, only one's own row, and the rate limit.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { issueSession } from "../../plugins/auth.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { caller, newPerson, type Call } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

const URL = "/api/v1/me/notification-settings";
const ALL_ON = { messages: true, mentions: true, lobby: true, sound: true, preview: true };

describe("notification settings", { timeout: 60_000 }, () => {
  it("TC-F04-65 [AC-F04-36] all on by default; partial changes keep the rest and follow the account", async () => {
    const a = await newPerson(t, "n65");
    expect((await call(a.token, "GET", URL)).json()).toEqual(ALL_ON);
    expect((await call(a.token, "PUT", URL, { sound: false })).json()).toEqual({ ...ALL_ON, sound: false });
    const several = await call(a.token, "PUT", URL, { messages: false, preview: false });
    expect(several.json()).toEqual({ ...ALL_ON, sound: false, messages: false, preview: false });
    // Another sign-in of the same account sees the same choices.
    const second = await issueSession(t.auth, a.id);
    expect((await call(second, "GET", URL)).json()).toEqual({
      ...ALL_ON,
      sound: false,
      messages: false,
      preview: false,
    });
  });

  it("TC-F04-66 [AC-F04-36] bad input gets 400, signed out 401, others untouched, 429 after 20 a minute", async () => {
    const a = await newPerson(t, "n66a");
    const b = await newPerson(t, "n66b");
    for (const body of [{}, { loud: true }, { sound: "no" }, { sound: 0 }, { sound: false, userId: b.id }]) {
      expect((await call(a.token, "PUT", URL, body)).statusCode, JSON.stringify(body)).toBe(400);
    }
    expect((await call("", "GET", URL)).statusCode).toBe(401);
    expect((await call("", "PUT", URL, { sound: false })).statusCode).toBe(401);
    expect((await call(a.token, "PUT", `${URL}?userId=${b.id}`, { lobby: false })).statusCode).toBe(200);
    expect((await call(b.token, "GET", URL)).json()).toEqual(ALL_ON);
    const codes = [];
    for (let i = 0; i < 20; i++) codes.push((await call(a.token, "PUT", URL, { lobby: i % 2 === 0 })).statusCode);
    expect(codes.filter((code) => code === 200)).toHaveLength(19);
    const limited = await call(a.token, "PUT", URL, { lobby: true });
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
  });
});
