// Feature flags with a short cache (AC-F00-34): the database is asked at most every 10 s, so a
// change made with `pnpm flag` is visible within 10 s, and the apps (polling every 15 s) within 30 s.
import type { Flag } from "@meetapp/contracts";

export const FLAGS_CACHE_MS = 10_000;

export interface FlagsSource {
  list(): Promise<Flag[]>;
}

export function createFlagsService(source: FlagsSource, cacheMs = FLAGS_CACHE_MS, now: () => number = Date.now) {
  let cached: { flags: Flag[]; at: number } | undefined;
  // Requests arriving together after the cache expires share one database read.
  let pending: Promise<Flag[]> | undefined;
  async function refresh(): Promise<Flag[]> {
    try {
      const flags = await source.list();
      cached = { flags, at: now() };
      return flags;
    } finally {
      pending = undefined;
    }
  }
  return {
    async list(): Promise<Flag[]> {
      if (cached && now() - cached.at < cacheMs) return cached.flags;
      pending ??= refresh();
      return pending;
    },
  };
}

export type FlagsService = ReturnType<typeof createFlagsService>;
