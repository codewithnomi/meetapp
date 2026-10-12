// Test helpers for the workspace tests: people with session tokens, workspaces set up straight in the
// database (invitations come in T12), and short wrappers for the HTTP calls.
import { workspaceMembers, workspaces } from "@meetapp/db";
import { issueSession } from "../plugins/auth.ts";
import { bearer, createUser, testEmail, type AuthTestApp } from "./auth-app.ts";

export interface Person {
  id: string;
  token: string;
  email: string;
}
export type Role = "owner" | "admin" | "member";

export async function newPerson(t: AuthTestApp, label: string): Promise<Person> {
  const email = testEmail(label);
  const id = await createUser(t.auth, { email, password: "correct horse battery" });
  return { id, token: await issueSession(t.auth, id), email };
}

/** A company workspace with the given people in the given roles (the owner is the first "owner"). */
export async function seedWorkspace(t: AuthTestApp, people: [Person, Role][], name = "Team"): Promise<string> {
  const owner = (people.find(([, role]) => role === "owner") ?? people[0])?.[0];
  if (!owner) throw new Error("a workspace needs people");
  const [row] = await t.database.db
    .insert(workspaces)
    .values({ name, kind: "company", createdBy: owner.id })
    .returning({ id: workspaces.id });
  if (!row) throw new Error("workspace not created");
  const workspaceId = row.id;
  await t.database.db
    .insert(workspaceMembers)
    .values(people.map(([person, role]) => ({ workspaceId, userId: person.id, role })));
  return workspaceId;
}

export function caller(t: AuthTestApp) {
  return (token: string, method: "GET" | "POST" | "PATCH" | "DELETE", url: string, payload?: object) =>
    t.app.inject({
      method,
      url,
      ...(payload ? { payload } : {}),
      headers: { origin: "app://meetapp", ...bearer(token) },
    });
}

export type Call = ReturnType<typeof caller>;
export const errorCode = (response: { json: <T>() => T }) => response.json<{ error: { code: string } }>().error.code;
