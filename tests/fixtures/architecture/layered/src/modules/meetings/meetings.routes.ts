// Fixture: route -> service -> repository, the allowed layering (must pass).
import { getMeeting } from "./meetings.service.ts";

export function getMeetingRoute(id: string) {
  return getMeeting(id);
}
