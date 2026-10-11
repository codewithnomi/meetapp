// Accounts: database access only (the `user` table is shared with Better Auth).
import { user, type Database } from "@meetapp/db";
import { eq } from "drizzle-orm";

export function createAccountsRepository(db: Database) {
  return {
    findUser: async (id: string) => (await db.select().from(user).where(eq(user.id, id)).limit(1))[0],
    acceptTerms: async (id: string, termsVersion: string, at: Date) => {
      await db.update(user).set({ termsVersion, termsAcceptedAt: at, ageConfirmedAt: at }).where(eq(user.id, id));
    },
  };
}

export type AccountsRepository = ReturnType<typeof createAccountsRepository>;
