// Finding a meeting (F02 design.md section 3.2; AC-F02-04, 07, 08, 48). A link, or an ID and passcode,
// leads to one meeting. Any miss gives the same 404 after the same minimum time, so a guesser learns
// nothing. Tries are counted before the check, per person (or app) and per network address, and given
// back on a hit, so only wrong ones count. Wrong passcodes are also counted per meeting ID, so many
// addresses together can't guess one meeting's passcode; such an ID then waits a minute (the link still
// works). The right secret of an expired meeting says so: only someone who has it learns that.
import { timingSafeEqual } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import { AppError } from "../../plugins/errors.ts";
import { RATE_RULES, type RateLimiter } from "../../plugins/rate-limit.ts";
import type { LookupTokens } from "./lookup-token.ts";
import { normaliseMeetingNumber, type MeetingSecretBox } from "./meeting-secrets.ts";
import type { MeetingsRepository } from "./meetings.repository.ts";
import { isUsable } from "./meetings.service.ts";

/** Every lookup takes at least this long, hit or miss (TC-F02-17). */
export const LOOKUP_MIN_MS = 300;

export interface LookupRequest {
  link?: string | undefined;
  meetingNumber?: string | undefined;
  passcode?: string | undefined;
  userId: string | undefined;
  deviceKey?: string | undefined;
  address: string;
}

export interface LookupDeps {
  repository: MeetingsRepository;
  secrets: MeetingSecretBox;
  lookupTokens: LookupTokens;
  limiter: RateLimiter;
  now?: () => Date;
  minMs?: number;
}

const notFound = () =>
  new AppError(404, "MEETING_NOT_FOUND", "We couldn't find that meeting. Check the link, or the ID and passcode.");
const tooMany = (wait: number) =>
  new AppError(429, "TOO_MANY_ATTEMPTS", "Too many tries. Wait a minute, then try again.", wait);
const idWaits = (wait: number) =>
  new AppError(429, "TOO_MANY_ATTEMPTS", "Too many tries for this meeting ID. Wait a minute or use the link.", wait);

const sameHash = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** Member of the meeting's workspace, someone else with an account, or a guest (AC-F02-14). */
export async function groupOf(
  repository: MeetingsRepository,
  workspaceId: string,
  userId: string | undefined,
): Promise<"member" | "external" | "guest"> {
  if (!userId) return "guest";
  return (await repository.membersAmong(workspaceId, [userId])).length === 1 ? "member" : "external";
}

export function createLookupService(deps: LookupDeps) {
  const { repository, secrets, limiter, now = () => new Date(), minMs = LOOKUP_MIN_MS } = deps;

  /** The meeting a link or ID+passcode names, or undefined (a wrong passcode is counted per ID). */
  async function match(request: LookupRequest): Promise<string | undefined> {
    if (request.link?.trim()) return repository.idByLinkLookup(secrets.linkLookup(request.link));
    const number = normaliseMeetingNumber(request.meetingNumber ?? "");
    if (!/^\d{12}$/.test(number) || !request.passcode) return undefined;
    const waiting = await limiter.blocked(RATE_RULES.meetingIdWrongPasscodes, number);
    if (waiting !== undefined) throw idWaits(waiting);
    const found = await repository.byNumber(number);
    const check = secrets.passcodeCheck(number, request.passcode);
    if (found && sameHash(found.passcodeCheck, check)) return found.id;
    await limiter.take(RATE_RULES.meetingIdWrongPasscodes, number);
    return undefined;
  }

  async function find(request: LookupRequest) {
    const person = request.userId ?? request.deviceKey ?? request.address;
    const counted = [
      await limiter.take(RATE_RULES.meetingLookupPerPerson, person),
      await limiter.take(RATE_RULES.meetingLookupPerAddress, request.address),
    ].find((wait) => wait !== undefined);
    if (counted !== undefined) throw tooMany(counted);
    const meetingId = await match(request);
    const row = meetingId ? await repository.find(meetingId) : undefined;
    if (!row) throw notFound();
    await limiter.refund(RATE_RULES.meetingLookupPerPerson, person);
    await limiter.refund(RATE_RULES.meetingLookupPerAddress, request.address);
    if (!isUsable(row, now())) throw new AppError(410, "MEETING_EXPIRED", "This meeting has expired.");
    const group = await groupOf(repository, row.meeting.workspaceId, request.userId);
    const lookupToken = deps.lookupTokens.issue({ meetingId: row.meeting.id, userId: request.userId ?? null });
    return { title: row.meeting.title, group, lookupToken };
  }

  return {
    /** Same minimum time for every answer, hit, miss or refusal. */
    lookup: async (request: LookupRequest) => {
      const started = performance.now();
      try {
        return await find(request);
      } finally {
        const left = minMs - (performance.now() - started);
        if (left > 0) await sleep(left);
      }
    },
  };
}

export type LookupService = ReturnType<typeof createLookupService>;
