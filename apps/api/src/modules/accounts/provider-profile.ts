// When an email from Google or Microsoft counts as verified (F01 design.md section 3, AC-F01-08). Only a
// verified email may create or join a MeetApp account; otherwise someone could claim another person's
// email at a provider that doesn't check it (the "nOAuth" problem).

/** Microsoft's tenant for personal accounts (outlook.com, hotmail.com): their emails are Microsoft's own. */
export const MICROSOFT_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";

/** Google says so in `email_verified`. */
export function googleEmailVerified(claims: object): boolean {
  const profile = claims as Record<string, unknown>;
  return typeof profile["email"] === "string" && profile["email_verified"] === true;
}

/**
 * Microsoft: the optional `xms_edov` claim ("email domain owner verified", set up in the app
 * registration) must be true, or the account must be a personal one.
 */
export function microsoftEmailVerified(claims: object): boolean {
  const profile = claims as Record<string, unknown>;
  if (typeof profile["email"] !== "string") return false;
  return profile["xms_edov"] === true || profile["tid"] === MICROSOFT_CONSUMER_TENANT;
}

/** The refusal code the hand-off page and the app show (AC-F01-08). */
export const PROVIDER_EMAIL_UNVERIFIED = "PROVIDER_EMAIL_UNVERIFIED";
