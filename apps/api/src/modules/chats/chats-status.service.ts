// Status for the people a person may see (F14 AC-F14-26, design 3.8): colleagues and accepted contacts,
// never blocked people or pending requests. A change is announced once on the person's status channel;
// each live line forwards it only if its person may see it.
import { MANUAL_STATUS_MAX_MS, type ManualStatus, type Status } from "@meetapp/contracts";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { ManualStatusRepository } from "./chats-manual-status.repository.ts";
import type { LivePublisher } from "./chats-live.ts";
import type { PresenceStore } from "./chats-presence.ts";
import type { ChatsRequestsRepository } from "./chats-requests.repository.ts";
import { manualOf, statusOf } from "./chats-status.ts";

export interface StatusDeps {
  requests: ChatsRequestsRepository;
  presence: PresenceStore;
  live: LivePublisher;
  now: () => Date;
  /** F04: statuses set by hand, and the job that ends one when it runs out (replaced once jobs start). */
  manual: ManualStatusRepository;
  limiter: RateLimiter;
  expiry: { schedule: (userId: string, at: Date) => Promise<void> };
}

export interface StatusChoice {
  status: ManualStatus | null;
  until: string | null;
}

async function current(deps: StatusDeps, userIds: string[]) {
  const [inCall, manual] = await Promise.all([deps.requests.inCall(userIds), deps.manual.read(userIds)]);
  const now = deps.now().getTime();
  return new Map(
    await Promise.all(
      userIds.map(async (id) => {
        const presence = await deps.presence.read(id);
        return [id, statusOf({ ...presence, inCall: inCall.has(id), manual: manual.get(id) ?? null }, now)] as const;
      }),
    ),
  );
}

const badInput = () => new AppError(400, "BAD_REQUEST", "Choose a status and a time within 8 days.");

/** The end of a hand-set status, checked: in the future and at most 8 days ahead (design 3.3). */
function endOf(until: string | null, now: Date): Date | null {
  if (until === null) return null;
  const end = new Date(until);
  const ahead = end.getTime() - now.getTime();
  if (Number.isNaN(ahead) || ahead <= 0 || ahead > MANUAL_STATUS_MAX_MS) throw badInput();
  return end;
}

/** F04 AC-F04-20, 21: sets (or with `status: null` resets) the person's status, and announces it. */
async function choose(
  deps: StatusDeps,
  announce: (userId: string) => Promise<void>,
  userId: string,
  choice: StatusChoice,
) {
  const wait = await deps.limiter.take(RATE_RULES.myStatus, userId);
  if (wait !== undefined)
    throw new AppError(429, "TOO_MANY_ATTEMPTS", "Too many status changes. Try again soon.", wait);
  const now = deps.now();
  const until = choice.status === null ? null : endOf(choice.until, now);
  await deps.manual.set(userId, choice.status === null ? null : { status: choice.status, until });
  // Announced first: the saved choice reaches others even if the end-of-status job can't be queued.
  await announce(userId);
  if (until) await deps.expiry.schedule(userId, until);
  return mine(deps, userId);
}

/** The person's own status as others see it, and when a hand-set one ends. */
async function mine(deps: StatusDeps, userId: string) {
  const status = (await current(deps, [userId])).get(userId) ?? "offline";
  const manual = (await deps.manual.read([userId])).get(userId);
  const chosen = manual ? manualOf({ manual }, deps.now().getTime()) : null;
  return { status, chosen, until: chosen && manual?.until ? manual.until.toISOString() : null };
}

export function createChatsStatusService(deps: StatusDeps) {
  const announce = async (userId: string) => {
    const status = (await current(deps, [userId])).get(userId) ?? "offline";
    if ((await deps.presence.read(userId)).announced === status) return;
    await deps.presence.announced(userId, status);
    await deps.live.status(userId, status);
  };
  return {
    /** The statuses of these people that `viewer` may see; the others are left out. */
    visible: async (viewer: string, userIds: string[]): Promise<Map<string, Status>> => {
      const audience = await deps.requests.statusAudience(viewer);
      return current(
        deps,
        [...new Set(userIds)].filter((id) => audience.has(id)),
      );
    },
    /** Works the person's status out again and announces it when it changed. */
    announce,
    choose: (userId: string, choice: StatusChoice) => choose(deps, announce, userId, choice),
    mine: (userId: string) => mine(deps, userId),
    /** The expiry job: a status that ran out is cleared and the change announced (AC-F04-21). */
    runOut: async (userId: string) => {
      await deps.manual.clearIfOver(userId, deps.now());
      await announce(userId);
    },
    audience: (viewer: string) => deps.requests.statusAudience(viewer),
  };
}

export type ChatsStatusService = ReturnType<typeof createChatsStatusService>;
