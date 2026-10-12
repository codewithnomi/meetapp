// Test helpers for the invitation tests: the calls, the link in the email, and quick database changes.
import { invitations, user } from "@meetapp/db";
import { eq } from "drizzle-orm";
import type { AuthTestApp } from "./auth-app.ts";
import { readEmail, waitForEmail } from "./mailpit.ts";
import type { Call, Person } from "./workspaces-setup.ts";

export interface SentInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  invitedBy: { id: string; name: string } | null;
}

export const invite = (
  call: Call,
  who: Person,
  workspaceId: string,
  body: { email: string; role?: "admin" | "member" },
) => call(who.token, "POST", `/api/v1/workspaces/${workspaceId}/invitations`, body);

export const invitationId = (response: { json: <T>() => T }) =>
  response.json<{ invitation: SentInvitation }>().invitation.id;

/** The token in the button link of the newest invitation email to `address` after `since`. */
export async function tokenFromEmail(address: string, since: Date): Promise<string> {
  const message = await waitForEmail(address, { since, subject: /invit/i });
  const body = await readEmail(message.ID);
  const token = /\/invite\/([\w-]+)/.exec(body.Text)?.[1];
  if (!token) throw new Error("The invitation email has no link");
  return token;
}

export const statusOf = async (t: AuthTestApp, id: string) =>
  (await t.database.db.select().from(invitations).where(eq(invitations.id, id)))[0]?.status;

export const expire = (t: AuthTestApp, id: string) =>
  t.database.db
    .update(invitations)
    .set({ expiresAt: new Date(Date.now() - 60_000) })
    .where(eq(invitations.id, id));

export const setUserName = (t: AuthTestApp, userId: string, name: string) =>
  t.database.db.update(user).set({ name }).where(eq(user.id, userId));
