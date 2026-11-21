// Scheduling's share of the minute-by-minute job (F13 design.md "Jobs"; AC-F13-21, 29, 30): send due
// reminders; cancel the meetings of organizers who left the workspace (however they left), emailing every
// invitee; and once a day delete outside invitees' addresses 30 days after a meeting was cancelled or expired.
import type { SchedulingChangesRepository } from "./scheduling-changes.repository.ts";
import type { MeetingMailer } from "./scheduling.mail.ts";
import type { SchedulingUpkeepRepository } from "./reminders.repository.ts";
import type { ReminderStore, RemindersService } from "./reminders.service.ts";

export interface UpkeepDeps {
  upkeep: SchedulingUpkeepRepository;
  changes: SchedulingChangesRepository;
  reminders: RemindersService;
  mail: MeetingMailer;
  store: ReminderStore;
  now?: () => Date;
}

const KEEP_ADDRESSES_MS = 30 * 24 * 60 * 60 * 1000;
const TWO_DAYS_S = 2 * 24 * 60 * 60;

export function createSchedulingUpkeep(deps: UpkeepDeps) {
  const now = deps.now ?? (() => new Date());
  return {
    /** Runs every minute; each part is safe to run twice. */
    minute: async () => {
      await deps.reminders.run();
      const at = now();
      for (const { meetingId, inviteeIds } of await deps.upkeep.orphaned(at)) {
        await deps.changes.cancelSeries(meetingId, at);
        await deps.mail.send(inviteeIds, "cancel");
      }
      const today = at.toISOString().slice(0, 10);
      if (await deps.store.once(`meetapp:scheduling:sweep:${today}`, TWO_DAYS_S)) {
        await deps.upkeep.sweepOutsideInvitees(new Date(at.getTime() - KEEP_ADDRESSES_MS));
      }
    },
  };
}

export type SchedulingUpkeep = ReturnType<typeof createSchedulingUpkeep>;
