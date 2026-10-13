// Join link, join code and requests to join: database access only (F01 design.md sections 5 and 7).
// A link or code is found only through its keyed hash (S8); every read of a workspace's requests
// filters by workspace id (S2).
import { joinRequests, memberRemovals, user, workspaceMembers, workspaces, type Executor } from "@meetapp/db";
import { and, asc, count, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { JoinLookup } from "./join-secret.ts";

/** A stored, encrypted join secret with its lookup hashes; undefined turns joining off. */
interface StoredSecret extends JoinLookup {
  encrypted: string;
  keyVersion: number;
}

export function createJoinRequestsRepository(executor: Executor) {
  return { ...linkSide(executor), ...requestSide(executor), ...housekeeping(executor), ...decisions(executor) };
}

function linkSide(executor: Executor) {
  return {
    joinState: async (workspaceId: string) =>
      (
        await executor
          .select({
            enabled: workspaces.joinEnabled,
            encrypted: workspaces.joinSecretEnc,
            keyVersion: workspaces.joinKeyVersion,
          })
          .from(workspaces)
          .where(eq(workspaces.id, workspaceId))
      )[0],
    setJoin: async (workspaceId: string, secret: StoredSecret | undefined) => {
      await executor
        .update(workspaces)
        .set({
          joinEnabled: secret !== undefined,
          joinSecretEnc: secret?.encrypted ?? null,
          joinKeyVersion: secret?.keyVersion ?? null,
          joinLinkHmac: secret?.linkHmac ?? null,
          joinLookupHmac: secret?.codeHmac ?? null,
        })
        .where(eq(workspaces.id, workspaceId));
    },
    /** The company workspace whose link or code is on and matches; `via` says which matched. */
    findByLookup: async ({ linkHmac, codeHmac }: JoinLookup) => {
      const [row] = await executor
        .select({ id: workspaces.id, name: workspaces.name, linkHmac: workspaces.joinLinkHmac })
        .from(workspaces)
        .where(
          and(
            eq(workspaces.joinEnabled, true),
            eq(workspaces.kind, "company"),
            or(eq(workspaces.joinLinkHmac, linkHmac), eq(workspaces.joinLookupHmac, codeHmac)),
          ),
        )
        .limit(1);
      return (
        row && { id: row.id, name: row.name, via: row.linkHmac === linkHmac ? ("link" as const) : ("code" as const) }
      );
    },
  };
}

function requestSide(executor: Executor) {
  return {
    /** A new pending request, unless one is already pending; a stale pending one (older than `cutoff`) expires first. */
    create: (data: { workspaceId: string; userId: string; via: "link" | "code" }, cutoff: Date) =>
      executor.transaction(async (tx) => {
        await tx
          .update(joinRequests)
          .set({ status: "expired" })
          .where(
            and(
              eq(joinRequests.workspaceId, data.workspaceId),
              eq(joinRequests.userId, data.userId),
              eq(joinRequests.status, "pending"),
              lt(joinRequests.createdAt, cutoff),
            ),
          );
        const created = await tx
          .insert(joinRequests)
          .values(data)
          .onConflictDoNothing()
          .returning({ id: joinRequests.id });
        return created.length > 0;
      }),
    /** Pending requests with the person and whether they were removed from this workspace before. */
    listPending: (workspaceId: string) =>
      executor
        .select({
          id: joinRequests.id,
          personId: user.id,
          name: user.name,
          email: user.email,
          via: joinRequests.via,
          createdAt: joinRequests.createdAt,
          removedEarlier: sql<boolean>`exists (select 1 from ${memberRemovals} where ${memberRemovals.workspaceId} = ${joinRequests.workspaceId} and ${memberRemovals.userId} = ${joinRequests.userId})`,
        })
        .from(joinRequests)
        .innerJoin(user, eq(user.id, joinRequests.userId))
        .where(and(eq(joinRequests.workspaceId, workspaceId), eq(joinRequests.status, "pending")))
        .orderBy(asc(joinRequests.createdAt)),
  };
}

/** Counts, who to tell, and the daily expiry. */
function housekeeping(executor: Executor) {
  return {
    memberCount: async (workspaceId: string) =>
      (
        await executor
          .select({ n: count() })
          .from(workspaceMembers)
          .where(eq(workspaceMembers.workspaceId, workspaceId))
      )[0]?.n ?? 0,
    /** Owner and admins: they are told about new requests. */
    managers: (workspaceId: string) =>
      executor
        .select({ email: user.email })
        .from(workspaceMembers)
        .innerJoin(user, eq(user.id, workspaceMembers.userId))
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), inArray(workspaceMembers.role, ["owner", "admin"]))),
    /** The daily job: pending requests older than `cutoff` become expired. */
    expireOlderThan: async (cutoff: Date) =>
      (
        await executor
          .update(joinRequests)
          .set({ status: "expired" })
          .where(and(eq(joinRequests.status, "pending"), lt(joinRequests.createdAt, cutoff)))
          .returning({ id: joinRequests.id })
      ).length,
  };
}

export type DecisionOutcome = "approved" | "rejected";

function decisions(executor: Executor) {
  return {
    findRequest: async (workspaceId: string, requestId: string) =>
      (
        await executor
          .select({
            id: joinRequests.id,
            userId: joinRequests.userId,
            status: joinRequests.status,
            createdAt: joinRequests.createdAt,
            email: user.email,
          })
          .from(joinRequests)
          .innerJoin(user, eq(user.id, joinRequests.userId))
          .where(and(eq(joinRequests.workspaceId, workspaceId), eq(joinRequests.id, requestId)))
      )[0],
    /** Decides a still-pending request once; approval adds them as a member. False if someone decided first. */
    decide: (
      request: { workspaceId: string; requestId: string; userId: string },
      decision: { outcome: DecisionOutcome; decidedBy: string; at: Date },
    ) =>
      executor.transaction(async (tx) => {
        const taken = await tx
          .update(joinRequests)
          .set({ status: decision.outcome, decidedBy: decision.decidedBy, decidedAt: decision.at })
          .where(and(eq(joinRequests.id, request.requestId), eq(joinRequests.status, "pending")))
          .returning({ id: joinRequests.id });
        if (taken.length === 0) return false;
        if (decision.outcome === "approved") {
          await tx
            .insert(workspaceMembers)
            .values({ workspaceId: request.workspaceId, userId: request.userId, role: "member" })
            .onConflictDoNothing();
        }
        return true;
      }),
  };
}

export type JoinRequestsRepository = ReturnType<typeof createJoinRequestsRepository>;
