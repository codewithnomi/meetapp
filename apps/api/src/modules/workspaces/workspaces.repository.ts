// Workspaces: database access only (F01 design.md section 5). Every read of workspace data filters by
// workspace id (S2). The personal workspace is created with every account (AC-F01-14); the database
// allows only one per person, so creating it twice is harmless.
import { joinRequests, memberRemovals, user, workspaceMembers, workspaces, type Executor } from "@meetapp/db";
import type { MemberRole, WorkspaceSummary } from "@meetapp/contracts";
import { and, asc, count, eq, gt, inArray, ne, sql } from "drizzle-orm";
import type { Membership } from "./workspaces.permissions.ts";

/** Shown as "Personal" in the app; only its owner is ever in it. */
const PERSONAL_NAME = "Personal";

/**
 * Creates the person's personal workspace and their owner membership, each unless it exists. Safe to
 * call twice at the same time, and it repairs a workspace left without its membership (for example
 * when a process stopped between the two steps).
 */
export async function insertPersonalWorkspace(executor: Executor, userId: string): Promise<void> {
  await executor
    .insert(workspaces)
    .values({ name: PERSONAL_NAME, kind: "personal", createdBy: userId })
    .onConflictDoNothing();
  const [personal] = await executor
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(and(eq(workspaces.createdBy, userId), eq(workspaces.kind, "personal")))
    .limit(1);
  if (personal) {
    await executor
      .insert(workspaceMembers)
      .values({ workspaceId: personal.id, userId, role: "owner" })
      .onConflictDoNothing();
  }
}

/** How many company workspaces the person owns now (AC-F01-15). */
async function ownedCompanyCount(executor: Executor, userId: string): Promise<number> {
  const [row] = await executor
    .select({ owned: count() })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.role, "owner"), eq(workspaces.kind, "company")),
    );
  return row?.owned ?? 0;
}

/** Holds the person's row until the transaction ends, so two of their own changes can't pass a limit together. */
async function lockUser(executor: Executor, userId: string): Promise<void> {
  await executor.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");
}

const summary = {
  id: workspaces.id,
  name: workspaces.name,
  kind: workspaces.kind,
  role: workspaceMembers.role,
  allowGuests: workspaces.allowGuests,
};

export function createWorkspacesRepository(executor: Executor) {
  return { ...personal(executor), ...reads(executor), ...changes(executor), ...membershipEnds(executor) };
}

function personal(executor: Executor) {
  return {
    /** True only when the personal workspace exists AND they are in it, so a half-made one gets repaired. */
    hasPersonalWorkspace: async (userId: string): Promise<boolean> => {
      const found = await executor
        .select({ id: workspaces.id })
        .from(workspaces)
        .innerJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(
          and(eq(workspaces.createdBy, userId), eq(workspaces.kind, "personal"), eq(workspaceMembers.userId, userId)),
        )
        .limit(1);
      return found.length > 0;
    },
    ensurePersonalWorkspace: (userId: string) => insertPersonalWorkspace(executor, userId),
    pendingRequestCounts: (userId: string) => pendingRequestCounts(executor, userId),
  };
}

