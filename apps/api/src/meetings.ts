// Puts the meeting pieces together (F02): making and finding meetings, joining, the lobby, controls in a
// call, the call server's reports, the record and the call jobs. Used through accounts.ts, so server.ts
// and the integration tests run the same wiring.
import { hkdfSync } from "node:crypto";
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
import { createChatActionsRepository } from "./modules/chat/chat-actions.repository.ts";
import { createChatActionsService } from "./modules/chat/chat-actions.service.ts";
import { createChatPollsRepository } from "./modules/chat/chat-polls.repository.ts";
import { createChatPollsService } from "./modules/chat/chat-polls.service.ts";
import { createChatAfterRepository } from "./modules/chat/chat-after.repository.ts";
import { createChatAfterService } from "./modules/chat/chat-after.service.ts";
import { createChatUpkeepRepository } from "./modules/chat/chat-upkeep.repository.ts";
import { createChatUpkeepService } from "./modules/chat/chat-upkeep.service.ts";
import { createChatFilesRepository } from "./modules/chat/chat-files.repository.ts";
import { createChatFilesService, type FileStorage } from "./modules/chat/chat-files.service.ts";
import { createLookupService } from "./modules/meetings/lookup.service.ts";
import { createLookupTokens } from "./modules/meetings/lookup-token.ts";
import { createMeetingSecrets } from "./modules/meetings/meeting-secrets.ts";
import { createMeetingsRepository } from "./modules/meetings/meetings.repository.ts";
import { createMeetingsService } from "./modules/meetings/meetings.service.ts";
import type { RateLimiter } from "./plugins/rate-limit.ts";
import type { LiveKitProvider } from "./providers/livekit.ts";
import { createChatsRepository } from "./modules/chats/chats.repository.ts";
import { createChatsService } from "./modules/chats/chats.service.ts";

interface MeetingWiring {
  config: Config;
  db: Database;
  livekit: LiveKitProvider;
  /** Private file storage for chat files (F03). */
  storage: FileStorage;
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

const keyFor = (config: Config, label: string) =>
  Buffer.from(hkdfSync("sha256", config.DATA_ENCRYPTION_KEY, "meetapp", label, 32)).toString("hex");

/** Meeting chat (F03): messages, what people do to them, polls and files. */
function chatPieces({ config, db, storage }: MeetingWiring, calls: CallsDeps) {
  const chatDeps = {
    calls,
    chat: createChatRepository(db),
    actions: createChatActionsRepository(db),
    polls: createChatPollsRepository(db),
    files: createChatFilesRepository(db),
    voterSecret: keyFor(config, "chat-poll-voters-v1"),
    fileLinkSecret: keyFor(config, "chat-file-links-v1"),
    gifService: { apiUrl: config.GIF_API_URL, key: config.GIF_API_KEY },
  };
  const chatAfter = createChatAfterService({ ...chatDeps, after: createChatAfterRepository(db) });
  return {
    chat: createChatService(chatDeps),
    chatActions: createChatActionsService(chatDeps),
    chatPolls: createChatPollsService(chatDeps),
    chatFiles: createChatFilesService(chatDeps, storage),
    chatAfter,
    /** Chats (F14): the list and starting chats; meeting chats come from F03's after-meeting rules. */
    chats: createChatsService({
      chats: createChatsRepository(db),
      readableMeetings: (userId) => chatAfter.readable(userId),
    }),
    chatUpkeep: createChatUpkeepService({ ...chatDeps, upkeep: createChatUpkeepRepository(db), storage }),
    chatDeps,
  };
}

export function createMeetingPieces(wiring: MeetingWiring, limiter: RateLimiter) {
  const callsDeps = callsDepsFor(wiring, limiter);
  const shared = { ...callsDeps, repository: callsDeps.meetings };
  const chat = chatPieces(wiring, callsDeps);
  const callJobs = createCallJobs(callsDeps, {
    keepSimulated: wiring.config.CALLS_KEEP_SIMULATED_PEOPLE === "true",
    // Chat's own clean-up runs in the same minute-by-minute job (F03 design 3.4, 6).
    alsoCleanUp: () => chat.chatUpkeep.cleanUp(),
  });
  const { config, db } = wiring;
  const onChange = async (meetingId: string, change: { chatModeBy?: string } = {}) => {
    await refreshCall(callsDeps, meetingId);
    if (change.chatModeBy) await chat.chatUpkeep.modeChanged(meetingId, change.chatModeBy);
  };
  return {
    meetings: createMeetingsService({ ...shared, onChange }),
    lookups: createLookupService(shared),
    join: createJoinService(callsDeps),
    lobby: createLobbyService(callsDeps),
    rejoin: createRejoinService(callsDeps),
    controls: createControlsService(callsDeps),
    record: createRecordService(callsDeps.meetings, createRecordRepository(db)),
    webhooks: createWebhookService(callsDeps),
    ...chat,
    callJobs,
    /** The call services' shared pieces (tests build services with their own clock or call server). */
    callsDeps,
    /** Starts the call jobs (server.ts); from then on new calls get their 30-hour jobs. */
    startCallJobs: async () => {
      // F14 step 2 (D065): before serving, every meeting chat row gets its conversation; reads use it.
      await chat.chatUpkeep.fillConversations();
      const started = await startCallJobs({ host: config.REDIS_HOST, port: config.REDIS_PORT }, callJobs);
      callsDeps.scheduler.schedule = started.schedule;
      return started;
    },
  };
}
