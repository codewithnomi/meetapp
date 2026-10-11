// Accounts: database access only (the `user` and `account` tables are shared with Better Auth).
import { account, user, type Database } from "@meetapp/db";
import { eq } from "drizzle-orm";
import { insertPersonalWorkspace } from "../workspaces/workspaces.repository.ts";

export interface NewAccount {
  email: string;
  name: string;
  /** scrypt hash made by Better Auth's hasher. */
  passwordHash: string;
  termsVersion: string;
  theme: string | null;
  accent: string | null;
}

export function createAccountsRepository(db: Database) {
  return {
    findUser: async (id: string) => (await db.select().from(user).where(eq(user.id, id)).limit(1))[0],
    emailTaken: async (email: string): Promise<boolean> =>
      (await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1)).length > 0,
    /** The photo address Better Auth kept from Google/Microsoft (never shown to the app). */
    providerImage: async (id: string) =>
      (await db.select({ image: user.image }).from(user).where(eq(user.id, id)).limit(1))[0]?.image ?? null,
    /** Forgets the provider's photo address; stores our own copy's key when there is one (AC-F01-07). */
    finishProviderPhoto: async (id: string, avatarKey: string | undefined) => {
      await db
        .update(user)
        .set({ image: null, ...(avatarKey === undefined ? {} : { avatarKey }) })
        .where(eq(user.id, id));
    },
    acceptTerms: async (id: string, termsVersion: string, at: Date) => {
      await db.update(user).set({ termsVersion, termsAcceptedAt: at, ageConfirmedAt: at }).where(eq(user.id, id));
    },
    /**
     * The user (email confirmed), their password login and their personal workspace, all or nothing
     * (AC-F01-04, 14). A second account for the same email fails on the unique email rule.
     */
    createAccount: (data: NewAccount, at: Date): Promise<string> =>
      db.transaction(async (tx) => {
        const [created] = await tx
          .insert(user)
          .values({
            email: data.email,
            name: data.name,
            emailVerified: true,
            termsVersion: data.termsVersion,
            termsAcceptedAt: at,
            ageConfirmedAt: at,
            theme: data.theme,
            accent: data.accent,
          })
          .returning({ id: user.id });
        if (!created) throw new Error("the new user row was not returned");
        await tx
          .insert(account)
          .values({ userId: created.id, providerId: "credential", accountId: created.id, password: data.passwordHash });
        await insertPersonalWorkspace(tx, created.id);
        return created.id;
      }),
  };
}

export type AccountsRepository = ReturnType<typeof createAccountsRepository>;
