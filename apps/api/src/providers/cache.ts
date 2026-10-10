// Redis connection (design.md section 9 "Reconnect"): commands fail fast while Redis is away
// (no offline queue, one retry), and the client keeps reconnecting in the background.
import { Redis } from "ioredis";
import type { FastifyBaseLogger } from "fastify";
import type { Config } from "../config/config.ts";

const MAX_RECONNECT_DELAY_MS = 2000;

export function createCacheProvider(config: Config, log: FastifyBaseLogger) {
  const redis = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 1500,
    retryStrategy: (attempt) => Math.min(attempt * 200, MAX_RECONNECT_DELAY_MS),
  });
  let reported = false;
  redis.on("error", (error) => {
    if (!reported) log.warn({ err: error }, "cache connection lost; reconnecting in the background");
    reported = true;
  });
  redis.on("ready", () => {
    reported = false;
  });
  return {
    redis,
    ping: async () => {
      await redis.ping();
    },
    close: async () => {
      redis.disconnect();
    },
  };
}
