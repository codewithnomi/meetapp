// Fixture: the service layer sits between routes and the repository.
import { findMeeting, type MeetingRow } from "./meetings.repository.ts";

export function getMeeting(id: string): MeetingRow | undefined {
  return findMeeting(id);
}
