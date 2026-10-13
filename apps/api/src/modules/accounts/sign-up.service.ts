// Creating an account with an emailed code (F01 design.md section 3, AC-F01-01, 02, 04, 14).
// The account exists only after the right code. An email that already has an account gets exactly the
// same answer (its owner gets a notice instead of a code), and the password is always hashed, so
// neither the answer nor its timing reveals which emails have accounts.
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import type { Outbox } from "../../emails/outbox.ts";
import { AppError, tooManyAttempts } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { AccountsRepository } from "./accounts.repository.ts";
import { PASSWORD_MESSAGES, checkPassword } from "./password-rule.ts";
import type { PendingSignUp, PendingSignUpsRepository } from "./pending-sign-ups.repository.ts";

/** The terms everyone agrees to; placeholder pages until the real documents exist (AC-F01-01). */
export const TERMS_VERSION = "draft-1";
const CODE_MS = 15 * 60 * 1_000;
const MAX_TRIES = 5;
const UNIQUE_VIOLATION = "23505";

export interface SignUpRequest {
  email: string;
  name: string;
  password: string;
  theme?: string | undefined;
  accent?: string | undefined;
}

export interface SignUpDependencies {
  accounts: AccountsRepository;
  pending: PendingSignUpsRepository;
  outbox: Outbox;
  limiter?: RateLimiter | undefined;
  hashPassword: (password: string) => Promise<string>;
  /** A new session for the user; returns the token the desktop app keeps. */
  issueSession: (userId: string) => Promise<string>;
  now?: () => number;
}

const codeHash = (signupId: string, code: string) => createHash("sha256").update(`${signupId}:${code}`).digest();
const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, "0");
const invalid = () => new AppError(400, "CODE_INVALID", "That code isn't right.");

/** PostgreSQL's "already exists" error, also when the database library wraps it (as `cause`). */
function isUniqueViolation(error: unknown): boolean {
  const { code, cause } = (error ?? {}) as { code?: unknown; cause?: unknown };
  return code === UNIQUE_VIOLATION || (cause !== undefined && isUniqueViolation(cause));
}

function sameHash(stored: string, signupId: string, code: string): boolean {
  return timingSafeEqual(Buffer.from(stored, "hex"), codeHash(signupId, code));
}

type Rule = (typeof RATE_RULES)[keyof typeof RATE_RULES];
type Clock = () => number;

async function limit(deps: SignUpDependencies, rule: Rule, subject: string): Promise<void> {
  const wait = await deps.limiter?.take(rule, subject);
  if (wait !== undefined) throw tooManyAttempts(wait);
}

type NewRecord = Omit<PendingSignUp, "codeHash" | "codeExpiresAt">;

/** A code for the record: emailed for a new email; for an existing one, nothing can ever match. */
async function freshCode(deps: SignUpDependencies, now: Clock, signupId: string, record: NewRecord): Promise<void> {
  const code = newCode();
  await deps.pending.save(signupId, {
    ...record,
    codeHash: codeHash(signupId, record.existing ? randomUUID() : code).toString("hex"),
    codeExpiresAt: now() + CODE_MS,
  });
  if (!record.existing) {
    await deps.outbox.enqueue({ to: record.email, template: { kind: "code", purpose: "sign-up", code } });
  } else if ((await deps.limiter?.take(RATE_RULES.someoneTried, record.email)) === undefined) {
    await deps.outbox.enqueue({ to: record.email, template: { kind: "someoneTried" } });
  }
}

async function start(deps: SignUpDependencies, now: Clock, request: SignUpRequest, address: string): Promise<string> {
  const problem = checkPassword(request.password);
  if (problem) throw new AppError(400, "PASSWORD_WEAK", PASSWORD_MESSAGES[problem]);
  const email = request.email.trim().toLowerCase();
  await limit(deps, RATE_RULES.signUps, address);
  await limit(deps, RATE_RULES.codeEmails, email);
  // Hashed on both paths, so the answer takes as long whether or not the email has an account.
  const passwordHash = await deps.hashPassword(request.password);
  const existing = await deps.accounts.emailTaken(email);
  const signupId = randomUUID();
  const { theme, accent } = request;
  await freshCode(deps, now, signupId, {
    email,
    name: request.name.trim(),
    passwordHash,
    termsVersion: TERMS_VERSION,
    theme: theme ?? null,
    accent: accent ?? null,
    existing,
  });
  return signupId;
}

async function verify(deps: SignUpDependencies, now: Clock, signupId: string, code: string) {
  const record = await deps.pending.load(signupId);
  if (!record) throw invalid();
  if (now() > record.codeExpiresAt)
    throw new AppError(400, "CODE_EXPIRED", "This code has expired. Ask for a new one.");
  // Counted before the check, so a burst of guesses can't get more than MAX_TRIES at one code.
  if ((await deps.pending.countTry(signupId, record.codeHash)) > MAX_TRIES) throw invalid();
  if (!sameHash(record.codeHash, signupId, code)) throw invalid();
  let userId: string;
  try {
    userId = await deps.accounts.createAccount(record, new Date(now()));
  } catch (error) {
    // Someone else finished a sign-up for this email first (or this one was sent twice).
    if (isUniqueViolation(error)) throw invalid();
    throw error;
  }
  await deps.pending.remove(signupId);
  return { userId, token: await deps.issueSession(userId) };
}

export function createSignUpService(deps: SignUpDependencies) {
  const now = deps.now ?? (() => Date.now());
  return {
    start: (request: SignUpRequest, networkAddress: string) => start(deps, now, request, networkAddress),
    /** Send a new code: the old one stops working. Unknown ids get the same quiet answer. */
    resend: async (signupId: string): Promise<void> => {
      const record = await deps.pending.load(signupId);
      if (!record) return;
      await limit(deps, RATE_RULES.codeEmails, record.email);
      await freshCode(deps, now, signupId, record);
    },
    verify: (signupId: string, code: string) => verify(deps, now, signupId, code),
  };
}

export type SignUpService = ReturnType<typeof createSignUpService>;