function reads(executor: Executor) {
  return {
    /** Every workspace the person is in, Personal first, then by name. */
    listForUser: (userId: string): Promise<WorkspaceSummary[]> =>
      executor
        .select(summary)
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(eq(workspaceMembers.userId, userId))
        .orderBy(sql`${workspaces.kind} = 'company'`, asc(workspaces.name), asc(workspaces.createdAt)),
    /** The person's membership of one workspace, or undefined when they aren't in it (or it doesn't exist). */
    findMembership: async (workspaceId: string, userId: string): Promise<Membership | undefined> => {
      const [row] = await executor
        .select({ ...summary, userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
      return row && { workspaceId: row.id, userId: row.userId, name: row.name, kind: row.kind, role: row.role };
    },
    listMembers: (workspaceId: string) =>
      executor
        .select({
          userId: workspaceMembers.userId,
          name: user.name,
          email: user.email,
          role: workspaceMembers.role,
          joinedAt: workspaceMembers.createdAt,
          avatarKey: user.avatarKey,
        })
        .from(workspaceMembers)
        .innerJoin(user, eq(user.id, workspaceMembers.userId))
        .where(eq(workspaceMembers.workspaceId, workspaceId))
        .orderBy(asc(user.name), asc(user.email)),
    memberRole: async (workspaceId: string, userId: string): Promise<MemberRole | undefined> => {
      const [row] = await executor
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
      return row?.role;
    },
  };
}

function changes(executor: Executor) {
  return {
    /** A company workspace with the person as owner, unless they already own `limit`; undefined then. */
    createCompany: (userId: string, name: string, limit: number): Promise<WorkspaceSummary | undefined> =>
      executor.transaction(async (tx) => {
        await lockUser(tx, userId);
        if ((await ownedCompanyCount(tx, userId)) >= limit) return undefined;
        const [created] = await tx
          .insert(workspaces)
          .values({ name, kind: "company", createdBy: userId })
          .returning({ id: workspaces.id, name: workspaces.name });
        if (!created) throw new Error("the new workspace row was not returned");
        await tx.insert(workspaceMembers).values({ workspaceId: created.id, userId, role: "owner" });
        return { id: created.id, name: created.name, kind: "company", role: "owner", allowGuests: true };
      }),
    setAllowGuests: async (workspaceId: string, allowGuests: boolean): Promise<void> => {
      await executor.update(workspaces).set({ allowGuests }).where(eq(workspaces.id, workspaceId));
    },
    rename: async (workspaceId: string, name: string): Promise<void> => {
      await executor.update(workspaces).set({ name }).where(eq(workspaces.id, workspaceId));
    },
    /** Changes a role, only while the person still has `from` (never the owner's row). */
    setRole: async (workspaceId: string, userId: string, from: MemberRole, to: "admin" | "member") => {
      const changed = await executor
        .update(workspaceMembers)
        .set({ role: to })
        .where(memberWithRole(workspaceId, userId, from))
        .returning({ id: workspaceMembers.id });
      return changed.length > 0;
    },
  };
}

const memberWithRole = (workspaceId: string, userId: string, role: MemberRole) =>
  and(
    eq(workspaceMembers.workspaceId, workspaceId),
    eq(workspaceMembers.userId, userId),
    eq(workspaceMembers.role, role),
  );

/** Leaving, removal and hand-over: each is one transaction, and none ever touches a second owner. */
const notOwner = (workspaceId: string, userId: string) =>
  and(
    eq(workspaceMembers.workspaceId, workspaceId),
    eq(workspaceMembers.userId, userId),
    ne(workspaceMembers.role, "owner"),
  );

/** Leaving, removal and hand-over: each is one transaction, and none ever makes a second owner. */
function membershipEnds(executor: Executor) {
  return {
    /** The membership goes; what they made stays with the workspace (AC-F01-23). */
    leave: async (workspaceId: string, userId: string): Promise<boolean> =>
      (await executor.delete(workspaceMembers).where(notOwner(workspaceId, userId)).returning()).length > 0,
    /** Removes someone with role `role` and records it for the "removed earlier" badge (AC-F01-21). */
    remove: (workspaceId: string, userId: string, role: MemberRole, removedBy: string): Promise<boolean> =>
      executor.transaction(async (tx) => {
        const gone = await tx
          .delete(workspaceMembers)
          .where(memberWithRole(workspaceId, userId, role))
          .returning();
        if (gone.length === 0) return false;
        await tx.insert(memberRemovals).values({ workspaceId, userId, removedBy });
        return true;
      }),
    transfer: async (workspaceId: string, fromUserId: string, toUserId: string, limit: number) => {
      try {
        await executor.transaction((tx) => swapOwner(tx, { workspaceId, fromUserId, toUserId, limit }));
        return "done" as const;
      } catch (error) {
        if (error instanceof TransferRefused) return error.outcome;
        throw error;
      }
    },
  };
}

/**
 * The hand-over (AC-F01-22): the owner becomes an admin, then the new person the owner, in that order so
 * the one-owner rule always holds. Refused (and undone) with "not-owner" when the caller stopped being
 * the owner meanwhile, "not-member" when the other person isn't in the workspace, and "limit" when they
 * already own `limit` company workspaces.
 */
async function swapOwner(
  tx: Executor,
  {
    workspaceId,
    fromUserId,
    toUserId,
    limit,
  }: { workspaceId: string; fromUserId: string; toUserId: string; limit: number },
): Promise<void> {
  const stepDown = await tx
    .update(workspaceMembers)
    .set({ role: "admin" })
    .where(memberWithRole(workspaceId, fromUserId, "owner"))
    .returning({ id: workspaceMembers.id });
  if (stepDown.length === 0) throw new TransferRefused("not-owner");
  await lockUser(tx, toUserId);
  if ((await ownedCompanyCount(tx, toUserId)) >= limit) throw new TransferRefused("limit");
  const stepUp = await tx
    .update(workspaceMembers)
    .set({ role: "owner" })
    .where(notOwner(workspaceId, toUserId))
    .returning({ id: workspaceMembers.id });
  if (stepUp.length === 0) throw new TransferRefused("not-member");
}

type TransferOutcome = "not-owner" | "not-member" | "limit";

/** Thrown inside the hand-over so the whole transaction is undone, then answered as `outcome`. */
class TransferRefused extends Error {
  readonly outcome: TransferOutcome;

  constructor(outcome: TransferOutcome) {
    super(outcome);
    this.outcome = outcome;
  }
}

/** Requests to join waiting in each workspace where the person is the owner or an admin (the app's badge). */
/** A request to join older than this has expired, even before the daily job marks it (join-requests.service.ts). */
const REQUEST_LIFETIME_MS = 14 * 24 * 60 * 60 * 1_000;

/** Waiting requests per workspace the person manages; old ones aren't counted, as the list hides them. */
async function pendingRequestCounts(executor: Executor, userId: string): Promise<Map<string, number>> {
  const cutoff = new Date(Date.now() - REQUEST_LIFETIME_MS);
  const rows = await executor
    .select({ workspaceId: joinRequests.workspaceId, n: count() })
    .from(joinRequests)
    .innerJoin(
      workspaceMembers,
      and(eq(workspaceMembers.workspaceId, joinRequests.workspaceId), eq(workspaceMembers.userId, userId)),
    )
    .where(
      and(
        eq(joinRequests.status, "pending"),
        gt(joinRequests.createdAt, cutoff),
        inArray(workspaceMembers.role, ["owner", "admin"]),
      ),
    )
    .groupBy(joinRequests.workspaceId);
  return new Map(rows.map((row) => [row.workspaceId, row.n]));
}

export type WorkspacesRepository = ReturnType<typeof createWorkspacesRepository>;
