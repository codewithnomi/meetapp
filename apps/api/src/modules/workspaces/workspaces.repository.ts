// Workspaces: database access only (F01 design.md section 5). The personal workspace is created with
// every account (AC-F01-14); the database allows only one per person, so creating it twice is harmless.
import { workspaceMembers, workspaces, type Executor } from "@meetapp/db";
import { and, eq } from "drizzle-orm";

/** Shown as "Personal" in the app; only its owner is ever in it. */
const PERSONAL_NAME = "Personal";

/** Creates the person's personal workspace unless it exists. Safe to call twice at the same time. */
export async function insertPersonalWorkspace(executor: Executor, userId: string): Promise<void> {
  const [created] = await executor
    .insert(workspaces)
    .values({ name: PERSONAL_NAME, kind: "personal", createdBy: userId })
    .onConflictDoNothing()
    .returning({ id: workspaces.id });
  if (created) await executor.insert(workspaceMembers).values({ workspaceId: created.id, userId, role: "owner" });
}

export function createWorkspacesRepository(executor: Executor) {
  return {
    hasPersonalWorkspace: async (userId: string): Promise<boolean> => {
      const found = await executor
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(and(eq(workspaces.createdBy, userId), eq(workspaces.kind, "personal")))
        .limit(1);
      return found.length > 0;
    },
    ensurePersonalWorkspace: (userId: string) => insertPersonalWorkspace(executor, userId),
  };
}

export type WorkspacesRepository = ReturnType<typeof createWorkspacesRepository>;
