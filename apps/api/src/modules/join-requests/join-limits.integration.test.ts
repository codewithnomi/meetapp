// Attempt limits on the join routes, the invitation page and the desktop hand-off (F01 T13; S8).
// Own database and own Redis counter key; needs the `pnpm dev` services.
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bearer, startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { newPerson } from "../../test-support/workspaces-setup.ts";

const SLOW = { timeout: 120_000 };
let t: AuthTestApp;

beforeAll(async () => {
  t = await startAuthTestApp({ providers: ["google"] });
}, 60_000);

afterAll(async () => {
  await t.close();
}, 60_000);

const origin = { origin: "app://meetapp" };
const join = (token: string, address: string, kind: "lookup" | "request", linkOrCode: string) =>
  t.app.inject({
    method: "POST",
    url: `/api/v1/join/${kind}`,
    payload: { linkOrCode },
    headers: { ...origin, ...bearer(token) },
    remoteAddress: address,
  });
const wrongCode = () => randomBytes(8).toString("hex").toUpperCase();

describe("limits", () => {
  it("TC-F01-36 [AC-F01-19] [S8] the 21st join call by one person is 429, wrong codes included", SLOW, async () => {
    const person = await newPerson(t, "guesser");
    for (let attempt = 1; attempt <= 20; attempt++) {
      const kind = attempt % 2 === 0 ? "lookup" : "request";
      expect((await join(person.token, "10.0.0.7", kind, wrongCode())).statusCode).toBe(404);
    }
    const blocked = await join(person.token, "10.0.0.7", "lookup", wrongCode());
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ error: { code: string } }>().error.code).toBe("TOO_MANY_ATTEMPTS");
    const another = await newPerson(t, "other-person");
    expect((await join(another.token, "10.0.0.8", "lookup", wrongCode())).statusCode).toBe(404);
  });

  it("TC-F01-36 [AC-F01-19] [S8] the 61st join call from one address is 429, whoever asks", SLOW, async () => {
    const people = [await newPerson(t, "a"), await newPerson(t, "b"), await newPerson(t, "c"), await newPerson(t, "d")];
    for (let attempt = 0; attempt < 60; attempt++) {
      const person = people[attempt % people.length];
      expect((await join(person?.token ?? "", "10.0.0.9", "lookup", wrongCode())).statusCode).toBe(404);
    }
    const blocked = await join(people[0]?.token ?? "", "10.0.0.9", "lookup", wrongCode());
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json<{ error: { code: string } }>().error.code).toBe("TOO_MANY_ATTEMPTS");
  });

  it("TC-F01-36 [AC-F01-18] [S8] the 61st invitation page view from one address is 429", SLOW, async () => {
    const view = () =>
      t.app.inject({ url: `/invite/${randomBytes(24).toString("base64url")}`, remoteAddress: "10.0.0.10" });
    for (let attempt = 0; attempt < 60; attempt++) expect((await view()).statusCode).toBe(404);
    const blocked = await view();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.body).toMatch(/too many attempts/i);
  });

  it("TC-F01-36 [AC-F01-07] [S8] the 21st desktop hand-off start from one address is 429", SLOW, async () => {
    const start = () =>
      t.app.inject({
        method: "POST",
        url: "/api/v1/auth/desktop/init",
        payload: { provider: "google", challenge: randomBytes(32).toString("hex") },
        remoteAddress: "10.0.0.11",
      });
    for (let attempt = 0; attempt < 20; attempt++) expect((await start()).statusCode).toBe(200);
    expect((await start()).statusCode).toBe(429);
  });
});
