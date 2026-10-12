// Email invitations: database access only (F01 design.md sections 5 and 7). Only the SHA-256 of an
// invitation's token is stored. Every read of a workspace's invitations filters by workspace id (S2);
// "my invitations" match the signed-in person's verified email, never an email sent by the app.
import { invitations, user, workspaceMembers, workspaces, type Executor } from "@meetapp/db";
import { and, asc, eq, gt } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

const inviter = alias(user, "inviter");

interface NewInvitation {
  workspaceId: string;
  email: string;
  role: "admin" | "member";
  tokenHash: string;
  invitedBy: string;
  expiresAt: Date;
}

const sentColumns = {
  id: invitations.id,
  email: invitations.email,
  role: invitations.role,
  invitedById: invitations.invitedBy,
  invitedByName: inviter.name,
  createdAt: invitations.createdAt,
  expiresAt: invitations.expiresAt,
};

const usable = (now: Date) => and(eq(invitations.status, "pending"), gt(invitations.expiresAt, now));

export function createInvitationsRepository(executor: Executor) {
  return { ...workspaceSide(executor), ...inviteeSide(executor) };
}

async function insertReplacing(tx: Executor, data: NewInvitation) {
  await tx.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.id, data.workspaceId)).for("update");
  await tx
    .update(invitations)
    .set({ status: "replaced" })
    .where(
      and(
        eq(invitations.workspaceId, data.workspaceId),
        eq(invitations.email, data.email),
        eq(invitations.status, "pending"),
      ),
    );
  const [created] = await tx.insert(invitations).values(data).returning();
  if (!created) throw new Error("the new invitation row was not returned");
  return created;
}

/** What the workspace's people do: invite, list, cancel. */
function workspaceSide(executor: Executor) {
  return {
    isMemberByEmail: async (workspaceId: string, email: string): Promise<boolean> => {
      const found = await executor
        .select({ id: workspaceMembers.id })
        .from(workspaceMembers)
        .innerJoin(user, eq(user.id, workspaceMembers.userId))
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(user.email, email)));
      return found.length > 0;
    },
    /** The new invitation, replacing a pending one for the same email; one at a time per workspace. */
    create: (data: NewInvitation) => executor.transaction((tx) => insertReplacing(tx, data)),
    /** Pending, unexpired invitations; only those sent by `sentBy` when given. */
    listPending: (workspaceId: string, now: Date, sentBy?: string) =>
      executor
        .select(sentColumns)
        .from(invitations)
        .leftJoin(inviter, eq(inviter.id, invitations.invitedBy))
        .where(
          and(
            eq(invitations.workspaceId, workspaceId),
            usable(now),
            sentBy === undefined ? undefined : eq(invitations.invitedBy, sentBy),
          ),
        )
        .orderBy(asc(invitations.createdAt)),
    findPending: async (workspaceId: string, invitationId: string, now: Date) =>
      (
        await executor
          .select(sentColumns)
          .from(invitations)
          .leftJoin(inviter, eq(inviter.id, invitations.invitedBy))
          .where(and(eq(invitations.workspaceId, workspaceId), eq(invitations.id, invitationId), usable(now)))
      )[0],
    /** Changes a pending invitation's status; false if it was no longer pending. */
    close: async (invitationId: string, status: "cancelled" | "declined") =>
      (
        await executor
          .update(invitations)
          .set({ status })
          .where(and(eq(invitations.id, invitationId), eq(invitations.status, "pending")))
          .returning({ id: invitations.id })
      ).length > 0,
  };
}

const invitee = alias(user, "invitee");

/** Invitations joined with the person whose verified email they were sent to. */
const selectForPerson = (executor: Executor) =>
  executor
    .select({
      id: invitations.id,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      inviterName: inviter.name,
      invitedBy: invitations.invitedBy,
      role: invitations.role,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
    })
    .from(invitations)
    .innerJoin(workspaces, eq(workspaces.id, invitations.workspaceId))
    .innerJoin(invitee, and(eq(invitee.email, invitations.email), eq(invitee.emailVerified, true)))
    .leftJoin(inviter, eq(inviter.id, invitations.invitedBy));

/** For the web page: only what it shows. */
async function findByTokenHash(executor: Executor, tokenHash: string) {
  const [row] = await executor
    .select({
      email: invitations.email,
      status: invitations.status,
      expiresAt: invitations.expiresAt,
      workspaceName: workspaces.name,
      inviterName: inviter.name,
    })
    .from(invitations)
    .innerJoin(workspaces, eq(workspaces.id, invitations.workspaceId))
    .leftJoin(inviter, eq(inviter.id, invitations.invitedBy))
    .where(eq(invitations.tokenHash, tokenHash));
  return row;
}

/** What the invited person sees and does: their list, join, the web page. */
function inviteeSide(executor: Executor) {
  const forPerson = () => selectForPerson(executor);
  return {
    listForUser: (userId: string, now: Date) =>
      forPerson()
        .where(and(eq(invitee.id, userId), usable(now)))
        .orderBy(asc(invitations.createdAt)),
    /** Any invitation for the person's verified email, whatever its status (undefined for anyone else's). */
    findForUser: async (invitationId: string, userId: string) =>
      (await forPerson().where(and(eq(invitations.id, invitationId), eq(invitee.id, userId))))[0],
    /** Marks it accepted and adds the membership (kept if they are already in); false if no longer pending. */
    accept: (invitationId: string, member: { workspaceId: string; userId: string; role: "admin" | "member" }) =>
      executor.transaction(async (tx) => {
        const taken = await tx
          .update(invitations)
          .set({ status: "accepted" })
          .where(and(eq(invitations.id, invitationId), eq(invitations.status, "pending")))
          .returning({ id: invitations.id });
        if (taken.length === 0) return false;
        await tx.insert(workspaceMembers).values(member).onConflictDoNothing();
        return true;
      }),
    findByTokenHash: (tokenHash: string) => findByTokenHash(executor, tokenHash),
  };
}

export type InvitationsRepository = ReturnType<typeof createInvitationsRepository>;
