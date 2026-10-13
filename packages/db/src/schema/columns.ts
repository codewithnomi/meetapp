// Columns every table shares (packages/db/CLAUDE.md): a database-made id, and creation and change
// times with their time zone. `updated_at` is kept current by Drizzle; raw SQL must set it itself.
import { timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").primaryKey().defaultRandom();

export const timestamps = () => ({
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/** A point in time with its time zone (expiry, decision, acceptance…). */
export const moment = (name: string) => timestamp(name, { withTimezone: true });
