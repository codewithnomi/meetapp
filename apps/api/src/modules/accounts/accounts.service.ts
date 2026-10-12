// Accounts: business rules for the signed-in person (F01 design.md sections 3 and 8).
import type { MeResponse } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import type { WorkspacesRepository } from "../workspaces/workspaces.repository.ts";
import type { AccountsRepository } from "./accounts.repository.ts";
import { TERMS_VERSION } from "./sign-up.service.ts";

const THEMES = new Set(["light", "dark", "system"]);

/** Their workspaces, each with the requests to join waiting for them (0 where they can't decide). */
async function workspacesWithCounts(workspaces: WorkspacesRepository, userId: string) {
  const [list, counts] = await Promise.all([workspaces.listForUser(userId), workspaces.pendingRequestCounts(userId)]);
  return list.map((workspace) => ({ ...workspace, pendingRequests: counts.get(workspace.id) ?? 0 }));
}

/** The list, and the one to open: the last used while they are still in it, else Personal (AC-F01-16). */
async function workspacesToOpen(workspaces: WorkspacesRepository, userId: string, lastWorkspaceId: string | null) {
  const list = await workspacesWithCounts(workspaces, userId);
  const last = list.find((workspace) => workspace.id === lastWorkspaceId);
  const personal = list.find((workspace) => workspace.kind === "personal");
  return { workspaces: list, currentWorkspaceId: (last ?? personal ?? list[0])?.id ?? null };
}

export function createAccountsService(
  repository: AccountsRepository,
  workspaces: WorkspacesRepository,
  now: () => Date = () => new Date(),
) {
  return {
    async me(userId: string): Promise<MeResponse> {
      const row = await repository.findUser(userId);
      if (!row) throw new AppError(401, "UNAUTHORIZED", "Sign in to continue.");
      // Repairs a missing personal workspace (AC-F01-14); harmless when it exists.
      if (!(await workspaces.hasPersonalWorkspace(row.id))) await workspaces.ensurePersonalWorkspace(row.id);
      const theme = row.theme !== null && THEMES.has(row.theme) ? (row.theme as "light" | "dark" | "system") : null;
      return {
        user: {
          id: row.id,
          name: row.name,
          email: row.email,
          termsAccepted: row.termsAcceptedAt !== null,
          theme,
          accent: row.accent,
        },
        ...(await workspacesToOpen(workspaces, row.id, row.lastWorkspaceId)),
      };
    },
    /** Remembers the workspace the app shows, for the next start (AC-F01-16); 404 if they aren't in it. */
    async setLastWorkspace(userId: string, workspaceId: string): Promise<void> {
      if (!(await workspaces.findMembership(workspaceId, userId))) throw new AppError(404, "NOT_FOUND", "Not found.");
      await repository.setLastWorkspace(userId, workspaceId);
    },
    /** Records the terms and the 16+ statement (first Google/Microsoft sign-in, AC-F01-07). */
    async acceptTerms(userId: string): Promise<void> {
      await repository.acceptTerms(userId, TERMS_VERSION, now());
    },
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;
