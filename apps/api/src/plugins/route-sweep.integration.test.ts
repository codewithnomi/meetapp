// TC-F01-76 (AC-F01-31, 32, 33), security: the S1 route sweep. The route list is read from the running
// server; every route must be named below as public or signed-in, so a new route can't be left
// unprotected by accident. Every signed-in route answers 401 with no session, an expired one, a broken
// token and a revoked token. Own database; needs the `pnpm dev` services.
import { session } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listRoutes, type RouteSummary } from "../app.ts";
import { bearer, startAuthTestApp, type AuthTestApp } from "../test-support/auth-app.ts";
import { newPerson } from "../test-support/workspaces-setup.ts";

/** Routes anyone may call, each with its own limit or check (design.md sections 4, 8 and 9). */
const PUBLIC = new Set([
  "GET /api/auth/*", // Better Auth: only its allow-list answers (TC-F01-80)
  "POST /api/auth/*",
  "GET /api/v1/auth/providers",
  "POST /api/v1/auth/sign-up",
  "POST /api/v1/auth/sign-up/verify",
  "POST /api/v1/auth/sign-up/resend",
  "POST /api/v1/auth/reset-password",
  "POST /api/v1/auth/desktop/init",
  "GET /api/v1/auth/desktop/start",
  "GET /api/v1/auth/desktop/done",
  "POST /api/v1/auth/desktop/done",
  "POST /api/v1/auth/desktop/exchange",
  "POST /api/v1/auth/desktop/cancel",
  "GET /api/v1/health",
  "GET /api/v1/flags",
  "GET /invite/:token",
  "GET /metrics", // F00: scraped by local monitoring only (operations.md)
  "OPTIONS *", // CORS preflight
]);
/** Routes that exist only while testing (modules/test-support). */
const TEST_ONLY = new Set(["GET /api/v1/__test__/whoami", "POST /__test__/error"]);

const ID = "00000000-0000-4000-8000-000000000999";
const key = (route: RouteSummary) => `${route.method} ${route.url}`;
const addressOf = (url: string) => url.replace(/:[A-Za-z]+/g, ID);

let t: AuthTestApp;
let routes: RouteSummary[];
const badSessions: Record<string, Record<string, string>> = {};

beforeAll(async () => {
  t = await startAuthTestApp();
  routes = listRoutes(t.app).filter((route) => route.method !== "HEAD");
  const expired = await newPerson(t, "expired");
  await t.database.db
    .update(session)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(session.userId, expired.id));
  const revoked = await newPerson(t, "revoked");
  await t.app.inject({
    method: "POST",
    url: "/api/v1/auth/sign-out-everywhere",
    headers: { origin: "app://meetapp", ...bearer(revoked.token) },
  });
  badSessions["no session"] = {};
  badSessions["expired session"] = bearer(expired.token);
  badSessions["malformed token"] = { authorization: "Bearer not.a-real%token" };
  badSessions["revoked session"] = bearer(revoked.token);
}, 60_000);

afterAll(async () => {
  await t.close();
}, 60_000);

describe("TC-F01-76 route sweep", () => {
  it("TC-F01-76 [AC-F01-31] the sweep sees every route (the list is not empty or partial)", () => {
    expect(routes.length).toBeGreaterThan(40);
    expect(routes.map(key)).toContain("GET /api/v1/workspaces/:workspaceId/members");
  });

  it("TC-F01-76 [AC-F01-31, AC-F01-32] every public route is on the list; everything else is signed-in", () => {
    for (const route of routes) {
      if (PUBLIC.has(key(route)) || TEST_ONLY.has(key(route))) continue;
      expect(route.url, key(route)).toMatch(/^\/api\/v1\//);
      expect(route.access, `${key(route)} must not be public`).not.toBe("public");
    }
    for (const route of routes.filter((r) => r.access === "public"))
      expect(PUBLIC.has(key(route)), key(route)).toBe(true);
  });

  it("TC-F01-76 [AC-F01-31, AC-F01-33] every signed-in route refuses no, expired, broken and revoked sessions with 401", async () => {
    const guarded = routes.filter((route) => !PUBLIC.has(key(route)) && !TEST_ONLY.has(key(route)));
    for (const route of guarded) {
      for (const [label, headers] of Object.entries(badSessions)) {
        const answer = await t.app.inject({
          method: route.method as "GET",
          url: addressOf(route.url),
          headers: { origin: "app://meetapp", ...headers },
          ...(route.method === "GET" || route.method === "DELETE" ? {} : { payload: {} }),
        });
        expect(answer.statusCode, `${key(route)} with ${label}`).toBe(401);
        expect(answer.json<{ error: { code: string } }>().error.code, `${key(route)} with ${label}`).toBe(
          "UNAUTHORIZED",
        );
      }
    }
  });
});
