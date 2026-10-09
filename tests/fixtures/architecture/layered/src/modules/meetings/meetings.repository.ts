// Fixture: the data-access layer for meetings.

export interface MeetingRow {
  id: string;
  title: string;
}

export function findMeeting(id: string): MeetingRow | undefined {
  return id.length > 0 ? { id, title: id } : undefined;
}
