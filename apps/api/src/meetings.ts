// Puts the meeting pieces together (F02): making and finding meetings, joining, the lobby, controls in a
// call, the call server's reports, the record and the call jobs. Used through accounts.ts, so server.ts
// and the integration tests run the same wiring.
import type { Database } from "@meetapp/db";
import { callServerUrl, type Config } from "./config/config.ts";
import type { CallsDeps } from "./modules/calls/admission.ts";
import { createAttendancesRepository } from "./modules/calls/attendances.repository.ts";
import { createCallEventsRepository } from "./modules/calls/call-events.repository.ts";
import { createCallJobs, startCallJobs } from "./modules/calls/calls.jobs.ts";
import { createCallsRepository } from "./modules/calls/calls.repository.ts";
import { createControlsService, refreshCall } from "./modules/calls/controls.service.ts";
import { createJoinService } from "./modules/calls/join.service.ts";
import { createLobbyService } from "./modules/calls/lobby.service.ts";
import { createRecordRepository } from "./modules/calls/record.repository.ts";
import { createRecordService } from "./modules/calls/record.service.ts";
import { createRejoinService } from "./modules/calls/rejoin.service.ts";
import { createWebhookService } from "./modules/calls/webhook.service.ts";
import { createChatRepository } from "./modules/chat/chat.repository.ts";
import { createChatService } from "./modules/chat/chat.service.ts";
import { createLookupService } from "./modules/meetings/lookup.service.ts";
import { createLookupTokens } from "./modules/meetings/lookup-token.ts";
import { createMeetingSecrets } from "./modules/meetings/meeting-secrets.ts";
import { createMeetingsRepository } from "./modules/meetings/meetings.repository.ts";
import { createMeetingsService } from "./modules/meetings/meetings.service.ts";
import type { RateLimiter } from "./plugins/rate-limit.ts";
import type { LiveKitProvider } from "./providers/livekit.ts";

interface MeetingWiring {
  config: Config;
  db: Database;
  livekit: LiveKitProvider;
}

function callsDepsFor({ config, db, livekit }: MeetingWiring, limiter: RateLimiter): CallsDeps {
  const repository = createMeetingsRepository(db);
  return {
    meetings: repository,
    secrets: createMeetingSecrets(config.DATA_ENCRYPTION_KEY, config.APP_PUBLIC_URL),
    lookupTokens: createLookupTokens(config.DATA_ENCRYPTION_KEY),
    limiter,
    calls: createCallsRepository(db),
    attendances: createAttendancesRepository(db),
    events: createCallEventsRepository(db),
    scheduler: { schedule: async () => {} },
    livekit,
    serverUrl: callServerUrl(config),
    now: () => new Date(),
  };
}

export function createMeetingPieces(wiring: MeetingWiring, limiter: RateLimiter) {
  const callsDeps = callsDepsFor(wiring, limiter);
  const shared = { ...callsDeps, repository: callsDeps.meetings };
  const callJobs = createCallJobs(callsDeps, {
    keepSimulated: wiring.config.CALLS_KEEP_SIMULATED_PEOPLE === "true",
  });
  const { config, db } = wiring;
  return {
    meetings: createMeetingsService({ ...shared, onChange: (meetingId) => refreshCall(callsDeps, meetingId) }),
    lookups: createLookupService(shared),
    join: createJoinService(callsDeps),
    lobby: createLobbyService(callsDeps),
    rejoin: createRejoinService(callsDeps),
    controls: createControlsService(callsDeps),
    record: createRecordService(callsDeps.meetings, createRecordRepository(db)),
    webhooks: createWebhookService(callsDeps),
    chat: createChatService({ calls: callsDeps, chat: createChatRepository(db) }),
    callJobs,
    /** The call services' shared pieces (tests build services with their own clock or call server). */
    callsDeps,
    /** Starts the call jobs (server.ts); from then on new calls get their 30-hour jobs. */
    startCallJobs: async () => {
      const started = await startCallJobs({ host: config.REDIS_HOST, port: config.REDIS_PORT }, callJobs);
      callsDeps.scheduler.schedule = started.schedule;
      return started;
    },
  };
}
