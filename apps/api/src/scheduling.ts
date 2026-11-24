// Puts the scheduling pieces together (F13): scheduling and the calendar, changes and answers, meeting
// emails, reminders and the minute-by-minute upkeep. Used by meetings.ts, so server.ts and the
// integration tests run the same wiring.
import type { Redis } from "ioredis";
import type { Database } from "@meetapp/db";
import type { Config } from "./config/config.ts";
import type { Outbox } from "./emails/outbox.ts";
import type { CallsDeps } from "./modules/calls/admission.ts";
import { createLivePublisher } from "./modules/chats/chats-live.ts";
import {
  createRemindersRepository,
  createSchedulingUpkeepRepository,
} from "./modules/scheduling/reminders.repository.ts";
import { createRemindersService, type ReminderStore } from "./modules/scheduling/reminders.service.ts";
import { createSchedulingChangesRepository } from "./modules/scheduling/scheduling-changes.repository.ts";
import { createSchedulingChangesService } from "./modules/scheduling/scheduling-changes.service.ts";
import { createSchedulingUpkeep } from "./modules/scheduling/scheduling-upkeep.ts";
import { createMeetingMail } from "./modules/scheduling/scheduling.mail.ts";
import { createSchedulingRepository } from "./modules/scheduling/scheduling.repository.ts";
import { createSchedulingService } from "./modules/scheduling/scheduling.service.ts";

/** The few Redis steps reminders need. */
const storeOf = (redis: Redis): ReminderStore => ({
  once: async (key, seconds) => (await redis.set(key, "1", "EX", seconds, "NX")) === "OK",
  get: (key) => redis.get(key),
  put: async (key, value, seconds) => {
    await redis.set(key, value, "EX", seconds);
  },
});

/** The parts of the meeting wiring scheduling needs (its own type, so meetings.ts and this file don't import each other). */
export interface SchedulingWiring {
  config: Config;
  db: Database;
  outbox: Outbox;
  redis: Redis;
}

export function schedulingFor({ db, outbox, config, redis }: SchedulingWiring, calls: CallsDeps) {
  const scheduling = createSchedulingRepository(db);
  const changes = createSchedulingChangesRepository(db);
  const live = createLivePublisher(redis);
  const store = storeOf(redis);
  const mail = createMeetingMail({
    scheduling,
    secrets: calls.secrets,
    outbox,
    limiter: calls.limiter,
    emailFrom: config.EMAIL_FROM,
  });
  const shared = { meetings: calls.meetings, secrets: calls.secrets, mail, live, now: calls.now };
  const service = createSchedulingService({ ...shared, scheduling, limiter: calls.limiter });
  const reminders = createRemindersService({
    reminders: createRemindersRepository(db),
    scheduling: service,
    store,
    live,
    now: calls.now,
  });
  return {
    scheduling: service,
    schedulingChanges: createSchedulingChangesService({ ...shared, service, changes }),
    reminders,
    schedulingUpkeep: createSchedulingUpkeep({
      upkeep: createSchedulingUpkeepRepository(db),
      changes,
      reminders,
      mail,
      store,
      now: calls.now,
    }),
  };
}
