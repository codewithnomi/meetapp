// Fixture: a route that talks to the database package directly (must fail).
import { db } from "@meetapp/db";

export function getMeetingRoute(id: string) {
  return db.meetings.find(id);
}
