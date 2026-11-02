// What the ring service needs (F15 design 3.3), shared with Add people so neither imports the other.
import type { CallsDeps } from "./admission.ts";
import type { ChatCallsRepository } from "./chat-calls.repository.ts";
import type { ChatCallsService, ChatPlace } from "./chat-calls.service.ts";
import type { RingTarget } from "./ring-targets.ts";

export interface RingDeps {
  calls: CallsDeps;
  chatCalls: ChatCallsRepository;
  place: (userId: string, conversationId: string) => Promise<ChatPlace>;
  targets: RingTarget;
  /** "Missed call from <caller>", for the person who missed it (AC-F15-15). */
  missed: (
    conversation: { id: string; workspaceId: string },
    caller: { id: string; name: string },
    callId: string,
    forUserId: string,
  ) => Promise<void>;
  /** Joins the chat's running call (the chat-calls service). */
  join: ChatCallsService["join"];
}
