// Database tables (docs/specs/F00-foundation/design.md section 10). Change only through a new migration
// (the db-migration skill): edit this file, then `pnpm --filter @meetapp/db db:generate`.
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Switch features on and off without a restart (AC-F00-34). Flags are off unless switched on. */
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  enabled: boolean("enabled").notNull().default(false),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
