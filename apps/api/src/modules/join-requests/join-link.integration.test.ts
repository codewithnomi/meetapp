// Managing the join link and code, and the secrecy of lookups (F01 T13; AC-F01-19, S8). Own database;
// needs the `pnpm dev` services.
import { workspaces } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { CODE_FORMAT, lookup, replaceLink, turnOff, turnOn } from "../../test-support/join-setup.ts";
import { caller, errorCode, newPerson, seedWorkspace, type Call } from "../../test-support/workspaces-setup.ts";

const SLOW = { timeout: 90_000 };
let t: AuthTestApp;
let call: Call;

beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
}, 60_000);

afterAll(async () => {
  await t.close();
}, 60_000);

async function setup() {
  const owner = await newPerson(t, "owner");
  const admin = await newPerson(t, "admin");
  const member = await newPerson(t, "member");
  const outsider = await newPerson(t, "outsider");
  const workspaceId = await seedWorkspace(t, [
    [owner, "owner"],
    [admin, "admin"],
    [member, "member"],
  ]);
  return { owner, admin, member, outsider, workspaceId };
}

const joinPath = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/join-link`;
const tokenOf = (link: string | null) => (link ?? "").split("/join/")[1] ?? "";

describe("managing the link", () => {
  it("TC-F01-49 [AC-F01-19] a member cannot turn it on or replace it; an admin can", SLOW, async () => {
    const { admin, member, workspaceId } = await setup();
    const turnOnByMember = await call(member.token, "PUT", joinPath(workspaceId), { enabled: true });
    expect(turnOnByMember.statusCode).toBe(403);
    const replaceByMember = await call(member.token, "POST", `${joinPath(workspaceId)}/replace`);
    expect(replaceByMember.statusCode).toBe(403);
    const on = await turnOn(call, admin, workspaceId);
    expect(on.enabled).toBe(true);
    expect(on.link).toContain("/join/");
    expect(on.code).toMatch(CODE_FORMAT);
  });

  it("TC-F01-49 [AC-F01-19] a member can read it while on; both are empty when off", SLOW, async () => {
    const { owner, member, workspaceId } = await setup();
    const before = await call(member.token, "GET", joinPath(workspaceId));
    expect(before.json()).toEqual({ enabled: false, link: null, code: null });
    const on = await turnOn(call, owner, workspaceId);
    const read = await call(member.token, "GET", joinPath(workspaceId));
    expect(read.json()).toEqual(on);
    expect((await turnOn(call, owner, workspaceId)).code).toBe(on.code);
    expect((await turnOff(call, owner, workspaceId)).statusCode).toBe(200);
    const after = await call(member.token, "GET", joinPath(workspaceId));
    expect(after.json()).toEqual({ enabled: false, link: null, code: null });
  });

  it("TC-F01-49 [AC-F01-19] replacing stops the old link and code at once; the new ones work", SLOW, async () => {
    const { owner, outsider, workspaceId } = await setup();
    const old = await turnOn(call, owner, workspaceId);
    const fresh = await replaceLink(call, owner, workspaceId);
    expect(fresh.code).not.toBe(old.code);
    expect((await lookup(call, outsider, old.link ?? "")).statusCode).toBe(404);
    expect((await lookup(call, outsider, old.code ?? "")).statusCode).toBe(404);
    expect((await lookup(call, outsider, fresh.link ?? "")).statusCode).toBe(200);
    expect((await lookup(call, outsider, fresh.code ?? "")).statusCode).toBe(200);
  });

  it("TC-F01-49 [AC-F01-19] switching off stops both at once", SLOW, async () => {
    const { owner, outsider, workspaceId } = await setup();
    const on = await turnOn(call, owner, workspaceId);
    await turnOff(call, owner, workspaceId);
    expect((await lookup(call, outsider, on.link ?? "")).statusCode).toBe(404);
    expect((await lookup(call, outsider, on.code ?? "")).statusCode).toBe(404);
  });

  it("TC-F01-49 [AC-F01-19] a non-member gets 404 on the link routes", SLOW, async () => {
    const { outsider, workspaceId } = await setup();
    expect((await call(outsider.token, "GET", joinPath(workspaceId))).statusCode).toBe(404);
    expect((await call(outsider.token, "PUT", joinPath(workspaceId), { enabled: true })).statusCode).toBe(404);
  });
});

describe("a wrong link or code looks the same as any other", () => {
  it("TC-F01-78 [AC-F01-19] [S8] wrong, replaced, switched-off and id secrets give identical 404s", SLOW, async () => {
    const { owner, outsider, workspaceId } = await setup();
    const old = await turnOn(call, owner, workspaceId);
    const replaced = await replaceLink(call, owner, workspaceId);
    const other = await setup();
    const off = await turnOn(call, other.owner, other.workspaceId);
    await turnOff(call, other.owner, other.workspaceId);
    const wrong = [
      randomBytes(24).toString("base64url"),
      "ABCDEFGH23",
      old.link ?? "",
      old.code ?? "",
      off.link ?? "",
      off.code ?? "",
      workspaceId,
      `https://x.test/join/${workspaceId}`,
    ];
    const bodies = [];
    for (const typed of wrong) {
      const response = await lookup(call, outsider, typed);
      expect(response.statusCode).toBe(404);
      expect(errorCode(response)).toBe("NOT_FOUND");
      const { code, message } = response.json<{ error: { code: string; message: string } }>().error;
      bodies.push(JSON.stringify({ code, message }));
    }
    expect(new Set(bodies).size).toBe(1);
    const right = await lookup(call, outsider, replaced.link ?? "");
    expect(Object.keys(right.json()).sort()).toEqual(["alreadyMember", "memberCount", "name"]);
  });

  it("TC-F01-78 [AC-F01-19] [S8] the code works typed in lower case with spaces and dashes", SLOW, async () => {
    const { owner, outsider, workspaceId } = await setup();
    const on = await turnOn(call, owner, workspaceId);
    const code = (on.code ?? "").toLowerCase();
    const typed = ` ${code.slice(0, 5)}-${code.slice(5, 8)} ${code.slice(8)} `;
    expect((await lookup(call, outsider, typed)).statusCode).toBe(200);
    expect((await lookup(call, outsider, tokenOf(on.link))).statusCode).toBe(200);
  });

  it("TC-F01-78 [S8] the database holds only an encrypted secret and keyed 64-hex hashes", SLOW, async () => {
    const { owner, workspaceId } = await setup();
    const on = await turnOn(call, owner, workspaceId);
    const [row] = await t.database.db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    const stored = row?.joinSecretEnc ?? "";
    expect(stored.length).toBeGreaterThan(0);
    expect(stored).not.toContain(on.code);
    expect(stored).not.toContain(tokenOf(on.link));
    expect(stored).not.toContain("/join/");
    for (const hash of [row?.joinLinkHmac, row?.joinLookupHmac]) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).not.toBe(on.code);
      expect(hash).not.toBe(tokenOf(on.link));
    }
    expect(row?.joinLinkHmac).not.toBe(row?.joinLookupHmac);
    await turnOff(call, owner, workspaceId);
    const [off] = await t.database.db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
    expect(off?.joinSecretEnc).toBeNull();
    expect(off?.joinLinkHmac).toBeNull();
  });
});
