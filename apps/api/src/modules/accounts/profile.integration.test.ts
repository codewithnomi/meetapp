// Name and saved look (TC-F01-63, 69; AC-F01-25, 26), and what /me now tells the app: the photo
// address, the ways to sign in and the support email. Needs the `pnpm dev` services.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { caller, errorCode, newPerson, type Call } from "../../test-support/workspaces-setup.ts";

let t: AuthTestApp;
let call: Call;
beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);
afterAll(async () => {
  await t.close();
}, 60_000);

interface Me {
  user: {
    name: string;
    email: string;
    theme: string | null;
    accent: string | null;
    photoUrl: string | null;
    signInMethods: string[];
  };
  supportEmail: string;
}
const me = async (token: string) => (await call(token, "GET", "/api/v1/me")).json<Me>();

describe("display name", () => {
  it("TC-F01-63 [AC-F01-25] empty, spaces only and 61 characters are refused; 1 and 60 are saved trimmed", async () => {
    const person = await newPerson(t, "name");
    for (const name of ["", "    ", "x".repeat(61)]) {
      const refused = await call(person.token, "PATCH", "/api/v1/me", { name });
      expect(refused.statusCode).toBe(400);
      expect(errorCode(refused)).toBe("BAD_REQUEST");
    }
    expect((await call(person.token, "PATCH", "/api/v1/me", { name: "  Q  " })).statusCode).toBe(204);
    expect((await me(person.token)).user.name).toBe("Q");
    const sixty = "y".repeat(60);
    expect((await call(person.token, "PATCH", "/api/v1/me", { name: ` ${sixty} ` })).statusCode).toBe(204);
    expect((await me(person.token)).user.name).toBe(sixty);
  });

  it("TC-F01-63 [AC-F01-25] PATCH /me changes only the caller's name and ignores other fields", async () => {
    const [person, other] = await Promise.all([newPerson(t, "self"), newPerson(t, "other")]);
    const before = await me(person.token);
    const answer = await call(person.token, "PATCH", "/api/v1/me", {
      name: "Renamed",
      email: "taken@example.test",
      termsVersion: "0",
      avatarKey: "x",
      id: other.id,
    });
    expect(answer.statusCode).toBe(204);
    const after = await me(person.token);
    expect(after.user).toMatchObject({ name: "Renamed", email: before.user.email, photoUrl: null });
    expect((await me(other.token)).user.name).not.toBe("Renamed");
  });
});

describe("saved look and what /me tells the app", () => {
  it("TC-F01-69 [AC-F01-26] theme and accent are saved to the account; either alone works; a bad value is 400", async () => {
    const person = await newPerson(t, "look");
    const path = "/api/v1/me/preferences";
    expect((await call(person.token, "PATCH", path, { theme: "dark", accent: "green" })).statusCode).toBe(204);
    expect((await me(person.token)).user).toMatchObject({ theme: "dark", accent: "green" });
    expect((await call(person.token, "PATCH", path, { accent: "purple" })).statusCode).toBe(204);
    expect((await me(person.token)).user).toMatchObject({ theme: "dark", accent: "purple" });
    expect((await call(person.token, "PATCH", path, { theme: "neon" })).statusCode).toBe(400);
    expect((await call(person.token, "PATCH", path, { accent: "rainbow" })).statusCode).toBe(400);
    expect((await me(person.token)).user).toMatchObject({ theme: "dark", accent: "purple" });
  });

  it("TC-F01-63 [AC-F01-10, AC-F01-25] /me gives the ways to sign in and the support email", async () => {
    const person = await newPerson(t, "methods");
    const body = await me(person.token);
    expect(body.user.signInMethods).toEqual(["password"]);
    expect(body.supportEmail).toMatch(/@/);
  });

  it("TC-F01-63 [AC-F01-25] signed out, the profile can't be changed", async () => {
    const answer = await t.app.inject({ method: "PATCH", url: "/api/v1/me", payload: { name: "Nobody" } });
    expect(answer.statusCode).toBe(401);
  });
});
