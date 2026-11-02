// Where status comes from (F14 design 3.8): each open live line's last action, lock state and last
// word, kept in Redis so every API server sees them, plus when the person's last line closed, and the
// status last announced (so a change is announced once).
import type { Status } from "@meetapp/contracts";
import type { Redis } from "ioredis";
import type { LinePresence } from "./chats-status.ts";

const key = (userId: string) => `meetapp:chats:presence:${userId}`;
const CLOSED = "closedAt";
const ANNOUNCED = "announced";
/** A person with no line for a day needs no record. */
const KEEP_SECONDS = 24 * 60 * 60;

export function createPresenceStore(redis: Redis) {
  const write = async (userId: string, fields: Record<string, string>) => {
    await redis.hset(key(userId), fields);
    await redis.expire(key(userId), KEEP_SECONDS);
  };
  return {
    line: (userId: string, lineId: string, line: LinePresence) =>
      write(userId, { [`line:${lineId}`]: JSON.stringify(line) }),
    closed: async (userId: string, lineId: string, at: number) => {
      await redis.hdel(key(userId), `line:${lineId}`);
      await write(userId, { [CLOSED]: String(at) });
    },
    read: async (userId: string) => {
      const all = await redis.hgetall(key(userId));
      const lines = Object.entries(all)
        .filter(([field]) => field.startsWith("line:"))
        .map(([, value]) => JSON.parse(value) as LinePresence);
      const closed = all[CLOSED];
      return { lines, closedAt: closed ? Number(closed) : null, announced: (all[ANNOUNCED] ?? null) as Status | null };
    },
    announced: (userId: string, status: Status) => write(userId, { [ANNOUNCED]: status }),
  };
}

export type PresenceStore = ReturnType<typeof createPresenceStore>;
