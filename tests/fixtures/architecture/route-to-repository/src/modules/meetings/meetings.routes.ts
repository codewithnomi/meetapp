// Fixture: a route that skips the service layer and calls the repository directly (must fail).
import { findMeeting } from "./meetings.repository.ts";

export function getMeetingRoute(id: string) {
  return findMeeting(id);
}
