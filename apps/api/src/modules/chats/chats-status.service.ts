// Status for the people a person may see (F14 AC-F14-26, design 3.8): colleagues and accepted contacts,
// never blocked people or pending requests. A change is announced once on the person's status channel;
// each live line forwards it only if its person may see it.
import type { Status } from "@meetapp/contracts";
import type { LivePublisher } from "./chats-live.ts";
import type { PresenceStore } from "./chats-presence.ts";
import type { ChatsRequestsRepository } from "./chats-requests.repository.ts";
import { statusOf } from "./chats-status.ts";

export interface StatusDeps {
  requests: ChatsRequestsRepository;
  presence: PresenceStore;
  live: LivePublisher;
  now: () => Date;
}

async function current(deps: StatusDeps, userIds: string[]) {
  const inCall = await deps.requests.inCall(userIds);
  const now = deps.now().getTime();
  return new Map(
    await Promise.all(
      userIds.map(async (id) => {
        const presence = await deps.presence.read(id);
        return [id, statusOf({ ...presence, inCall: inCall.has(id) }, now)] as const;
      }),
    ),
  );
}

export function createChatsStatusService(deps: StatusDeps) {
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
    announce: async (userId: string) => {
      const status = (await current(deps, [userId])).get(userId) ?? "offline";
      if ((await deps.presence.read(userId)).announced === status) return;
      await deps.presence.announced(userId, status);
      await deps.live.status(userId, status);
    },
    audience: (viewer: string) => deps.requests.statusAudience(viewer),
  };
}

export type ChatsStatusService = ReturnType<typeof createChatsStatusService>;
