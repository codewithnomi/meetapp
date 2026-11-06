// Meeting links that open the desktop app (F04 AC-F04-10, 11, 12): `meetapp://m/<code>`, where the code is
// the random part of the meeting's shared link (F02: 16 bytes in base64url, 22 characters). The scheme is
// part of the app's identity (D087); apps/desktop/app-identity.ts uses this value.
export const APP_LINK_SCHEME = "meetapp";

const CODE = /^[A-Za-z0-9_-]{22}$/;
/** Longer input is never a link (also keeps the check cheap). */
const MAX_LENGTH = 64;
const SHAPE = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/m\/([A-Za-z0-9_-]{22})\/?$/;

/** The meeting code from an exact `meetapp://m/<code>` (scheme in any case, one trailing slash); else undefined. */
export function readAppMeetingLink(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length > MAX_LENGTH) return undefined;
  const match = SHAPE.exec(raw);
  if (!match || match[1]?.toLowerCase() !== APP_LINK_SCHEME) return undefined;
  return match[2];
}

/** A well-shaped meeting code (as the preload checks what main passes on). */
export const isMeetingCode = (value: unknown): value is string => typeof value === "string" && CODE.test(value);

/** The link others click to open the meeting in MeetApp. */
export const appMeetingLink = (code: string): string => `${APP_LINK_SCHEME}://m/${code}`;

/** `https://…/m/<code>` (the server's shared link) as `meetapp://m/<code>`; other text is kept as it is. */
export function asAppMeetingLink(sharedLink: string): string {
  const code = /\/m\/([A-Za-z0-9_-]{22})$/.exec(sharedLink)?.[1];
  return code ? appMeetingLink(code) : sharedLink;
}
