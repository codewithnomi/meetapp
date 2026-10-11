// Fixture: a service querying the database itself instead of using a repository (must fail no-service-to-db).
import { db } from "@meetapp/db";

export function countMeetings(): unknown {
  return db;
}
