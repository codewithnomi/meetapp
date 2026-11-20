// When a meeting stops working (F02 design.md section 3.1, AC-F02-04, as in Teams): a Meet now meeting
// 60 days after it was made, never moved; a link meeting 60 days after it was last joined or changed;
// a scheduled meeting 60 days after its last occurrence ends, never while a series without end repeats
// (F13, D093). Waiting in the lobby or being denied is not joining.
export const MEETING_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;

export type MeetingKind = "meet_now" | "link" | "scheduled";

/** A series without an end date: far enough that it never expires while it repeats. */
export const NEVER = new Date("9999-12-31T00:00:00Z");

/** The expiry a new meeting gets. */
export const firstExpiry = (createdAt: Date) => new Date(createdAt.getTime() + MEETING_LIFETIME_MS);

/** A scheduled meeting's expiry from its last occurrence's end; undefined = repeats with no end date. */
export const scheduledExpiry = (lastEnd: Date | undefined) =>
  lastEnd ? new Date(lastEnd.getTime() + MEETING_LIFETIME_MS) : NEVER;

/**
 * The expiry after a join into the call or a change of the title or an option: link meetings get
 * another 60 days from now; Meet now and scheduled meetings keep theirs (a schedule change sets it again).
 */
export function extendedExpiry(kind: MeetingKind, current: Date, now: Date): Date {
  if (kind !== "link") return current;
  const extended = new Date(now.getTime() + MEETING_LIFETIME_MS);
  return extended > current ? extended : current;
}

/** Expired exactly at the 60-day mark. */
export const isExpired = (expiresAt: Date, now: Date) => now.getTime() >= expiresAt.getTime();
