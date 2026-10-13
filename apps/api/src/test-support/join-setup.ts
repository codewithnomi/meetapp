// Test helpers for the join link and request tests: the calls and quick database changes.
import { joinRequests, workspaceMembers } from "@meetapp/db";
import { and, eq } from "drizzle-orm";
import type { AuthTestApp } from "./auth-app.ts";
import type { Call, Person } from "./workspaces-setup.ts";

export interface JoinLink {
  enabled: boolean;
  link: string | null;
  code: string | null;
}
export interface RequestEntry {
  id: string;
  person: { id: string; email: string };
  via: string;
  status: string;
  removedEarlier: boolean;
}

export const CODE_FORMAT = /^[A-HJ-NP-Z2-9]{10}$/;
const base = (workspaceId: string) => `/api/v1/workspaces/${workspaceId}/join-link`;

export const turnOn = async (call: Call, who: Person, workspaceId: string) =>
  (await call(who.token, "PUT", base(workspaceId), { enabled: true })).json<JoinLink>();
export const turnOff = (call: Call, who: Person, workspaceId: string) =>
  call(who.token, "PUT", base(workspaceId), { enabled: false });
export const replaceLink = async (call: Call, who: Person, workspaceId: string) =>
  (await call(who.token, "POST", `${base(workspaceId)}/replace`)).json<JoinLink>();
export const lookup = (call: Call, who: Person, linkOrCode: string) =>
  call(who.token, "POST", "/api/v1/join/lookup", { linkOrCode });
export const ask = (call: Call, who: Person, linkOrCode: string) =>
  call(who.token, "POST", "/api/v1/join/request", { linkOrCode });
export const requestsOf = async (call: Call, who: Person, workspaceId: string) =>
  (await call(who.token, "GET", `/api/v1/workspaces/${workspaceId}/requests`)).json<{ requests: RequestEntry[] }>()
    .requests;
export const decide = (call: Call, who: Person, [workspaceId, id]: [string, string], verb: "approve" | "reject") =>
  call(who.token, "POST", `/api/v1/workspaces/${workspaceId}/requests/${id}/${verb}`);

export const requestRows = (t: AuthTestApp, workspaceId: string, userId: string) =>
  t.database.db
    .select()
    .from(joinRequests)
    .where(and(eq(joinRequests.workspaceId, workspaceId), eq(joinRequests.userId, userId)));

export const membershipRows = (t: AuthTestApp, workspaceId: string, userId: string) =>
  t.database.db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));

export const makeOld = (t: AuthTestApp, requestId: string, days: number) =>
  t.database.db
    .update(joinRequests)
    .set({ createdAt: new Date(Date.now() - days * 86_400_000) })
    .where(eq(joinRequests.id, requestId));
