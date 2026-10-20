// The words for a meeting error (canvas "Messages", AC-F02-08): a miss says what to check, an expired
// meeting says so, too many tries says when to try again. Anything else uses the app's usual texts.
import { errorText, type ErrorText } from "../auth/index.ts";

type MeetingError = "notFound" | "expired" | "locked" | "full" | "noGuests";
export type MeetingErrorText = { key: `meetings.errors.${MeetingError}`; values?: Record<string, number> } | ErrorText;

const KEYS: Record<string, MeetingError> = {
  MEETING_NOT_FOUND: "notFound",
  MEETING_EXPIRED: "expired",
  MEETING_LOCKED: "locked",
  MEETING_FULL: "full",
  LOBBY_FULL: "full",
  GUESTS_NOT_ALLOWED: "noGuests",
};

export function meetingErrorText(code: string, retryAfterSeconds?: number): MeetingErrorText {
  const name = KEYS[code];
  if (name) return { key: `meetings.errors.${name}` };
  return errorText(code, retryAfterSeconds);
}
