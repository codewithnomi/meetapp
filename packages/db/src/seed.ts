// Sample data for local development (AC-F00-45). No real personal data. Sample users and a workspace
// are added here in F01. Seeding twice adds nothing new; clearing removes only these records.
import { inArray } from "drizzle-orm";
import type { Database } from "./connection.ts";
import { featureFlags } from "./schema.ts";

export const SEED_FLAGS = [
  { key: "home.welcome_banner", enabled: true, description: "Sample flag: shows the welcome text on the home screen." },
  { key: "labs.preview_features", enabled: false, description: "Sample flag: unfinished features, off by default." },
  {
    key: "demo",
    enabled: false,
    description: "Test flag: shows 'Demo feature is on' on the home screen (flag test TC-F00-72).",
  },
] as const;

const SEED_KEYS = SEED_FLAGS.map((flag) => flag.key);

/** Adds the sample records; existing ones are left as they are. Returns how many were added. */
export async function seedDatabase(db: Database): Promise<number> {
  const added = await db
    .insert(featureFlags)
    .values([...SEED_FLAGS])
    .onConflictDoNothing({ target: featureFlags.key })
    .returning({ id: featureFlags.id });
  return added.length;
}

/** Removes the sample records only. Returns how many were removed. */
export async function clearSeed(db: Database): Promise<number> {
  const removed = await db
    .delete(featureFlags)
    .where(inArray(featureFlags.key, SEED_KEYS))
    .returning({ id: featureFlags.id });
  return removed.length;
}
