// Reading a meeting's record (F02 design.md section 3.7; AC-F02-41, 50): the people who took part, the
// organizer and the co-organizers; anyone else gets the same 404 as for no meeting. Guests appear only
// by name. Audio and video are never stored.
import { notFound } from "./admission.ts";
import type { MeetingsRepository } from "../meetings/meetings.repository.ts";
import type { RecordRepository } from "./record.repository.ts";

const iso = (at: Date | null) => (at ? at.toISOString() : null);

export function createRecordService(meetings: MeetingsRepository, record: RecordRepository) {
  return {
    read: async (userId: string, meetingId: string) => {
      const row = await meetings.find(meetingId);
      if (!row) throw notFound();
      const manages = row.meeting.organizerId === userId || row.coOrganizerIds.includes(userId);
      if (!manages && !(await record.tookPart(meetingId, userId))) throw notFound();
      const calls = await record.calls(meetingId);
      const people = await record.participants(calls.map((call) => call.id));
      return {
        title: row.meeting.title,
        workspaceId: row.meeting.workspaceId,
        organizer: { id: row.meeting.organizerId, name: row.organizerName },
        calls: calls.map((call) => ({
          callId: call.id,
          startedAt: call.startedAt.toISOString(),
          endedAt: iso(call.endedAt),
          endReason: call.endReason,
          participants: people
            .filter((person) => person.callId === call.id)
            .map((person) => ({
              name: person.name,
              group: person.group,
              joinedAt: iso(person.joinedAt),
              leftAt: iso(person.leftAt),
            })),
        })),
      };
    },
  };
}

export type RecordService = ReturnType<typeof createRecordService>;
