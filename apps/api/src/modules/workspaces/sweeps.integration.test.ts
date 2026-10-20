// The workspace security sweeps. TC-F01-77 (AC-F01-31): an outsider and a removed person get, on every
// route with :workspaceId (read from the server), the same 404 as for a workspace that doesn't exist,
// with real ids, ids from W and ids of their own objects, and nothing changes. TC-F01-79 (AC-F01-32): a
// plain member gets 403 for every owner/admin action, an admin for every owner-only action, and nothing
// changes. Own database; needs the `pnpm dev` services.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listRoutes } from "../../app.ts";
import { startAuthTestApp, type AuthTestApp } from "../../test-support/auth-app.ts";
import { buildScene, snapshot, type Scene } from "../../test-support/sweep-setup.ts";
import { caller, errorCode, type Call, type Person } from "../../test-support/workspaces-setup.ts";

const SLOW = { timeout: 120_000 };
const NOWHERE = "00000000-0000-4000-8000-00000000dead";
let t: AuthTestApp;
let call: Call;
let scene: Scene;

beforeAll(async () => {
  t = await startAuthTestApp();
  call = caller(t);
  scene = await buildScene(t, call);
}, 90_000);
afterAll(async () => {
  await t.close();
}, 60_000);

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
const withoutRequestId = (body: string) => body.replace(/"requestId":"[^"]*"/, "");

/** The address with W (or another workspace) and the given object ids filled in. */
function fill(url: string, workspaceId: string, ids: { invitation: string; request: string; user: string }) {
  return url
    .replace(":workspaceId", workspaceId)
    .replace(":invitationId", ids.invitation)
    .replace(":requestId", ids.request)
    .replace(":userId", ids.user);
}

describe("TC-F01-77 outsider sweep", () => {
  it(
    "TC-F01-77 [AC-F01-31] outsiders and removed people get the 'no such workspace' answer everywhere; nothing changes",
    SLOW,
    async () => {
      const routes = listRoutes(t.app).filter((route) => route.url.includes(":workspaceId") && route.method !== "HEAD");
      expect(routes.length).toBeGreaterThanOrEqual(15);
      const { people, ids, workspaceId } = scene;
      const idSets = [
        { invitation: ids.invitation, request: ids.request, user: people.member.id },
        { invitation: ids.outsiderInvitation, request: ids.request, user: people.outsider.id },
      ];
      const before = await snapshot(t, workspaceId);
      for (const who of [people.outsider, people.removed]) {
        for (const route of routes) {
          for (const set of idSets) {
            const method = route.method as Method;
            const payload =
              method === "GET" || method === "DELETE"
                ? undefined
                : {
                    name: "Hijack",
                    role: "admin",
                    enabled: false,
                    email: "x@example.test",
                    userId: who.id,
                    confirm: true,
                  };
            const real = await call(who.token, method, fill(route.url, workspaceId, set), payload);
            const missing = await call(who.token, method, fill(route.url, NOWHERE, set), payload);
            const label = `${route.method} ${route.url} as ${who === people.outsider ? "outsider" : "removed"}`;
            expect(real.statusCode, label).toBe(404);
            expect(withoutRequestId(real.body), label).toBe(withoutRequestId(missing.body));
          }
        }
      }
      expect(await snapshot(t, workspaceId)).toBe(before);
    },
  );
});

/** Each call must be refused with 403 and change nothing; answers how many were refused. */
async function refusals(who: Person, calls: [Method, string, object?][]): Promise<number> {
  const before = await snapshot(t, scene.workspaceId);
  for (const [method, path, body] of calls) {
    const answer = await call(who.token, method, `/api/v1/workspaces/${scene.workspaceId}${path}`, body);
    expect(answer.statusCode, `${method} ${path}`).toBe(403);
    expect(errorCode(answer), `${method} ${path}`).toBe("FORBIDDEN");
  }
  expect(await snapshot(t, scene.workspaceId)).toBe(before);
  return calls.length;
}

describe("TC-F01-79 member sweep", () => {
  it("TC-F01-79 [AC-F01-32] a plain member is refused every owner/admin action", SLOW, async () => {
    const { people, ids } = scene;
    const calls: [Method, string, object?][] = [
      ["PATCH", "", { name: "Hijacked" }],
      ["PATCH", `/members/${people.member.id}`, { role: "admin" }],
      ["PATCH", `/members/${people.member2.id}`, { role: "admin" }],
      ["PATCH", `/members/${people.admin.id}`, { role: "member" }],
      ["DELETE", `/members/${people.member2.id}`],
      ["DELETE", `/members/${people.admin.id}`],
      ["POST", "/transfer", { userId: people.member.id, confirm: true }],
      ["PUT", "/join-link", { enabled: false }],
      ["POST", "/join-link/replace"],
      ["GET", "/requests"],
      ["POST", `/requests/${ids.request}/approve`],
      ["POST", `/requests/${ids.request}/reject`],
      ["POST", "/invitations", { email: "new-admin@example.test", role: "admin" }],
      ["DELETE", `/invitations/${ids.invitation}`],
      // F02 (TC-F02-102): the Allow guests switch is for the owner and admins.
      ["PATCH", "/settings", { allowGuests: false }],
    ];
    expect(await refusals(people.member, calls)).toBe(15);
  });

  it("TC-F01-79 [AC-F01-22, AC-F01-32] an admin is refused the owner-only actions", SLOW, async () => {
    const { people } = scene;
    const calls: [Method, string, object?][] = [
      ["POST", "/transfer", { userId: people.admin.id, confirm: true }],
      ["PATCH", `/members/${people.admin2.id}`, { role: "member" }],
      ["DELETE", `/members/${people.admin2.id}`],
      ["PATCH", `/members/${people.owner.id}`, { role: "member" }],
      ["DELETE", `/members/${people.owner.id}`],
    ];
    expect(await refusals(people.admin, calls)).toBe(5);
  });
});
