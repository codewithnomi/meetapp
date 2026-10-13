// Sample data for local development (AC-F00-45, AC-F01-30): feature flags, and since F01 the example
// people and "Example team" (seed-people.ts). No real personal data. Seeding twice adds nothing new;
// clearing removes only these records.
import { inArray } from "drizzle-orm";
import type { Database } from "./connection.ts";
import { featureFlags } from "./schema.ts";
import { clearPeople, seedPeople } from "./seed-people.ts";

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
  return added.length + (await seedPeople(db));
}

/** Removes the sample records only. Returns how many were removed. */
export async function clearSeed(db: Database): Promise<number> {
  const removed = await db
    .delete(featureFlags)
    .where(inArray(featureFlags.key, SEED_KEYS))
    .returning({ id: featureFlags.id });
  return removed.length + (await clearPeople(db));
}
