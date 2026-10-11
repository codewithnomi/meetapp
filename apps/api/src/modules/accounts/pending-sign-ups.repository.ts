// Sign-ups waiting for their email code (F01 design.md section 3), kept in Redis. Each has its own
// random id, so a second sign-up for the same email never changes the first (AC-F01-02).
// Kept 30 minutes; the code itself works for 15 (the record knows when), so "expired" can be told
// apart from "unknown".
export interface PendingSignUp {
  email: string;
  name: string;
  passwordHash: string;
  termsVersion: string;
  theme: string | null;
  accent: string | null;
  /** SHA-256 of "<signupId>:<code>"; the code itself is never stored. */
  codeHash: string;
  /** Wrong codes so far; at 5 the record stops accepting codes. */
  attempts: number;
  /** When the current code stops working (ms since 1970). */
  codeExpiresAt: number;
  /** The email already had an account: no code was sent and none can match. */
  existing: boolean;
}

export interface KeyValueStore {
  set: (key: string, value: string, mode: "PX", milliseconds: number) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
}

const KEEP_MS = 30 * 60 * 1_000;
const keyOf = (signupId: string) => `signup:${signupId}`;

export function createPendingSignUpsRepository(store: KeyValueStore) {
  return {
    save: async (signupId: string, record: PendingSignUp) => {
      await store.set(keyOf(signupId), JSON.stringify(record), "PX", KEEP_MS);
    },
    load: async (signupId: string): Promise<PendingSignUp | undefined> => {
      const value = await store.get(keyOf(signupId));
      return value === null ? undefined : (JSON.parse(value) as PendingSignUp);
    },
    remove: async (signupId: string) => {
      await store.del(keyOf(signupId));
    },
  };
}

export type PendingSignUpsRepository = ReturnType<typeof createPendingSignUpsRepository>;
