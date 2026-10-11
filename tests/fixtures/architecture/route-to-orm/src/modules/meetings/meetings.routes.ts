// Fixture: a route using the database library directly (must fail no-route-to-db).
import { sql } from "drizzle-orm";

export const listMeetingsQuery = sql`select 1`;
