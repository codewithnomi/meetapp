// The scene for the security sweeps (TC-F01-77, 79): workspace W with an owner, two admins, two
// members, a pending invitation, the join link on and a waiting request; a removed person; and an
// outsider with a workspace of their own (with its own invitation). Plus a snapshot of everything in W,
// to prove a refused call changed nothing.
import { invitations, joinRequests, workspaceMembers, workspaces } from "@meetapp/db";
import { asc, eq } from "drizzle-orm";
import type { AuthTestApp } from "./auth-app.ts";
import { invitationId, invite } from "./invitations-setup.ts";
import { ask, requestsOf, turnOn } from "./join-setup.ts";
import { newPerson, seedWorkspace, type Call, type Person } from "./workspaces-setup.ts";

export interface Scene {
  workspaceId: string;
  people: Record<"owner" | "admin" | "admin2" | "member" | "member2" | "asker" | "removed" | "outsider", Person>;
  /** Ids of real objects in W, and of the outsider's own objects. */
  ids: { invitation: string; request: string; outsiderWorkspace: string; outsiderInvitation: string };
}

async function people(t: AuthTestApp): Promise<Scene["people"]> {
  const names = ["owner", "admin", "admin2", "member", "member2", "asker", "removed", "outsider"] as const;
  const list = await Promise.all(names.map((name) => newPerson(t, `sweep-${name}`)));
  return Object.fromEntries(names.map((name, i) => [name, list[i]])) as Scene["people"];
}

export async function buildScene(t: AuthTestApp, call: Call): Promise<Scene> {
  const p = await people(t);
  const workspaceId = await seedWorkspace(t, [
    [p.owner, "owner"],
    [p.admin, "admin"],
    [p.admin2, "admin"],
    [p.member, "member"],
    [p.member2, "member"],
    [p.removed, "member"],
  ]);
  await call(p.owner.token, "DELETE", `/api/v1/workspaces/${workspaceId}/members/${p.removed.id}`);
  const invitation = invitationId(await invite(call, p.owner, workspaceId, { email: "invitee-sweep@example.test" }));
  const link = await turnOn(call, p.owner, workspaceId);
  await ask(call, p.asker, link.code ?? "");
  const request = (await requestsOf(call, p.owner, workspaceId))[0]?.id ?? "";
  const outsiderWorkspace = await seedWorkspace(t, [[p.outsider, "owner"]], "Outsider team");
  const outsiderInvitation = invitationId(
    await invite(call, p.outsider, outsiderWorkspace, { email: "friend-sweep@example.test" }),
  );
  return { workspaceId, people: p, ids: { invitation, request, outsiderWorkspace, outsiderInvitation } };
}

/** Everything a refused call must leave unchanged in W. */
export async function snapshot(t: AuthTestApp, workspaceId: string): Promise<string> {
  const db = t.database.db;
  const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, workspaceId));
  const members = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(asc(workspaceMembers.userId));
  const invited = await db
    .select()
    .from(invitations)
    .where(eq(invitations.workspaceId, workspaceId))
    .orderBy(asc(invitations.id));
  const requests = await db
    .select()
    .from(joinRequests)
    .where(eq(joinRequests.workspaceId, workspaceId))
    .orderBy(asc(joinRequests.id));
  return JSON.stringify({ workspace, members, invited, requests });
}
