// Google/Microsoft sign-ins started by the desktop app (F01 design.md section 4), kept in Redis under a
// random request id. The record holds only a SHA-256 of the app's secret verifier, never the verifier.
// Kept a little over the 5-minute limit; the record knows when it started, so "expired" is checked in code.
import type { SignInProvider } from "@meetapp/contracts";

export type DesktopSignInStatus = "new" | "started" | "returned" | "ready" | "cancelled";

export interface DesktopSignIn {
  provider: SignInProvider;
  /** SHA-256 (hex) of the app's secret verifier. */
  challenge: string;
  /** The 4-digit code shown in the app and on the browser page. */
  matchCode: string;
  /** When the app asked (ms since 1970). */
  createdAt: number;
  status: DesktopSignInStatus;
  /** Who signed in at the provider (from "returned" on). */
  userId?: string;
  email?: string;
  /** The account was created by this sign-in, so a cancel removes it again (AC-F01-07). */
  newUser?: boolean;
  /** Why it was cancelled: SIGN_IN_CANCELLED, PROVIDER_EMAIL_UNVERIFIED or TOO_MANY_ATTEMPTS. */
  reason?: string;
}

export interface DesktopSignInStore {
  set: (key: string, value: string, mode: "PX", milliseconds: number) => Promise<unknown>;
  get: (key: string) => Promise<string | null>;
  getdel: (key: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
}

const KEEP_MS = 6 * 60 * 1_000;
const keyOf = (requestId: string) => `desktop-sign-in:${requestId}`;
const parse = (value: string | null) => (value === null ? undefined : (JSON.parse(value) as DesktopSignIn));

export function createDesktopSignInsRepository(store: DesktopSignInStore) {
  return {
    save: async (requestId: string, record: DesktopSignIn) => {
      await store.set(keyOf(requestId), JSON.stringify(record), "PX", KEEP_MS);
    },
    load: async (requestId: string) => parse(await store.get(keyOf(requestId))),
    /** Reads and deletes in one step, so a finished sign-in can be collected only once. */
    take: async (requestId: string) => parse(await store.getdel(keyOf(requestId))),
    remove: async (requestId: string) => {
      await store.del(keyOf(requestId));
    },
  };
}

export type DesktopSignInsRepository = ReturnType<typeof createDesktopSignInsRepository>;
