// Reading and switching feature flags. All queries are parameterized by Drizzle (no SQL built from text).
import { asc, eq } from "drizzle-orm";
import type { Database } from "./connection.ts";
import { featureFlags } from "./schema.ts";

/** Lower-case words joined by ".", "_" or "-", at most 64 characters, e.g. "home.welcome_banner". */
const FLAG_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
export const FLAG_KEY_MAX_LENGTH = 64;

export function isValidFlagKey(key: string): boolean {
  return key.length <= FLAG_KEY_MAX_LENGTH && FLAG_KEY_PATTERN.test(key);
}

export async function listFlags(db: Database): Promise<{ key: string; enabled: boolean }[]> {
  return db
    .select({ key: featureFlags.key, enabled: featureFlags.enabled })
    .from(featureFlags)
    .orderBy(asc(featureFlags.key));
}

/** Switches an existing flag. Returns false when no flag has that key (nothing is created). */
export async function setFlag(db: Database, key: string, enabled: boolean): Promise<boolean> {
  const updated = await db
    .update(featureFlags)
    .set({ enabled })
    .where(eq(featureFlags.key, key))
    .returning({ id: featureFlags.id });
  return updated.length > 0;
}
