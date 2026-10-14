// When a meeting stops working (F02 design.md section 3.1, AC-F02-04, as in Teams): a Meet now meeting
// 60 days after it was made, never moved; a link meeting 60 days after it was last joined or changed.
// Waiting in the lobby or being denied is not joining.
export const MEETING_LIFETIME_MS = 60 * 24 * 60 * 60 * 1000;

export type MeetingKind = "meet_now" | "link";

/** The expiry a new meeting gets. */
export const firstExpiry = (createdAt: Date) => new Date(createdAt.getTime() + MEETING_LIFETIME_MS);

/**
 * The expiry after a join into the call or a change of the title or an option: link meetings get
 * another 60 days from now; Meet now meetings keep theirs.
 */
export function extendedExpiry(kind: MeetingKind, current: Date, now: Date): Date {
  if (kind === "meet_now") return current;
  const extended = new Date(now.getTime() + MEETING_LIFETIME_MS);
  return extended > current ? extended : current;
}

/** Expired exactly at the 60-day mark. */
export const isExpired = (expiresAt: Date, now: Date) => now.getTime() >= expiresAt.getTime();
