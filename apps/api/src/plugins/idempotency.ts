// Idempotency keys (F01 design.md sections 7 and 11, AC-F01-29): a create request sent again with the
// same `Idempotency-Key` (a double click, a retry after a timeout) returns the first result instead of
// making a second thing. Kept in Redis for 10 minutes, per caller. A second copy that arrives while the
// first is still running waits for its result.
import type { Redis } from "ioredis";

export interface IdempotencyStore {
  /** Stores `value` only if the key is free; true when it was free. */
  claim: (key: string, value: string, milliseconds: number) => Promise<boolean>;
  put: (key: string, value: string, milliseconds: number) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
}

export function redisIdempotencyStore(redis: Redis): IdempotencyStore {
  return {
    claim: async (key, value, milliseconds) => (await redis.set(key, value, "PX", milliseconds, "NX")) === "OK",
    put: (key, value, milliseconds) => redis.set(key, value, "PX", milliseconds),
    get: (key) => redis.get(key),
    del: (key) => redis.del(key),
  };
}

const KEEP_MS = 10 * 60 * 1_000;
const RUNNING = "running";
const POLL_MS = 50;
const WAIT_MS = 10_000;

export interface IdempotencyOptions {
  store: IdempotencyStore;
  sleep?: (ms: number) => Promise<void>;
}

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function createIdempotency({ store, sleep = pause }: IdempotencyOptions) {
  /** The first copy's result once it is stored; undefined if the first copy failed (it was removed). */
  async function waitForFirst<T>(key: string): Promise<T | undefined> {
    for (let waited = 0; waited < WAIT_MS; waited += POLL_MS) {
      const stored = await store.get(key);
      if (stored === null) return undefined;
      if (stored !== RUNNING) return JSON.parse(stored) as T;
      await sleep(POLL_MS);
    }
    throw new Error("the first request with this idempotency key did not finish");
  }

  /** Runs `work` once per (scope, key); without a key it simply runs. Results must be JSON. */
  async function once<T>(scope: string, key: string | undefined, work: () => Promise<T>): Promise<T> {
    if (key === undefined) return work();
    const storeKey = `idempotency:${scope}:${key}`;
    if (!(await store.claim(storeKey, RUNNING, KEEP_MS))) {
      const first = await waitForFirst<T>(storeKey);
      if (first !== undefined) return first;
      return once(scope, key, work);
    }
    let result: T;
    try {
      result = await work();
    } catch (error) {
      // A refused or failed request can be tried again with the same key.
      await store.del(storeKey);
      throw error;
    }
    // The work is done. If its result can't be stored, the key stays marked "running" until it expires,
    // so a repeat is refused instead of doing the work a second time.
    await store.put(storeKey, JSON.stringify(result), KEEP_MS);
    return result;
  }

  return { once };
}

export type Idempotency = ReturnType<typeof createIdempotency>;
