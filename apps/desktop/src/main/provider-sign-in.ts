// Google/Microsoft sign-in from the desktop app (F01 design.md section 4, AC-F01-07). Main makes a
// secret verifier and sends only its SHA-256; it opens the backend's start link in the computer's
// browser, then asks every second whether the person has confirmed there. It gives up after 5
// minutes, or at once on Cancel. One sign-in at a time. Free of Electron imports.
import { createHash, randomBytes } from "node:crypto";
import { failureOf, type AuthClient, type AuthResult, type Failure } from "./auth-client.ts";
import type { TokenStore } from "./auth-token.ts";

const POLL_MS = 1_000;
const LIMIT_MS = 5 * 60 * 1_000;
const CANCELLED: Failure = { ok: false, code: "SIGN_IN_CANCELLED" };

export interface ProviderSignInDependencies {
  client: AuthClient;
  tokens: TokenStore;
  /** Opens the start link in the computer's browser; false when the link isn't one main may open. */
  openInBrowser: (url: string) => Promise<boolean>;
  now?: () => number;
  wait?: (ms: number) => Promise<void>;
}

interface Pending {
  requestId: string;
  verifier: string;
  startedAt: number;
}

/** Asks the backend for a sign-in request and opens its start link in the browser. */
async function begin(
  deps: ProviderSignInDependencies,
  provider: "google" | "microsoft",
  startedAt: number,
): Promise<{ pending: Pending; matchCode: string } | Failure> {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  const body = { provider, challenge };
  const answer = await deps.client.call("/api/v1/auth/desktop/init", { body }).catch(() => undefined);
  if (answer === undefined) return { ok: false, code: "NETWORK_ERROR" };
  if (answer.status !== 200) return failureOf(answer);
  const { requestId, matchCode, startUrl } = answer.body as { requestId: string; matchCode: string; startUrl: string };
  if (!(await deps.openInBrowser(startUrl))) return CANCELLED;
  return { pending: { requestId, verifier, startedAt }, matchCode };
}

/** One question to the backend: undefined while the person hasn't finished in the browser. */
async function exchange(deps: ProviderSignInDependencies, current: Pending): Promise<AuthResult | undefined> {
  const body = { requestId: current.requestId, verifier: current.verifier };
  const answer = await deps.client.call("/api/v1/auth/desktop/exchange", { body }).catch(() => undefined);
  if (answer === undefined || answer.status === 202) return undefined;
  if (answer.status !== 200 || answer.token === null) return answer.status === 404 ? CANCELLED : failureOf(answer);
  deps.tokens.set(answer.token);
  return deps.client.status();
}

export function createProviderSignIn(deps: ProviderSignInDependencies) {
  const now = deps.now ?? (() => Date.now());
  const wait = deps.wait ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  let pending: Pending | undefined;

  async function cancel(): Promise<{ ok: true }> {
    const current = pending;
    pending = undefined;
    if (current) {
      const body = { requestId: current.requestId, verifier: current.verifier };
      await deps.client.call("/api/v1/auth/desktop/cancel", { body }).catch(() => undefined);
    }
    return { ok: true };
  }

  return {
    /** Starts a sign-in; answers with the 4-digit code the browser page will show too. */
    async start(provider: "google" | "microsoft"): Promise<{ ok: true; matchCode: string } | Failure> {
      await cancel();
      const begun = await begin(deps, provider, now());
      if ("ok" in begun) return begun;
      pending = begun.pending;
      return { ok: true, matchCode: begun.matchCode };
    },

    /** Waits until the person confirms or cancels in the browser, Cancel is pressed, or 5 minutes pass. */
    async finish(): Promise<AuthResult> {
      for (;;) {
        const current = pending;
        if (!current) return CANCELLED;
        if (now() - current.startedAt > LIMIT_MS) return (await cancel(), CANCELLED);
        const result = await exchange(deps, current);
        if (result) {
          if (pending === current) pending = undefined;
          return result;
        }
        await wait(POLL_MS);
      }
    },

    cancel,
  };
}

export type ProviderSignIn = ReturnType<typeof createProviderSignIn>;
