// Accounts: business rules for the signed-in person (F01 design.md sections 3 and 8).
import type { MeResponse } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import type { AccountsRepository } from "./accounts.repository.ts";

/** The terms everyone agrees to; placeholder pages until the real documents exist (AC-F01-01). */
const TERMS_VERSION = "draft-1";

const THEMES = new Set(["light", "dark", "system"]);

export function createAccountsService(repository: AccountsRepository, now: () => Date = () => new Date()) {
  return {
    async me(userId: string): Promise<MeResponse> {
      const row = await repository.findUser(userId);
      if (!row) throw new AppError(401, "UNAUTHORIZED", "Sign in to continue.");
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
      };
    },
    /** Records the terms and the 16+ statement (first Google/Microsoft sign-in, AC-F01-07). */
    async acceptTerms(userId: string): Promise<void> {
      await repository.acceptTerms(userId, TERMS_VERSION, now());
    },
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;
