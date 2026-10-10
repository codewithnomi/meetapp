// Reads feature flags from the database (database access only).
import { listFlags, type Database } from "@meetapp/db";
import type { Flag } from "@meetapp/contracts";

export function createFlagsRepository(db: Database) {
  return { list: (): Promise<Flag[]> => listFlags(db) };
}
