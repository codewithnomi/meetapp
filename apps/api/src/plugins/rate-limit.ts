// Rate limits for signing in (AC-F01-13, security rule S5, design.md section 9). Fixed time windows
// counted in Redis. Emails are counted under a keyed fingerprint (HMAC) of the trimmed, lower-cased
// address, so Redis never holds the plain email, and every email is counted the same way whether or
// not it has an account, so a refusal reveals nothing. If Redis can't be reached, requests are let
// through and the problem is reported: Better Auth's own per-address limiter stays as a second layer.
import { createHmac, hkdfSync } from "node:crypto";

export interface RateRule {
  name: string;
  limit: number;
  windowSeconds: number;
}

export const RATE_RULES = {
  /** Wrong passwords per email: 5 in 15 minutes (Google/Microsoft attempts count too). */
  wrongPassword: { name: "wrong-password", limit: 5, windowSeconds: 15 * 60 },
  /** Code emails per address, sign-up, sign-in and reset together: 5 an hour. */
  codeEmails: { name: "code-emails", limit: 5, windowSeconds: 60 * 60 },
  /** Sign-ups per network address: 50 an hour (an office shares one address). */
  signUps: { name: "sign-ups", limit: 50, windowSeconds: 60 * 60 },
} as const satisfies Record<string, RateRule>;

/** The few Redis commands the limiter uses (ioredis has them). */
export interface CounterStore {
  incr: (key: string) => Promise<number>;
  get: (key: string) => Promise<string | null>;
  pexpire: (key: string, milliseconds: number) => Promise<number>;
}

export interface RateLimiterOptions {
  store: CounterStore;
  /** DATA_ENCRYPTION_KEY: the HMAC key is derived from it (its own purpose label). */
  secret: string;
  now?: () => number;
  onStoreError?: (error: unknown) => void;
}

/** The current window of a rule: its number, length, and seconds until it ends. */
function windowAt(rule: RateRule, at: number) {
  const size = rule.windowSeconds * 1_000;
  const index = Math.floor(at / size);
  return { index, size, retryAfter: Math.ceil(((index + 1) * size - at) / 1_000) };
}

/** Undefined: go ahead. A number: refused, try again after this many seconds. */
type Verdict = number | undefined;

export function createRateLimiter({
  store,
  secret,
  now = () => Date.now(),
  onStoreError = () => {},
}: RateLimiterOptions) {
  const hmacKey = Buffer.from(hkdfSync("sha256", secret, "meetapp", "rate-limit-v1", 32));
  const subjectOf = (value: string) => createHmac("sha256", hmacKey).update(value.trim().toLowerCase()).digest("hex");

  const keyOf = (rule: RateRule, subject: string, index: number) =>
    `rate:${rule.name}:${subjectOf(subject)}:${String(index)}`;

  async function safely(work: () => Promise<Verdict>): Promise<Verdict> {
    try {
      return await work();
    } catch (error) {
      onStoreError(error);
      return undefined;
    }
  }

  return {
    /** Is this subject already over the limit (without counting this request)? */
    blocked: (rule: RateRule, subject: string): Promise<Verdict> =>
      safely(async () => {
        const { index, retryAfter } = windowAt(rule, now());
        const count = Number((await store.get(keyOf(rule, subject, index))) ?? 0);
        return count >= rule.limit ? retryAfter : undefined;
      }),
    /** Counts one event (for example a failed sign-in). */
    hit: async (rule: RateRule, subject: string): Promise<void> => {
      await safely(async () => {
        const { index, size } = windowAt(rule, now());
        const key = keyOf(rule, subject, index);
        if ((await store.incr(key)) === 1) await store.pexpire(key, size);
        return undefined;
      });
    },
    /** Counts this request and says whether it is over the limit. */
    take: (rule: RateRule, subject: string): Promise<Verdict> =>
      safely(async () => {
        const { index, size, retryAfter } = windowAt(rule, now());
        const key = keyOf(rule, subject, index);
        const count = await store.incr(key);
        if (count === 1) await store.pexpire(key, size);
        return count > rule.limit ? retryAfter : undefined;
      }),
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
