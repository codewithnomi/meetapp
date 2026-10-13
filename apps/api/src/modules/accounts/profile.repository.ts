// Profile: database access for the name, the saved look and the photo key (F01 design.md section 6).
import { user, workspaceMembers, type Database } from "@meetapp/db";
import { and, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

export interface SavedLook {
  theme?: string | undefined;
  accent?: string | undefined;
}

export function createProfileRepository(db: Database) {
  return {
    setName: async (id: string, name: string) => {
      await db.update(user).set({ name }).where(eq(user.id, id));
    },
    setLook: async (id: string, look: SavedLook) => {
      const changes = {
        ...(look.theme === undefined ? {} : { theme: look.theme }),
        ...(look.accent === undefined ? {} : { accent: look.accent }),
      };
      if (Object.keys(changes).length > 0) await db.update(user).set(changes).where(eq(user.id, id));
    },
    avatarKey: async (id: string): Promise<string | null> =>
      (await db.select({ key: user.avatarKey }).from(user).where(eq(user.id, id)).limit(1))[0]?.key ?? null,
    /** Stores the new key (or none) and gives back the old one, so its file can be deleted. */
    replaceAvatarKey: (id: string, key: string | null): Promise<string | null> =>
      db.transaction(async (tx) => {
        const [row] = await tx.select({ key: user.avatarKey }).from(user).where(eq(user.id, id)).for("update");
        await tx.update(user).set({ avatarKey: key }).where(eq(user.id, id));
        return row?.key ?? null;
      }),
    /** True when both are in at least one workspace together (who may see a photo, AC-F01-25). */
    shareAWorkspace: async (viewerId: string, ownerId: string): Promise<boolean> => {
      const other = alias(workspaceMembers, "other");
      const rows = await db
        .select({ id: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .innerJoin(other, eq(other.workspaceId, workspaceMembers.workspaceId))
        .where(and(eq(workspaceMembers.userId, viewerId), eq(other.userId, ownerId)))
        .limit(1);
      return rows.length > 0;
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
